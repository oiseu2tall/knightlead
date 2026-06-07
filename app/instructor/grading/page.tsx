// /instructor/grading — queue of ungraded submissions across the
// instructor's courses.
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui/Primitives";
import { GradingPanel } from "./GradingPanel";

export const metadata = { title: "Grading · Instructor" };

export default async function GradingQueue({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const role = session!.user.role;
  const { status: statusFilter } = await searchParams; // Next 16: Promise

  // Admins see all; instructors see only their own courses.
  const where = role === "ADMIN" ? {} : { assignment: { lesson: { module: { course: { instructorId: userId } } } } };

  const whereWithStatus = statusFilter
    ? { ...where, status: statusFilter as "SUBMITTED" | "GRADED" | "RETURNED" | "LATE" }
    : { ...where, status: "SUBMITTED" as const };

  const submissions = await db.submission.findMany({
    where: whereWithStatus,
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      assignment: {
        select: {
          id: true,
          title: true,
          maxScore: true,
          lesson: {
            select: {
              title: true,
              module: { select: { course: { select: { title: true, slug: true } } } },
            },
          },
        },
      },
    },
    orderBy: { submittedAt: "asc" },
    take: 50,
  });

  return (
    <>
      <PageHeader
        eyebrow="Teach · Grading"
        title="Grading queue"
        description={`${submissions.length} ${submissions.length === 1 ? "submission" : "submissions"} awaiting review`}
        accent="accent"
        action={
          <div className="flex flex-wrap gap-2">
            <a
              href="/instructor/grading?status=SUBMITTED"
              className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-dim"
            >
              Pending
            </a>
            <a
              href="/instructor/grading?status=GRADED"
              className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-dim"
            >
              Graded
            </a>
            <a
              href="/instructor/grading?status=RETURNED"
              className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-dim"
            >
              Returned
            </a>
          </div>
        }
      />
      {submissions.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-muted">Nothing to grade right now. 🎉</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {submissions.map((s) => (
            <GradingPanel
              key={s.id}
              submission={{
                id: s.id,
                content: s.content,
                score: s.score,
                feedback: s.feedback,
                status: s.status,
                submittedAt: s.submittedAt,
                student: s.user,
                assignment: {
                  id: s.assignment.id,
                  title: s.assignment.title,
                  maxScore: s.assignment.maxScore,
                  lessonTitle: s.assignment.lesson.title,
                  courseTitle: s.assignment.lesson.module.course.title,
                  courseSlug: s.assignment.lesson.module.course.slug,
                },
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
