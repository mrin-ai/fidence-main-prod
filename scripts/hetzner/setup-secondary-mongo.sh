#!/usr/bin/env bash
# Run ON the secondary/test server (188.245.198.155) as root.
# Usage: bash setup-secondary-mongo.sh
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

PRIMARY_IP="${PRIMARY_IP:-167.233.72.149}"
SECONDARY_IP="${SECONDARY_IP:-$(hostname -I | awk '{print $1}')}"
KEYFILE=/etc/mongodb-keyfile

echo "==> Installing MongoDB 7.0 on secondary ${SECONDARY_IP}"

# Remove broken repo from a previous failed run (noble has no Mongo 7.0 Release on Ubuntu 26)
rm -f /etc/apt/sources.list.d/mongodb-org-7.0.list

if ! command -v mongod >/dev/null; then
  apt-get update -qq
  apt-get install -y -qq gnupg curl ca-certificates
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor --batch --yes -o /usr/share/keyrings/mongodb-server-7.0.gpg
  echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
    > /etc/apt/sources.list.d/mongodb-org-7.0.list
  apt-get update -qq
  apt-get install -y -qq mongodb-org
else
  echo "==> mongod already installed: $(mongod --version | head -1)"
fi

# Bootstrap without auth until primary shares the same keyfile (see setup-primary-replica.sh)
cat > /etc/mongod.conf <<CONF
storage:
  dbPath: /var/lib/mongodb
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log
net:
  port: 27017
  bindIp: 0.0.0.0
replication:
  replSetName: rs0
processManagement:
  timeZoneInfo: /usr/share/zoneinfo
CONF

systemctl enable mongod
systemctl restart mongod
sleep 2

if ! systemctl is-active --quiet mongod; then
  echo "mongod failed to start"
  journalctl -u mongod -n 30 --no-pager
  exit 1
fi

echo "==> MongoDB running (bootstrap mode, no auth yet)"
echo "==> Next: run setup-primary-replica.sh on primary (${PRIMARY_IP})"
echo "    It will copy ${KEYFILE} here and enable auth before rs.add"
