#!/usr/bin/env bash
# Run from your Mac — copies keyfile primary→secondary and enables auth on secondary.
# Usage:
#   export PRIMARY_IP=167.233.72.149
#   export SECONDARY_IP=188.245.198.155
#   bash sync-secondary-keyfile.sh
set -euo pipefail

PRIMARY_IP="${PRIMARY_IP:-167.233.72.149}"
SECONDARY_IP="${SECONDARY_IP:-188.245.198.155}"
REPL_SET="${REPL_SET:-rs0}"
KEYFILE=/etc/mongodb-keyfile
TMP_KEY="$(mktemp)"

trap 'rm -f "$TMP_KEY"' EXIT

echo "==> Copy keyfile ${PRIMARY_IP} → Mac → ${SECONDARY_IP}"
scp "root@${PRIMARY_IP}:${KEYFILE}" "$TMP_KEY"
scp "$TMP_KEY" "root@${SECONDARY_IP}:${KEYFILE}"

echo "==> Configure MongoDB on secondary"
ssh "root@${SECONDARY_IP}" "chmod 400 ${KEYFILE} && chown mongodb:mongodb ${KEYFILE} && cat > /etc/mongod.conf <<CONF
storage:
  dbPath: /var/lib/mongodb
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log
net:
  port: 27017
  bindIp: 0.0.0.0
security:
  authorization: enabled
  keyFile: ${KEYFILE}
replication:
  replSetName: ${REPL_SET}
processManagement:
  timeZoneInfo: /usr/share/zoneinfo
CONF
chown -R mongodb:mongodb /var/lib/mongodb
systemctl restart mongod
sleep 3
systemctl is-active mongod"

echo "==> Secondary ready for rs.add"
