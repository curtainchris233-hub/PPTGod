interface BucketEntry {
  count: number;
  resetAt: number;
}

declare global {
  var __pptgodRateBuckets: Map<string, BucketEntry> | undefined;
}

const MAX_BUCKET_KEYS = 5000;

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
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 64);
  return "local";
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
export function peekRateLimit(
  key: string,
  limit: number
): RateLimitResult {
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
export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
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

export function resetRateLimit(key: string): void {
  getStore().delete(key);
}
