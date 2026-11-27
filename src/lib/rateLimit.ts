import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { Redis } from "@upstash/redis";

interface BucketEntry {
  count: number;
  resetAt: number;
}

declare global {
  var __pptgodRateBuckets: Map<string, BucketEntry> | undefined;
}

const MAX_BUCKET_KEYS = 5000;
let redis: Redis | undefined;

const PEEK_BUCKET = `
local count = tonumber(redis.call('GET', KEYS[1])) or 0
local ttl = redis.call('PTTL', KEYS[1])
if ttl <= 0 then return {1, 0, 0} end
if count >= tonumber(ARGV[1]) then return {0, count, ttl} end
return {1, count, ttl}
`;

const CONSUME_BUCKET = `
local count = tonumber(redis.call('GET', KEYS[1])) or 0
local ttl = redis.call('PTTL', KEYS[1])
if ttl <= 0 then
  redis.call('SET', KEYS[1], 1, 'PX', ARGV[2])
  return {1, 1, 0}
end
if count >= tonumber(ARGV[1]) then return {0, count, ttl} end
return {1, redis.call('INCR', KEYS[1]), ttl}
`;

export class RateLimitUnavailableError extends Error {
  constructor() {
    super("Request limit storage is unavailable");
    this.name = "RateLimitUnavailableError";
  }
}

function getRedis() {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (url || token || process.env.PPTGOD_REQUIRE_SERVICES === "true") {
      throw new RateLimitUnavailableError();
    }
    return undefined;
  }
  redis = new Redis({
    url,
    token,
    retry: false,
    signal: () => AbortSignal.timeout(2500),
    enableTelemetry: false,
  });
  return redis;
}

function redisKey(key: string) {
  return `pptgod:limit:v1:${createHash("sha256").update(key).digest("hex")}`;
}

async function checkSharedLimit(
  client: Redis,
  key: string,
  limit: number,
  windowMs?: number
): Promise<RateLimitResult> {
  try {
    const [accepted, count, ttl] = await client.eval<number[], [number, number, number]>(
      windowMs === undefined ? PEEK_BUCKET : CONSUME_BUCKET,
      [redisKey(key)],
      windowMs === undefined ? [limit] : [limit, windowMs]
    );
    return {
      allowed: accepted === 1,
      remaining: Math.max(0, limit - count),
      retryAfterSec: accepted === 1 ? 0 : Math.max(1, Math.ceil(ttl / 1000)),
    };
  } catch {
    throw new RateLimitUnavailableError();
  }
}

function getStore(): Map<string, BucketEntry> {
  if (!globalThis.__pptgodRateBuckets) {
    globalThis.__pptgodRateBuckets = new Map<string, BucketEntry>();
  }
  return globalThis.__pptgodRateBuckets;
}

function pruneIfNeeded(store: Map<string, BucketEntry>, now: number) {
  if (store.size < MAX_BUCKET_KEYS) return;
  for (const [k, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(k);
    }
  }
  // If still above cap, drop oldest entries
  if (store.size >= MAX_BUCKET_KEYS) {
    const excess = store.size - Math.floor(MAX_BUCKET_KEYS * 0.75);
    let dropped = 0;
    for (const k of store.keys()) {
      store.delete(k);
      dropped += 1;
      if (dropped >= excess) break;
    }
  }
}

export function getClientIp(request: Request): string {
  const forwarded =
    (process.env.VERCEL && request.headers.get("x-vercel-forwarded-for")) ||
    request.headers.get("x-forwarded-for") ||
    "";
  // Render appends the visitor address to any caller-supplied forwarded chain.
  const lastHop = forwarded.slice(forwarded.lastIndexOf(",") + 1).trim();
  return isIP(lastHop) ? lastHop : "local";
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * Checks whether a key is currently allowed without incrementing (useful when
 * only failed attempts should count against a brute-force quota).
 */
export async function peekRateLimit(
  key: string,
  limit: number
): Promise<RateLimitResult> {
  const client = getRedis();
  if (client) return checkSharedLimit(client, key, limit);
  const store = getStore();
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    return { allowed: true, remaining: limit, retryAfterSec: 0 };
  }
  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  return {
    allowed: true,
    remaining: Math.max(0, limit - entry.count),
    retryAfterSec: 0,
  };
}

/**
 * Consumes 1 token from the fixed-window bucket for `key`.
 */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const client = getRedis();
  if (client) return checkSharedLimit(client, key, limit, windowMs);
  const store = getStore();
  const now = Date.now();
  pruneIfNeeded(store, now);

  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      retryAfterSec: 0,
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSec: 0,
  };
}

export async function resetRateLimit(key: string): Promise<void> {
  const client = getRedis();
  if (client) {
    try {
      await client.del(redisKey(key));
      return;
    } catch {
      throw new RateLimitUnavailableError();
    }
  }
  getStore().delete(key);
}
