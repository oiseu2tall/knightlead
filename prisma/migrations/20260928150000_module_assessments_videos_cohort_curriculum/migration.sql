-- Restructure the curriculum: assessments move up to the module, lessons
-- gain many videos, and each cohort gets its own delivery plan.
--
-- Before:
--   Assignment.lessonId  -> required
--   Quiz.lessonId        -> required
--   Lesson.videoUrl      -> single optional URL
--   Cohort               -> no curriculum of its own
--
-- After:
--   Assignment.moduleId  -> required (course reached via module.course)
--   Quiz.moduleId        -> required
--   LessonVideo          -> a lesson has many ordered videos
--   CohortLesson         -> a cohort's ordered lesson plan
--   CohortModule         -> a cohort's ordered module plan
--
-- Every existing row is preserved. Nothing is dropped without first being
-- carried forward.

-- ---------------------------------------------------------------------------
-- 1. lesson_videos
-- ---------------------------------------------------------------------------

CREATE TABLE "lesson_videos" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "fileKey" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "fileType" TEXT,
    "durationMin" INTEGER,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_videos_pkey" PRIMARY KEY ("id")
);

-- Carry every existing single video URL across as a LessonVideo row before
-- the column is dropped, so no lesson silently loses its video. A lesson
-- can have at most one migrated row (order 0), so the unique index below
-- cannot be violated by this INSERT.
INSERT INTO "lesson_videos" ("id", "lessonId", "title", "description", "url", "order", "createdAt", "updatedAt")
SELECT
    'legacyvid_' || md5(l.id),
    l.id,
    l.title || ' — video',
    'Migrated from the lesson''s single video URL.',
    l."videoUrl",
    0,
    COALESCE(l."createdAt", NOW()),
    COALESCE(l."updatedAt", NOW())
FROM "lessons" l
WHERE l."videoUrl" IS NOT NULL AND l."videoUrl" <> '';

CREATE UNIQUE INDEX "lesson_videos_lessonId_order_key" ON "lesson_videos"("lessonId", "order");
CREATE INDEX "lesson_videos_lessonId_idx" ON "lesson_videos"("lessonId");

ALTER TABLE "lesson_videos" ADD CONSTRAINT "lesson_videos_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The single-URL column has served its purpose.
ALTER TABLE "lessons" DROP COLUMN "videoUrl";

-- ---------------------------------------------------------------------------
-- 2. cohort_lessons + cohort_modules
-- ---------------------------------------------------------------------------

CREATE TABLE "cohort_lessons" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "releaseAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cohort_lessons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cohort_modules" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cohort_modules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cohort_lessons_cohortId_lessonId_key" ON "cohort_lessons"("cohortId", "lessonId");
CREATE UNIQUE INDEX "cohort_lessons_cohortId_order_key" ON "cohort_lessons"("cohortId", "order");
CREATE INDEX "cohort_lessons_lessonId_idx" ON "cohort_lessons"("lessonId");

CREATE UNIQUE INDEX "cohort_modules_cohortId_moduleId_key" ON "cohort_modules"("cohortId", "moduleId");
CREATE UNIQUE INDEX "cohort_modules_cohortId_order_key" ON "cohort_modules"("cohortId", "order");
CREATE INDEX "cohort_modules_moduleId_idx" ON "cohort_modules"("moduleId");

ALTER TABLE "cohort_lessons" ADD CONSTRAINT "cohort_lessons_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cohort_lessons" ADD CONSTRAINT "cohort_lessons_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cohort_modules" ADD CONSTRAINT "cohort_modules_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cohort_modules" ADD CONSTRAINT "cohort_modules_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed an initial plan so existing cohorts are immediately useful rather
-- than silently empty. Every course's lessons are scheduled into every
-- cohort of that course, in module-then-lesson order. Staff can then
-- reorder, remove, or add lessons per intake.
--
-- Cross-course cohorts are impossible by construction: the join below
-- pairs each cohort with lessons reachable through its own course.
INSERT INTO "cohort_lessons" ("id", "cohortId", "lessonId", "order", "createdAt", "updatedAt")
SELECT
    'cl_' || md5(co.id || l.id),
    co.id,
    l.id,
    ROW_NUMBER() OVER (PARTITION BY co.id ORDER BY m."order" ASC, l."order" ASC) - 1,
    NOW(),
    NOW()
FROM "cohorts" co
JOIN "modules" m ON m."courseId" = co."courseId"
JOIN "lessons" l ON l."moduleId" = m.id;

INSERT INTO "cohort_modules" ("id", "cohortId", "moduleId", "order", "createdAt", "updatedAt")
SELECT
    'cm_' || md5(co.id || m.id),
    co.id,
    m.id,
    ROW_NUMBER() OVER (PARTITION BY co.id ORDER BY m."order" ASC) - 1,
    NOW(),
    NOW()
FROM "cohorts" co
JOIN "modules" m ON m."courseId" = co."courseId";

-- ---------------------------------------------------------------------------
-- 3. assignments and quizzes move from lesson to module
-- ---------------------------------------------------------------------------

ALTER TABLE "assignments" ADD COLUMN     "moduleId" TEXT;
ALTER TABLE "quizzes" ADD COLUMN     "moduleId" TEXT;

-- Carry each assessment up to the module that owned its lesson. An
-- assessment whose lesson has no module cannot be placed, so stop rather
-- than orphan it.
DO $$
DECLARE
    orphan RECORD;
BEGIN
    SELECT a.id, a.title
    INTO orphan
    FROM "assignments" a
    LEFT JOIN "lessons" l ON l.id = a."lessonId"
    LEFT JOIN "modules" m ON m.id = l."moduleId"
    WHERE m.id IS NULL
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION
            'Assignment % (%) has no owning module (its lesson is missing or has no module). Repair it before running this migration.',
            orphan.id, orphan.title;
    END IF;

    SELECT q.id, q.title
    INTO orphan
    FROM "quizzes" q
    LEFT JOIN "lessons" l ON l.id = q."lessonId"
    LEFT JOIN "modules" m ON m.id = l."moduleId"
    WHERE m.id IS NULL
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION
            'Quiz % (%) has no owning module (its lesson is missing or has no module). Repair it before running this migration.',
            orphan.id, orphan.title;
    END IF;
END $$;

UPDATE "assignments" a
SET "moduleId" = l."moduleId"
FROM "lessons" l
WHERE l.id = a."lessonId";

UPDATE "quizzes" q
SET "moduleId" = l."moduleId"
FROM "lessons" l
WHERE l.id = q."lessonId";

-- Required from here on.
ALTER TABLE "assignments" ALTER COLUMN "moduleId" SET NOT NULL;
ALTER TABLE "quizzes" ALTER COLUMN "moduleId" SET NOT NULL;

-- Swap the foreign keys and indexes from lesson to module.
ALTER TABLE "assignments" DROP CONSTRAINT "assignments_lessonId_fkey";
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DROP INDEX "assignments_lessonId_idx";
CREATE INDEX "assignments_moduleId_idx" ON "assignments"("moduleId");
ALTER TABLE "assignments" DROP COLUMN "lessonId";

ALTER TABLE "quizzes" DROP CONSTRAINT "quizzes_lessonId_fkey";
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DROP INDEX "quizzes_lessonId_idx";
CREATE INDEX "quizzes_moduleId_idx" ON "quizzes"("moduleId");
ALTER TABLE "quizzes" DROP COLUMN "lessonId";
