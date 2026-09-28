-- Re-key the catalog around cohorts.
--
-- Before: a course had no cohort link at all, and an Enrollment pointed
-- straight at a course with a nullable cohortId. Before: a student could
-- hold exactly one enrollment per course regardless of intake.
--
-- After:  every Cohort belongs to exactly one Course, and every
-- Enrollment points at exactly one Cohort (required). A student may hold
-- one enrollment per cohort, so the same course can be taken twice across
-- different intakes. `Enrollment.courseId` is kept as a denormalized copy
-- of `cohort.courseId` so course-level lookups stay a single indexed read;
-- it is corrected from the cohort below and the server actions keep it in
-- sync on every write.
--
-- This migration is written to be non-destructive: it backfills rather
-- than drops, and it refuses to guess when a cohort's course is genuinely
-- ambiguous.

-- AlterTable: add the course link to cohorts, nullable for now so we can
-- backfill before constraining it.
ALTER TABLE "cohorts" ADD COLUMN     "courseId" TEXT;
ALTER TABLE "cohorts" ADD COLUMN     "capacity" INTEGER;
ALTER TABLE "cohorts" ADD COLUMN     "isOpen" BOOLEAN NOT NULL DEFAULT true;

-- Backfill cohorts.courseId from the enrollments that already point at
-- each cohort. A cohort is an intake of one course, so every enrollment in
-- it must agree on courseId. If they disagree the data is corrupt and we
-- stop rather than pick a winner.
DO $$
DECLARE
  conflicting RECORD;
BEGIN
  SELECT co.id, co.name, COUNT(DISTINCT e."courseId") AS course_count
  INTO conflicting
  FROM "cohorts" co
  JOIN "enrollments" e ON e."cohortId" = co.id
  GROUP BY co.id, co.name
  HAVING COUNT(DISTINCT e."courseId") > 1
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Cohort % (%) has enrollments spanning more than one course. Reassign its enrollments to a single course before running this migration.',
      conflicting.id, conflicting.name;
  END IF;
END $$;

UPDATE "cohorts" co
SET "courseId" = sub."courseId"
FROM (
  SELECT DISTINCT ON (e."cohortId") e."cohortId", e."courseId"
  FROM "enrollments" e
  WHERE e."cohortId" IS NOT NULL
  ORDER BY e."cohortId", e."enrolledAt" ASC
) sub
WHERE sub."cohortId" = co.id AND co."courseId" IS NULL;

-- Resolve cohorts that have no enrollments to infer a course from.
-- Safe to auto-assign only when the catalog holds exactly one course;
-- otherwise stop and let a human decide which intake belongs where.
DO $$
DECLARE
  orphan_count INTEGER;
  course_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM "cohorts" WHERE "courseId" IS NULL;
  IF orphan_count = 0 THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO course_count FROM "courses";
  IF course_count = 1 THEN
    UPDATE "cohorts"
    SET "courseId" = (SELECT id FROM "courses" LIMIT 1)
    WHERE "courseId" IS NULL;
    RETURN;
  END IF;

  RAISE EXCEPTION
    '% cohort(s) have no enrollments, so their course cannot be inferred, and the catalog has % courses. Assign a course to each cohort, then re-run this migration.',
    orphan_count, course_count;
END $$;

-- The course link is now fully populated; make it required.
ALTER TABLE "cohorts" ALTER COLUMN "courseId" SET NOT NULL;

-- Foreign keys. A cohort is destroyed with its course, and an enrollment
-- with its cohort.
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable (data): give every course that still has course-level
-- enrollments a one-off "legacy" cohort to hold them, so no enrollment
-- has to be invented or dropped. Closed by default, since a legacy intake
-- is a historical artifact rather than an open intake.
INSERT INTO "cohorts" ("id", "courseId", "name", "slug", "startDate", "endDate", "description", "managerId", "capacity", "isOpen", "createdAt", "updatedAt")
SELECT
  'legacy_' || md5(c.id),
  c.id,
  c.title || ' (Legacy Intake)',
  c.slug || '-legacy-intake',
  COALESCE(d."firstEnrolled", c."createdAt"),
  COALESCE(d."firstEnrolled", c."createdAt") + INTERVAL '365 days',
  'Automatically created when course-level enrollments were migrated into cohorts.',
  NULL,
  NULL,
  false,
  NOW(),
  NOW()
FROM "courses" c
JOIN (
  SELECT "courseId", MIN("enrolledAt") AS "firstEnrolled"
  FROM "enrollments"
  WHERE "cohortId" IS NULL
  GROUP BY "courseId"
) d ON d."courseId" = c.id;

-- Attach those enrollments to the legacy cohort for their course.
UPDATE "enrollments"
SET "cohortId" = 'legacy_' || md5("courseId")
WHERE "cohortId" IS NULL;

-- Deduplicate before adding the (userId, cohortId) unique constraint. A
-- student could previously hold both a course-level enrollment and a
-- cohort enrollment for the same course; those two now collide. Keep the
-- most advanced record so we never silently downgrade a COMPLETED student
-- or resurrect a dropped seat.
DELETE FROM "enrollments"
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY "userId", "cohortId"
        ORDER BY
          CASE "status"
            WHEN 'COMPLETED' THEN 1
            WHEN 'ACTIVE'    THEN 2
            WHEN 'PENDING'   THEN 3
            WHEN 'SUSPENDED' THEN 4
            WHEN 'DROPPED'   THEN 5
            ELSE 6
          END,
          "enrolledAt" DESC
      ) AS rn
    FROM "enrollments"
  ) ranked
  WHERE ranked.rn > 1
);

-- A student can no longer be enrolled without a cohort.
ALTER TABLE "enrollments" ALTER COLUMN "cohortId" SET NOT NULL;

-- The old FK was ON DELETE SET NULL, which would have failed the new
-- NOT NULL constraint anyway. Recreate it as CASCADE.
ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_cohortId_fkey";
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enrollment approval provenance.
ALTER TABLE "enrollments" ADD COLUMN     "approvedAt" TIMESTAMP(3);
ALTER TABLE "enrollments" ADD COLUMN     "approvedById" TEXT;

ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Anything already ACTIVE or COMPLETED got its seat implicitly, before
-- approval existed. Record that it was approved at the time of enrollment
-- so the admin UI can tell legacy seats from reviewed ones. PENDING rows
-- deliberately stay unapproved.
UPDATE "enrollments" SET "approvedAt" = "enrolledAt" WHERE "status" IN ('ACTIVE', 'COMPLETED');
UPDATE "enrollments" SET "approvedAt" = NULL WHERE "status" NOT IN ('ACTIVE', 'COMPLETED');

-- Re-align the denormalized course with the cohort it belongs to.
UPDATE "enrollments" e
SET "courseId" = co."courseId"
FROM "cohorts" co
WHERE co.id = e."cohortId" AND e."courseId" <> co."courseId";

-- A student holds one seat per cohort, not one per course.
DROP INDEX "enrollments_userId_courseId_key";
CREATE UNIQUE INDEX "enrollments_userId_cohortId_key" ON "enrollments"("userId", "cohortId");

-- Query indexes for the cohort-first access paths.
CREATE INDEX "cohorts_courseId_idx" ON "cohorts"("courseId");
CREATE INDEX "enrollments_cohortId_idx" ON "enrollments"("cohortId");
CREATE INDEX "enrollments_status_idx" ON "enrollments"("status");
