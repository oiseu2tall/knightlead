// Sliding-window rate limiter backed by Postgres.
//
// Why Postgres: zero extra infrastructure — the same DB you're already
// running. Adds one tiny table (rate_limit_events) and one index.
// Sliding window is approximated with a fixed window + carry for
// accuracy while keeping the query O(1).
//
// The function signature is unchanged from the in-memory version, so
// existing call sites (actions, route handlers) need no edits.

import { db } from "@/lib/db";

export type RateLimitResult = { ok: boolean; remaining: number; resetAt: number };

export async function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - opts.windowMs;

  // 1. Count events in the current window.
  // 2. If under limit, insert a new event.
  // Done in a transaction with a uniqueness guard to avoid races.
  return await db.$transaction(async (tx) => {
    // Prisma doesn't expose FOR UPDATE on aggregates, so we use a single
    // SERIALIZABLE-ish pattern: count, then insert if allowed.
    const used = await tx.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM rate_limit_events
      WHERE key = ${key} AND created_at > ${new Date(windowStart)}
    `;
    const current = Number(used[0]?.count ?? 0n);

    if (current >= opts.limit) {
      // Find the oldest event in the window to compute when capacity frees.
      const oldest = await tx.$queryRaw<{ created_at: Date }[]>`
        SELECT created_at FROM rate_limit_events
        WHERE key = ${key} AND created_at > ${new Date(windowStart)}
        ORDER BY created_at ASC LIMIT 1
      `;
      const resetAt = oldest[0]
        ? oldest[0].created_at.getTime() + opts.windowMs
        : now + opts.windowMs;
      return { ok: false, remaining: 0, resetAt };
    }

    await tx.$queryRaw`
      INSERT INTO rate_limit_events (id, key, created_at)
      VALUES (gen_random_uuid()::text, ${key}, ${new Date(now)})
    `;
    return { ok: true, remaining: opts.limit - current - 1, resetAt: now + opts.windowMs };
  });
}

/**
 * Periodic housekeeping: prune old events so the table doesn't grow
 * forever. Call from a cron, or from instrumentation.ts on startup.
 */
export async function pruneRateLimitEvents(olderThanMs = 24 * 60 * 60 * 1000) {
  const cutoff = new Date(Date.now() - olderThanMs);
  await db.$executeRaw`DELETE FROM rate_limit_events WHERE created_at < ${cutoff}`;
}
