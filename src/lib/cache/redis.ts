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
  await memorySet(
    key,
    String(next),
    entry?.expiresAt
      ? Math.max(1, Math.floor((entry.expiresAt - Date.now()) / 1000))
      : undefined,
  );
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

async function withRedisFallback<T>(
  fallback: () => Promise<T>,
  operation: (redis: Redis) => Promise<T>,
): Promise<T> {
  const redis = getRedisClient();
  if (!redis) {
    return fallback();
  }

  try {
    return await operation(redis);
  } catch (error) {
    console.error("Redis operation failed, using memory fallback:", error);
    return fallback();
  }
}

export function isCacheAvailable() {
  return isRedisConfigured() || process.env.NODE_ENV === "development";
}

function normalizeCacheValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export function parseStoredJson<T>(raw: unknown): T | null {
  if (raw == null) return null;

  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  if (typeof raw === "object") {
    return raw as T;
  }

  return null;
}

export async function cacheGet(key: string) {
  return withRedisFallback(
    () => memoryGet(key),
    async (redis) => normalizeCacheValue(await redis.get(key)),
  );
}

export async function cacheSet(key: string, value: string, exSeconds?: number) {
  return withRedisFallback(
    () => memorySet(key, value, exSeconds),
    async (redis) => {
      if (exSeconds) {
        await redis.set(key, value, { ex: exSeconds });
      } else {
        await redis.set(key, value);
      }
    },
  );
}

export async function cacheDel(key: string) {
  return withRedisFallback(
    () => memoryDel(key),
    async (redis) => {
      await redis.del(key);
    },
  );
}

export async function cacheIncr(key: string) {
  return withRedisFallback(
    () => memoryIncr(key),
    (redis) => redis.incr(key),
  );
}

export async function cacheExpire(key: string, exSeconds: number) {
  return withRedisFallback(
    async () => {
      const value = await memoryGet(key);
      if (value != null) {
        await memorySet(key, value, exSeconds);
      }
    },
    async (redis) => {
      await redis.expire(key, exSeconds);
    },
  );
}

export async function cacheRpush(key: string, value: string) {
  return withRedisFallback(
    () => memoryRpush(key, value),
    (redis) => redis.rpush(key, value),
  );
}

export async function cacheLpop(key: string) {
  return withRedisFallback(
    () => memoryLpop(key),
    async (redis) => {
      const value = await redis.lpop<string>(key);
      return value ?? null;
    },
  );
}

export async function cacheLlen(key: string) {
  return withRedisFallback(
    () => memoryLlen(key),
    (redis) => redis.llen(key),
  );
}
