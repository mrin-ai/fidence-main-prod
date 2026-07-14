# Hetzner MongoDB read replica

Use this when PayAgent outgrows a single MongoDB server on Hetzner. The app reads payment links and public profiles from the replica via `MONGODB_READ_URI`; writes still go to the primary via `MONGODB_URI`.

## What you need

| Server | Role | Example |
|--------|------|---------|
| **Primary** (existing) | `167.233.72.149` | All writes + fallback reads |
| **Secondary** (new Hetzner box) | Read replica | Offloads `GET /api/pay/*`, public profile, checkout ISR |

Minimum secondary spec: **2 vCPU, 4 GB RAM, 40 GB disk** (CX22 or similar). Same private network as primary if possible.

## 1. Prepare the secondary server

SSH into the **new** server:

```bash
# Ubuntu 22.04/24.04
sudo apt update && sudo apt install -y gnupg curl
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl enable mongod
```

## 2. Open replication port (primary firewall)

On the **primary** (`167.233.72.149`), allow the secondary’s IP on **27017** (Hetzner firewall + `ufw` if used). Replication traffic must be private; do not expose 27017 to the public internet.

## 3. Enable replication on the primary

On the **primary**, edit `/etc/mongod.conf`:

```yaml
net:
  bindIp: 127.0.0.1,<primary-private-ip>,167.233.72.149
  port: 27017

replication:
  replSetName: rs0

security:
  authorization: enabled
```

Restart:

```bash
sudo systemctl restart mongod
```

Initialize the replica set (run once on primary):

```bash
mongosh -u admin -p --authenticationDatabase admin --eval '
rs.initiate({
  _id: "rs0",
  members: [{ _id: 0, host: "167.233.72.149:27017" }]
})
'
```

Wait until `rs.status().members[0].stateStr` is `PRIMARY`.

## 4. Join the secondary

On the **secondary**, `/etc/mongod.conf`:

```yaml
net:
  bindIp: 127.0.0.1,<secondary-private-ip>
  port: 27017

replication:
  replSetName: rs0

security:
  authorization: enabled
```

Start MongoDB:

```bash
sudo systemctl start mongod
```

On the **primary**, add the secondary:

```bash
mongosh -u admin -p --authenticationDatabase admin --eval '
rs.add({ _id: 1, host: "<secondary-ip>:27017", priority: 0, votes: 0 })
'
```

`priority: 0, votes: 0` keeps this node read-only for failover safety until you are ready for HA.

Verify:

```bash
mongosh --eval 'rs.status().members.map(m => ({ host: m.name, state: m.stateStr }))'
```

Expect `SECONDARY` on the new host.

## 5. App user on replica set

`fidence_app` on the primary already has `readWrite@fidence`. After replica set init, the user replicates automatically. No extra role is required for reads on the secondary.

Optional (monitoring only):

```javascript
db.grantRolesToUser("fidence_app", [{ role: "clusterMonitor", db: "admin" }])
```

## 6. Vercel environment variables

Add to Vercel (Production):

```env
# Existing — primary, all writes
MONGODB_URI=mongodb://fidence_app:<password>@167.233.72.149:27017/fidence?authSource=fidence

# New — read preference secondaryPreferred
MONGODB_READ_URI=mongodb://fidence_app:<password>@<secondary-ip>:27017/fidence?authSource=fidence&replicaSet=rs0&readPreference=secondaryPreferred

# Optional pool tuning (default 35)
MONGODB_MAX_POOL_SIZE=35
```

Redeploy. The app uses `getReadDb()` for payment link GETs and public profile reads; everything else uses `getDb()` (primary).

## 7. Verify from your laptop

```bash
npm run check:mongo
```

Or:

```bash
mongosh "$MONGODB_READ_URI" --eval 'db.payment_links.findOne()'
```

Reads should succeed; writes on the read URI will fail (expected).

## 8. Operational checks

```bash
# Replication lag (primary, admin user)
mongosh -u admin -p --authenticationDatabase admin --eval '
const s = rs.printSecondaryReplicationInfo();
print(s);
'

# Connection count
mongosh --eval 'db.serverStatus().connections'
```

Target replication lag: **&lt; 2 seconds** under load. If lag grows, scale secondary RAM/CPU or reduce write-heavy cron batch sizes.

## Rollback

1. Remove `MONGODB_READ_URI` from Vercel.
2. Redeploy — all traffic returns to primary only.
3. Optionally `rs.remove("<secondary-ip>:27017")` and decommission the box.

## When to add this

- Payment link GET p95 &gt; 200 ms with Redis cache enabled.
- Primary Mongo CPU consistently &gt; 70%.
- You are targeting **1K+ concurrent** checkout users.

Until then, Week 1–2 optimizations (Redis cache, ISR, pool size) are sufficient on a single Hetzner Mongo node.
