#!/usr/bin/env bash
# Run ON primary (167.233.72.149) as root — creates MongoDB admin if missing.
# Usage from Mac:
#   export MONGO_ADMIN_USER=admin
#   export MONGO_ADMIN_PASS='pick-a-strong-password'
#   scp scripts/hetzner/create-mongo-admin.sh root@167.233.72.149:/root/
#   ssh root@167.233.72.149 "MONGO_ADMIN_USER='$MONGO_ADMIN_USER' MONGO_ADMIN_PASS='$MONGO_ADMIN_PASS' bash /root/create-mongo-admin.sh"
set -euo pipefail

MONGO_ADMIN_USER="${MONGO_ADMIN_USER:-admin}"
MONGO_ADMIN_PASS="${MONGO_ADMIN_PASS:?Set MONGO_ADMIN_PASS}"

if mongosh -u "$MONGO_ADMIN_USER" -p "$MONGO_ADMIN_PASS" --authenticationDatabase admin --quiet --eval 'db.runCommand({ ping: 1 })' >/dev/null 2>&1; then
  echo "==> Admin user '$MONGO_ADMIN_USER' already works."
  exit 0
fi

echo "==> Creating MongoDB admin user via localhost bootstrap (brief restart)"

systemctl stop mongod

cat > /tmp/mongod-bootstrap.conf <<'CONF'
storage:
  dbPath: /var/lib/mongodb
systemLog:
  destination: file
  logAppend: true
  path: /tmp/mongod-bootstrap.log
net:
  port: 27018
  bindIp: 127.0.0.1
processManagement:
  fork: true
CONF

mongod --config /tmp/mongod-bootstrap.conf
sleep 2

mongosh --port 27018 --quiet --eval "
const user = '$MONGO_ADMIN_USER';
const existing = db.getSiblingDB('admin').getUser(user);
if (existing) {
  db.getSiblingDB('admin').updateUser(user, { pwd: '$MONGO_ADMIN_PASS' });
  print('Updated password for existing admin:', user);
} else {
  db.getSiblingDB('admin').createUser({
    user: user,
    pwd: '$MONGO_ADMIN_PASS',
    roles: [
      { role: 'root', db: 'admin' },
      { role: 'clusterAdmin', db: 'admin' },
    ],
  });
  print('Created admin user:', user);
}
"

mongosh --port 27018 --quiet --eval 'db.shutdownServer({ force: true })' || true
sleep 2
pkill -f 'mongod --config /tmp/mongod-bootstrap.conf' 2>/dev/null || true

chown -R mongodb:mongodb /var/lib/mongodb

systemctl start mongod
sleep 3

mongosh -u "$MONGO_ADMIN_USER" -p "$MONGO_ADMIN_PASS" --authenticationDatabase admin --quiet --eval 'print("Admin login OK")'
echo "==> Done. Re-run setup-primary-replica.sh with the same credentials."
