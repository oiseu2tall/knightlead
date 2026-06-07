-- Rename RateLimitEvent columns to snake_case so the raw SQL in
-- lib/rate-limit.ts works. The Prisma model uses @map annotations to
-- keep the JS API in camelCase.

ALTER TABLE "rate_limit_events" RENAME COLUMN "createdAt" TO "created_at";
