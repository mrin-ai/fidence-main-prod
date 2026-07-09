import { Redis } from "@upstash/redis";

type MemoryEntry = {
  value: string;
  expiresAt: number | null;
};

const memoryStore = new Map<string, MemoryEntry>();

function isRedisConfigured() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

let redisClient: Redis | null = null;

function getRedisClient() {
  if (!isRedisConfigured()) return null;
  if (!redisClient) {
    redisClient = Redis.fromEnv();
  }
  return redisClient;
}

function purgeExpiredMemory(key: string) {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt != null && entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry;
}

async function memoryGet(key: string) {
  const entry = purgeExpiredMemory(key);
  return entry?.value ?? null;
}

async function memorySet(key: string, value: string, exSeconds?: number) {
  memoryStore.set(key, {
    value,
    expiresAt: exSeconds ? Date.now() + exSeconds * 1000 : null,
  });
}

async function memoryDel(key: string) {
  memoryStore.delete(key);
}

async function memoryIncr(key: string) {
  const current = Number((await memoryGet(key)) ?? "0");
  const next = current + 1;
  const entry = purgeExpiredMemory(key);
  await memorySet(key, String(next), entry?.expiresAt
    ? Math.max(1, Math.floor((entry.expiresAt - Date.now()) / 1000))
    : undefined);
  return next;
}

async function memoryRpush(key: string, value: string) {
  const raw = (await memoryGet(key)) ?? "[]";
  const list = JSON.parse(raw) as string[];
  list.push(value);
  await memorySet(key, JSON.stringify(list));
  return list.length;
}

async function memoryLpop(key: string) {
  const raw = await memoryGet(key);
  if (!raw) return null;
  const list = JSON.parse(raw) as string[];
  const value = list.shift();
  if (list.length === 0) {
    await memoryDel(key);
  } else {
    await memorySet(key, JSON.stringify(list));
  }
  return value ?? null;
}

async function memoryLlen(key: string) {
  const raw = await memoryGet(key);
  if (!raw) return 0;
  const list = JSON.parse(raw) as string[];
  return list.length;
}

export function isCacheAvailable() {
  return isRedisConfigured() || process.env.NODE_ENV === "development";
}

export async function cacheGet(key: string) {
  const redis = getRedisClient();
  if (redis) {
    const value = await redis.get<string>(key);
    return value ?? null;
  }
  return memoryGet(key);
}

export async function cacheSet(key: string, value: string, exSeconds?: number) {
  const redis = getRedisClient();
  if (redis) {
    if (exSeconds) {
      await redis.set(key, value, { ex: exSeconds });
    } else {
      await redis.set(key, value);
    }
    return;
  }
  await memorySet(key, value, exSeconds);
}

export async function cacheDel(key: string) {
  const redis = getRedisClient();
  if (redis) {
    await redis.del(key);
    return;
  }
  await memoryDel(key);
}

export async function cacheIncr(key: string) {
  const redis = getRedisClient();
  if (redis) {
    return redis.incr(key);
  }
  return memoryIncr(key);
}

export async function cacheExpire(key: string, exSeconds: number) {
  const redis = getRedisClient();
  if (redis) {
    await redis.expire(key, exSeconds);
    return;
  }
  const value = await memoryGet(key);
  if (value != null) {
    await memorySet(key, value, exSeconds);
  }
}

export async function cacheRpush(key: string, value: string) {
  const redis = getRedisClient();
  if (redis) {
    return redis.rpush(key, value);
  }
  return memoryRpush(key, value);
}

export async function cacheLpop(key: string) {
  const redis = getRedisClient();
  if (redis) {
    const value = await redis.lpop<string>(key);
    return value ?? null;
  }
  return memoryLpop(key);
}

export async function cacheLlen(key: string) {
  const redis = getRedisClient();
  if (redis) {
    return redis.llen(key);
  }
  return memoryLlen(key);
}
