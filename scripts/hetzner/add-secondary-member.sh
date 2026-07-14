#!/usr/bin/env bash
# Run from your Mac — adds secondary to replica set on primary.
# Usage:
#   export MONGO_ADMIN_USER=admin
#   export MONGO_ADMIN_PASS='your-password'
#   export SECONDARY_IP=188.245.198.155
#   bash add-secondary-member.sh
set -euo pipefail

PRIMARY_IP="${PRIMARY_IP:-167.233.72.149}"
SECONDARY_IP="${SECONDARY_IP:-188.245.198.155}"
MONGO_ADMIN_USER="${MONGO_ADMIN_USER:-admin}"
MONGO_ADMIN_PASS="${MONGO_ADMIN_PASS:?Set MONGO_ADMIN_PASS}"

ssh "root@${PRIMARY_IP}" \
  MONGO_ADMIN_USER="$MONGO_ADMIN_USER" \
  MONGO_ADMIN_PASS="$MONGO_ADMIN_PASS" \
  SECONDARY_HOST="$SECONDARY_IP" \
  bash -s <<'REMOTE'
set -euo pipefail
mongosh -u "$MONGO_ADMIN_USER" -p "$MONGO_ADMIN_PASS" --authenticationDatabase admin --quiet --eval "
const target = '${SECONDARY_HOST}:27017';
const members = rs.status().members.map(function (m) { return m.name; });
if (members.indexOf(target) < 0) {
  printjson(rs.add({ _id: 1, host: target, priority: 0, votes: 0 }));
} else {
  print('secondary_already_added');
}
rs.status().members.forEach(function (m) { print(m.name, m.stateStr); });
"
REMOTE
