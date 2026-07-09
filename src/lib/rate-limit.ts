import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type RateLimitOptions = {
  max: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

const memoryCounters = new Map<string, { count: number; resetAt: number }>();

function isRedisConfigured() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

const rateLimiters = new Map<string, Ratelimit>();

function getRateLimiter(options: RateLimitOptions) {
  const key = `${options.max}:${options.windowMs}`;
  const existing = rateLimiters.get(key);
  if (existing) return existing;

  const limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(
      options.max,
      `${Math.max(1, Math.floor(options.windowMs / 1000))} s`,
    ),
    prefix: "fidence:ratelimit",
  });
  rateLimiters.set(key, limiter);
  return limiter;
}

async function checkMemoryRateLimit(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const now = Date.now();
  const entry = memoryCounters.get(key);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + options.windowMs;
    memoryCounters.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: options.max - 1,
      resetAt,
    };
  }

  if (entry.count >= options.max) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: options.max - entry.count,
    resetAt: entry.resetAt,
  };
}

export async function checkRateLimit(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  if (isRedisConfigured()) {
    const limiter = getRateLimiter(options);
    const result = await limiter.limit(key);
    return {
      allowed: result.success,
      remaining: result.remaining,
      resetAt: result.reset,
    };
  }

  return checkMemoryRateLimit(key, options);
}

export function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function rateLimitResponse(result: RateLimitResult) {
  const retryAfter = Math.max(
    1,
    Math.ceil((result.resetAt - Date.now()) / 1000),
  );

  return new Response(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(retryAfter),
    },
  });
}
