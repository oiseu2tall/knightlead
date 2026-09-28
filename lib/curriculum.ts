// Cohort curriculum resolution.
//
// A course defines the full body of content: modules → lessons. A cohort
// defines what THIS intake actually delivers, as an ordered plan
// (`CohortLesson`, optionally grouped by `CohortModule`). A cohort that
// defines no plan teaches the whole course in the course's own order —
// the plan is additive, never mandatory.
//
// Both the course page, the lesson page, and progress recomputation need
// to answer "what does this cohort teach, in what order", so that
// resolution lives here rather than being re-derived per call site.

import { db } from "@/lib/db";

/** One lesson in a cohort's delivery plan. */
export type CurriculumLesson = {
  lessonId: string;
  lessonTitle: string;
  moduleId: string;
  moduleTitle: string;
  /** Position in the cohort's plan (0-based). */
  order: number;
  moduleOrder: number;
  lessonOrder: number;
  contentType: string;
  durationMin: number | null;
  /** Optional gate: the lesson unlocks at/after this time. */
  releaseAt: Date | null;
  isFree: boolean;
};

/** One module in a cohort's delivery plan, with its lessons attached. */
export type CurriculumModule = {
  moduleId: string;
  moduleTitle: string;
  order: number;
  lessons: CurriculumLesson[];
};

export type Curriculum = {
  /** True when the cohort defines its own plan rather than inheriting the course's. */
  hasOwnPlan: boolean;
  modules: CurriculumModule[];
  lessons: CurriculumLesson[];
};

/**
 * Resolve what a cohort teaches.
 *
 * Prefers the cohort's explicit `CohortLesson` plan; falls back to every
 * lesson of the cohort's course when no plan exists. Modules are derived
 * from the lessons in plan order, so a cohort can teach a module's
 * lessons out of module order (e.g. a catch-up session) without the
 * grouping fighting the plan.
 */
export async function getCohortCurriculum(cohortId: string): Promise<Curriculum | null> {
  const cohort = await db.cohort.findUnique({
    where: { id: cohortId },
    select: { id: true, courseId: true },
  });
  if (!cohort) return null;

  const links = await db.cohortLesson.findMany({
    where: { cohortId },
    orderBy: { order: "asc" },
    select: {
      order: true,
      releaseAt: true,
      lesson: {
        select: {
          id: true,
          title: true,
          order: true,
          isFree: true,
          contentType: true,
          durationMin: true,
          module: { select: { id: true, title: true, order: true } },
        },
      },
    },
  });

  if (links.length === 0) {
    // No plan: teach the whole course in the course's own order.
    const courseLessons = await db.lesson.findMany({
      where: { module: { courseId: cohort.courseId } },
      orderBy: [{ module: { order: "asc" } }, { order: "asc" }],
      select: {
        id: true,
        title: true,
        order: true,
        isFree: true,
        contentType: true,
        durationMin: true,
        module: { select: { id: true, title: true, order: true } },
      },
    });

    const lessons: CurriculumLesson[] = courseLessons.map((l, index) => ({
      lessonId: l.id,
      lessonTitle: l.title,
      moduleId: l.module.id,
      moduleTitle: l.module.title,
      order: index,
      moduleOrder: l.module.order,
      lessonOrder: l.order,
      contentType: l.contentType,
      durationMin: l.durationMin,
      releaseAt: null,
      isFree: l.isFree,
    }));
    return { hasOwnPlan: false, modules: groupIntoModules(lessons), lessons };
  }

  const lessons: CurriculumLesson[] = links.map((link) => ({
    lessonId: link.lesson.id,
    lessonTitle: link.lesson.title,
    moduleId: link.lesson.module.id,
    moduleTitle: link.lesson.module.title,
    order: link.order,
    moduleOrder: link.lesson.module.order,
    lessonOrder: link.lesson.order,
    contentType: link.lesson.contentType,
    durationMin: link.lesson.durationMin,
    releaseAt: link.releaseAt,
    isFree: link.lesson.isFree,
  }));
  return { hasOwnPlan: true, modules: groupIntoModules(lessons), lessons };
}

function groupIntoModules(lessons: CurriculumLesson[]): CurriculumModule[] {
  const byModule = new Map<string, CurriculumModule>();
  for (const lesson of lessons) {
    let group = byModule.get(lesson.moduleId);
    if (!group) {
      group = { moduleId: lesson.moduleId, moduleTitle: lesson.moduleTitle, order: lesson.moduleOrder, lessons: [] };
      byModule.set(lesson.moduleId, group);
    }
    group.lessons.push(lesson);
  }
  // Modules appear in the order their first lesson appears in the plan.
  return [...byModule.values()].sort((a, b) => a.lessons[0].order - b.lessons[0].order);
}

/**
 * Whether a curriculum lesson is unlocked for a student right now.
 *
 * A lesson with no `releaseAt` is available from the start of the cohort.
 * A lesson with one is locked until that moment. Free preview lessons are
 * always available.
 */
