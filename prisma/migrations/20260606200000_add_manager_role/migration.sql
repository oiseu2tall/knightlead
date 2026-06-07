-- Add the MANAGER role and the new optional manager FKs on cohorts and
-- courses. MANAGER sits between INSTRUCTOR and ADMIN: full control of
-- the catalog (cohorts, courses, modules) but does NOT inherit admin
-- powers over users, grading, or enrollments.

-- 1. Add MANAGER to the Role enum. Postgres requires the new label
--    *before* it can be used anywhere.
ALTER TYPE "Role" ADD VALUE 'MANAGER';

-- 2. Add optional manager FKs.
ALTER TABLE "cohorts" ADD COLUMN "managerId" TEXT;
ALTER TABLE "courses" ADD COLUMN "managerId" TEXT;

ALTER TABLE "cohorts"
  ADD CONSTRAINT "cohorts_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "courses"
  ADD CONSTRAINT "courses_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX "cohorts_managerId_idx" ON "cohorts"("managerId");
CREATE INDEX "courses_managerId_idx" ON "courses"("managerId");
