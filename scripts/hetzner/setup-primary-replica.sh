#!/usr/bin/env bash
# Run ON the primary Mongo server (167.233.72.149) as root.
# Does NOT ssh to secondary — run sync-secondary-keyfile.sh from your Mac first.
#
# Usage from Mac:
#   export MONGO_ADMIN_USER=admin
#   export MONGO_ADMIN_PASS='your-password'
#   export SECONDARY_IP=188.245.198.155
#   bash sync-secondary-keyfile.sh          # from Mac first
#   scp scripts/hetzner/setup-primary-replica.sh root@167.233.72.149:/root/
#   ssh root@167.233.72.149 "MONGO_ADMIN_USER=... MONGO_ADMIN_PASS=... SECONDARY_IP=... bash /root/setup-primary-replica.sh"
set -euo pipefail

SECONDARY_IP="${SECONDARY_IP:-188.245.198.155}"
PRIMARY_IP="${PRIMARY_IP:-167.233.72.149}"
REPL_SET="${REPL_SET:-rs0}"
KEYFILE=/etc/mongodb-keyfile

if [[ -z "${MONGO_ADMIN_USER:-}" || -z "${MONGO_ADMIN_PASS:-}" ]]; then
  echo "Set MONGO_ADMIN_USER and MONGO_ADMIN_PASS (MongoDB admin on primary)."
  exit 1
fi

MONGOSH=(mongosh -u "$MONGO_ADMIN_USER" -p "$MONGO_ADMIN_PASS" --authenticationDatabase admin)

echo "==> Backing up mongod.conf"
cp /etc/mongod.conf "/etc/mongod.conf.bak.$(date +%Y%m%d%H%M%S)"

if [[ ! -f "$KEYFILE" ]]; then
  openssl rand -base64 756 > "$KEYFILE"
  chmod 400 "$KEYFILE"
  chown mongodb:mongodb "$KEYFILE"
  echo "==> Created new keyfile — run sync-secondary-keyfile.sh from your Mac before rs.add"
fi

NEEDS_RESTART=false
if ! grep -q "replSetName: ${REPL_SET}" /etc/mongod.conf 2>/dev/null; then
  NEEDS_RESTART=true
fi
if ! grep -q "keyFile: ${KEYFILE}" /etc/mongod.conf 2>/dev/null; then
  NEEDS_RESTART=true
fi

if [[ "$NEEDS_RESTART" == true ]]; then
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
security:
  authorization: enabled
  keyFile: ${KEYFILE}
replication:
  replSetName: ${REPL_SET}
processManagement:
  timeZoneInfo: /usr/share/zoneinfo
CONF

  systemctl restart mongod
  sleep 5
fi

if ! systemctl is-active --quiet mongod; then
  echo "mongod failed to start on primary"
  journalctl -u mongod -n 30 --no-pager
  exit 1
fi

echo "==> Initialize replica set if needed"
INIT_RESULT=$("${MONGOSH[@]}" --quiet --eval "
try {
  rs.status();
  print('already_initialized');
} catch (e) {
  if (e.codeName !== 'NotYetInitialized') throw e;
  const cfg = { _id: '${REPL_SET}', members: [{ _id: 0, host: '${PRIMARY_IP}:27017' }] };
  printjson(rs.initiate(cfg));
}
" 2>&1) || true
echo "$INIT_RESULT"

echo "==> Waiting for PRIMARY state..."
STATE="UNKNOWN"
for i in $(seq 1 30); do
  STATE=$("${MONGOSH[@]}" --quiet --eval "
    try { print(rs.status().members.find(m => m.self).stateStr); } catch(e) { print('UNKNOWN'); }
  " 2>/dev/null || echo "UNKNOWN")
  echo "  attempt $i: $STATE"
  if [[ "$STATE" == "PRIMARY" ]]; then break; fi
  sleep 2
done

if [[ "$STATE" != "PRIMARY" ]]; then
  echo "Primary never reached PRIMARY state"
  exit 1
fi

echo "==> Add secondary member (run sync-secondary-keyfile.sh from Mac first if not done)"
ADD_RESULT=$("${MONGOSH[@]}" --quiet --eval "
const target = '${SECONDARY_IP}:27017';
const members = rs.status().members.map(m => m.name);
if (!members.includes(target)) {
  printjson(rs.add({ _id: 1, host: target, priority: 0, votes: 0 }));
} else {
  print('secondary_already_added');
}
rs.status().members.forEach(m => print(m.name, m.stateStr));
" 2>&1) || true
echo "$ADD_RESULT"

echo "==> Done. Add to Vercel:"
echo "MONGODB_READ_URI=mongodb://fidence_app:<password>@$SECONDARY_IP:27017/fidence?authSource=fidence&replicaSet=$REPL_SET&readPreference=secondaryPreferred"