export function isLessonReleased(
  lesson: Pick<CurriculumLesson, "releaseAt" | "isFree">,
  now: Date = new Date(),
): boolean {
  if (lesson.isFree) return true;
  if (!lesson.releaseAt) return true;
  return lesson.releaseAt.getTime() <= now.getTime();
}

/** Look up a single lesson within a resolved curriculum. */
export function findInCurriculum(
  curriculum: Curriculum,
  lessonId: string,
): CurriculumLesson | undefined {
  return curriculum.lessons.find((l) => l.lessonId === lessonId);
}

/**
 * The modules a cohort teaches, in delivery order.
 *
 * A cohort's explicit `CohortModule` plan wins; a cohort with no plan
 * teaches every module of its course. Used to scope module-level
 * assessments: a student must not be shown — nor allowed to submit to —
 * work belonging to a module this intake never delivers.
 */
export async function getInPlanModuleIds(
  cohortId: string,
  courseId: string,
): Promise<string[]> {
  const planned = await db.cohortModule.findMany({
    where: { cohortId },
    orderBy: { order: "asc" },
    select: { moduleId: true },
  });
  if (planned.length > 0) return planned.map((m) => m.moduleId);

  const all = await db.module.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  return all.map((m) => m.id);
}

/**
 * The live seat whose cohort actually delivers this module, if any.
 *
 * Submission and completion both need this: a student approved into two
 * intakes of the same course may only be credited against the intake that
 * teaches the module. Returns null when no live seat covers it.
 */
export async function findSeatTeachingModule(
  userId: string,
  courseId: string,
  moduleId: string,
): Promise<{ enrollmentId: string; cohortId: string } | null> {
  const seats = await db.enrollment.findMany({
    where: { userId, courseId, status: { in: ["ACTIVE", "COMPLETED"] } },
    select: { id: true, cohortId: true },
    orderBy: [{ approvedAt: "desc" }, { enrolledAt: "desc" }],
  });
  for (const seat of seats) {
    const moduleIds = await getInPlanModuleIds(seat.cohortId, courseId);
    if (moduleIds.includes(moduleId)) return { enrollmentId: seat.id, cohortId: seat.cohortId };
  }
  return null;
}

/**
 * The live seat whose cohort actually teaches a specific lesson, if any.
 *
 * The lesson-level counterpart to `findSeatTeachingModule`. Progress is
 * credited to the intake that schedules the lesson, so a student holding
 * seats in two intakes is scored against the one doing the teaching.
 */
export async function findSeatTeachingLesson(
  userId: string,
  courseId: string,
  lessonId: string,
): Promise<{ enrollmentId: string; cohortId: string } | null> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } },
  });
  if (!lesson || lesson.module.courseId !== courseId) return null;

  const seats = await db.enrollment.findMany({
    where: { userId, courseId, status: { in: ["ACTIVE", "COMPLETED"] } },
    select: { id: true, cohortId: true },
    orderBy: [{ approvedAt: "desc" }, { enrolledAt: "desc" }],
  });

  for (const seat of seats) {
    // A cohort with no plan of its own teaches the whole course, so a
    // lesson absent from the table still counts. A cohort WITH a plan is
    // authoritative: a lesson it left out is deliberately not taught, and
    // must not be reachable — otherwise an explicit plan would be a
    // suggestion rather than a boundary.
    const planned = await db.cohortLesson.findUnique({
      where: { cohortId_lessonId: { cohortId: seat.cohortId, lessonId } },
      select: { id: true },
    });
    if (planned) return { enrollmentId: seat.id, cohortId: seat.cohortId };

    const planCount = await db.cohortLesson.count({ where: { cohortId: seat.cohortId } });
    if (planCount === 0) return { enrollmentId: seat.id, cohortId: seat.cohortId };
  }
  return null;
}

/**
 * Recompute a student's course progress as the share of the cohort's
 * curriculum they have completed, and write it to their live seat.
 *
 * Scoped to the cohort's own plan when it has one, so a student is not
 * held back by lessons this intake never teaches. Returns null when the
 * student has no live seat — a pending seat must never be advanced by
 * progress writes.
 */
export async function recomputeProgress(
  userId: string,
  courseId: string,
  cohortId: string,
): Promise<number | null> {
  const enrollment = await db.enrollment.findFirst({
    where: {
      userId,
      courseId,
      cohortId,
      status: { in: ["ACTIVE", "COMPLETED"] },
    },
    select: { id: true, status: true },
  });
  if (!enrollment) return null;

  const curriculum = await getCohortCurriculum(cohortId);
  const lessonIds = curriculum?.lessons.map((l) => l.lessonId) ?? [];
  if (lessonIds.length === 0) return null;

  const completed = await db.lessonProgress.count({
    where: { userId, lessonId: { in: lessonIds } },
  });
  const percent = Math.round((completed / lessonIds.length) * 100);

  await db.enrollment.update({
    where: { id: enrollment.id },
    data: {
      progress: percent,
      status: percent === 100 ? "COMPLETED" : "ACTIVE",
      completedAt: percent === 100 ? new Date() : null,
    },
  });
  return percent;
}
