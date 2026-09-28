// /admin/cohorts/[cohortId] — manage what this intake teaches: which
// lessons of its course, in what order, and when each is released.
//
// A cohort with no plan teaches the whole course. Adding the first entry
// switches it to an explicit plan, so the page shows both states rather
// than pretending an empty list means an empty curriculum.
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import CohortCurriculumClient from "./CohortCurriculumClient";

export const metadata = { title: "Cohort curriculum · Catalog" };

export default async function CohortCurriculumPage({
  params,
}: {
  params: Promise<{ cohortId: string }>;
}) {
  const { cohortId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    redirect("/forbidden");
  }

  const cohort = await db.cohort.findUnique({
    where: { id: cohortId },
    select: {
      id: true,
      name: true,
      slug: true,
      startDate: true,
      endDate: true,
      courseId: true,
      course: { select: { id: true, title: true, slug: true } },
    },
  });
  if (!cohort) notFound();

  // The pool a plan is drawn from: every lesson of this cohort's course.
  // Restricting to the course here is what makes the cross-course guard
  // in the server action unreachable from this UI.
  const courseLessons = await db.lesson.findMany({
    where: { module: { courseId: cohort.courseId } },
    orderBy: [{ module: { order: "asc" } }, { order: "asc" }],
    select: {
      id: true,
      title: true,
      order: true,
      contentType: true,
      durationMin: true,
      module: { select: { id: true, title: true, order: true } },
    },
  });

  const plan = await db.cohortLesson.findMany({
    where: { cohortId },
    orderBy: { order: "asc" },
    select: {
      id: true,
      lessonId: true,
      order: true,
      releaseAt: true,
      lesson: {
        select: {
          id: true,
          title: true,
          order: true,
          contentType: true,
          durationMin: true,
          module: { select: { id: true, title: true, order: true } },
        },
      },
    },
  });

  return (
    <CohortCurriculumClient
      cohort={{
        id: cohort.id,
        name: cohort.name,
        slug: cohort.slug,
        startDate: cohort.startDate.toISOString(),
        endDate: cohort.endDate.toISOString(),
        course: cohort.course,
      }}
      courseLessons={courseLessons}
      plan={plan.map((p) => ({
        id: p.id,
        lessonId: p.lessonId,
        order: p.order,
        releaseAt: p.releaseAt ? p.releaseAt.toISOString() : null,
        lesson: {
          id: p.lesson.id,
          title: p.lesson.title,
          order: p.lesson.order,
          contentType: p.lesson.contentType,
          durationMin: p.lesson.durationMin,
          module: p.lesson.module,
        },
      }))}
    />
  );
}
