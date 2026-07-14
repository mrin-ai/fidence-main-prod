#!/usr/bin/env bash
# Run from your Mac (SSH key loaded: ssh-add ~/.ssh/id_ed25519)
set -euo pipefail

PRIMARY_IP="${PRIMARY_IP:-167.233.72.149}"
SECONDARY_IP="${SECONDARY_IP:-188.245.198.155}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> [1/3] Secondary: install MongoDB on $SECONDARY_IP"
scp "$SCRIPT_DIR/setup-secondary-mongo.sh" "root@${SECONDARY_IP}:/root/"
ssh "root@${SECONDARY_IP}" 'bash /root/setup-secondary-mongo.sh'

echo ""
echo "==> [2/3] Primary: configure replica set on $PRIMARY_IP"
read -r -p "Mongo admin username [admin]: " MONGO_ADMIN_USER
MONGO_ADMIN_USER="${MONGO_ADMIN_USER:-admin}"
read -r -s -p "Mongo admin password: " MONGO_ADMIN_PASS
echo ""

scp "$SCRIPT_DIR/setup-primary-replica.sh" "root@${PRIMARY_IP}:/root/"
ssh "root@${PRIMARY_IP}" \
  "MONGO_ADMIN_USER='$MONGO_ADMIN_USER' MONGO_ADMIN_PASS='$MONGO_ADMIN_PASS' SECONDARY_IP='$SECONDARY_IP' bash /root/setup-primary-replica.sh" || true

echo ""
echo "==> [3/3] Sync keyfile from Mac (primary cannot ssh to secondary)"
bash "$SCRIPT_DIR/sync-secondary-keyfile.sh"

ssh "root@${PRIMARY_IP}" \
  "MONGO_ADMIN_USER='$MONGO_ADMIN_USER' MONGO_ADMIN_PASS='$MONGO_ADMIN_PASS' SECONDARY_IP='$SECONDARY_IP' bash -s" <<'REMOTE'
set -euo pipefail
mongosh -u "$MONGO_ADMIN_USER" -p "$MONGO_ADMIN_PASS" --authenticationDatabase admin --quiet --eval "
const target = '${SECONDARY_IP}:27017';
const members = rs.status().members.map(m => m.name);
if (!members.includes(target)) {
  printjson(rs.add({ _id: 1, host: target, priority: 0, votes: 0 }));
}
rs.status().members.forEach(m => print(m.name, m.stateStr));
"
REMOTE

echo ""
echo "==> Verify replication:"
ssh "root@${PRIMARY_IP}" "mongosh -u '$MONGO_ADMIN_USER' -p '$MONGO_ADMIN_PASS' --authenticationDatabase admin --quiet --eval 'rs.status().members.forEach(m => print(m.name, m.stateStr))'"
