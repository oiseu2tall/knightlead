// /dashboard/courses/[slug] — module/lesson list with completion state.
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { Card, PageHeader, ProgressBar, Badge } from "@/components/ui/Primitives";
import Link from "next/link";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params; // Next 16: params is a Promise
  const session = await auth();
  const userId = session!.user.id;

  const course = await db.course.findUnique({
    where: { slug },
    include: {
      instructor: { select: { name: true } },
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  // `LessonProgress` only exposes `lessonId` (no `lesson` relation),
  // so we filter by the lesson ids belonging to this course rather
  // than traversing the relation.
  const lessonIds = course?.modules.flatMap((m) => m.lessons.map((l) => l.id)) ?? [];
  const completedLessons = lessonIds.length
    ? await db.lessonProgress.findMany({
        where: { userId, lessonId: { in: lessonIds } },
        select: { lessonId: true },
      })
    : [];

  if (!course || !course.isPublished) notFound();

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
  });
  if (!enrollment) notFound();

  const completed = new Set(completedLessons.map((p) => p.lessonId));
  const totalLessons = course.modules.reduce((n, m) => n + m.lessons.length, 0);

  return (
    <>
      <PageHeader
        title={course.title}
        description={`Taught by ${course.instructor.name ?? "Instructor"}`}
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink">Your progress</p>
            <p className="text-xs text-ink-muted">
              {completed.size} of {totalLessons} lessons complete
            </p>
          </div>
          <div className="w-full max-w-sm">
            <ProgressBar value={enrollment.progress} />
            <p className="mt-1 text-right text-xs font-medium tabular-nums text-ink-muted">
              {enrollment.progress}%
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {course.modules.map((mod) => (
          <Card key={mod.id}>
            <h2 className="mb-3 text-lg font-semibold text-ink">
              Module {mod.order}: {mod.title}
            </h2>
            <ul className="divide-y divide-line">
              {mod.lessons.map((lesson) => {
                const isDone = completed.has(lesson.id);
                return (
                  <li key={lesson.id}>
                    <Link
                      href={`/dashboard/courses/${course.slug}/lessons/${lesson.id}`}
                      className="flex items-center gap-3 py-3 hover:bg-surface-dim -mx-2 px-2 rounded-md"
                    >
                      <span
                        className={[
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                          isDone
                            ? "bg-accent-500 text-ink shadow-[0_0_0_2px_var(--color-accent-100)]"
                            : "border-2 border-line text-ink-muted",
                        ].join(" ")}
                        aria-label={isDone ? "Completed" : "Not started"}
                      >
                        {isDone ? "✓" : ""}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{lesson.title}</p>
                        <p className="text-xs text-ink-muted">
                          {lesson.contentType.toLowerCase().replace("_", " ")}
                          {lesson.durationMin ? ` · ${lesson.durationMin} min` : ""}
                        </p>
                      </div>
                      <Badge tone={isDone ? "success" : "neutral"}>
                        {isDone ? "Done" : "Start"}
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
