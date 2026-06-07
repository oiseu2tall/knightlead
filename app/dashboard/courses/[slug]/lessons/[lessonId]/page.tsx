// /dashboard/courses/[slug]/lessons/[lessonId] — render a single lesson,
// show assignment if present, allow marking complete.
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, PageHeader, Badge } from "@/components/ui/Primitives";
import { MarkCompleteButton } from "./MarkCompleteButton";
import { SubmissionForm } from "./SubmissionForm";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params; // Next 16: Promise
  const session = await auth();
  const userId = session!.user.id;

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: {
        include: {
          course: { select: { id: true, slug: true, title: true, instructorId: true } },
        },
      },
      assignments: true,
    },
  });
  if (!lesson || lesson.module.course.slug !== slug) notFound();

  // Enforce enrollment (any user with a row in Enrollment for this course).
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: lesson.module.course.id } },
  });
  if (!enrollment) notFound();

  const completed = await db.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  });

  // For QUIZ lessons, the instructor will build a separate quiz runner later.
  // For ASSIGNMENT lessons, show the submission form below.

  return (
    <>
      <PageHeader
        title={lesson.title}
        description={`${lesson.module.course.title} · Module ${lesson.module.order}`}
        action={
          <Link
            href={`/dashboard/courses/${slug}`}
            className="text-sm font-medium text-brand-500 hover:text-brand-600"
          >
            ← Back to course
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <Badge tone="info">{lesson.contentType.toLowerCase().replace("_", " ")}</Badge>
            <h2 className="mt-3 text-xl font-bold text-ink">{lesson.title}</h2>
            {lesson.videoUrl && (
              <div className="mt-4 aspect-video w-full overflow-hidden rounded-lg border border-line bg-black">
                <video src={lesson.videoUrl} controls className="h-full w-full" />
              </div>
            )}
            {lesson.content && (
              <div
                className="prose prose-sm mt-4 max-w-none text-ink"
                // Content authored by instructors; rendered as text. For
                // production, sanitize or render Markdown via a vetted
                // library (e.g. react-markdown with rehype-sanitize).
                dangerouslySetInnerHTML={{ __html: escapeHtml(lesson.content).replace(/\n/g, "<br/>") }}
              />
            )}
          </Card>

          {lesson.assignments[0] && (
            <Card>
              <h3 className="text-lg font-semibold text-ink">Assignment</h3>
              <p className="mt-1 text-sm font-medium text-ink">{lesson.assignments[0].title}</p>
              <p className="mt-2 text-sm text-ink-muted">{lesson.assignments[0].prompt}</p>
              {lesson.assignments[0].dueDate && (
                <p className="mt-2 text-xs text-ink-muted">
                  Due: {lesson.assignments[0].dueDate.toLocaleDateString()}
                </p>
              )}
              <div className="mt-4">
                <SubmissionForm
                  assignmentId={lesson.assignments[0].id}
                  maxScore={lesson.assignments[0].maxScore}
                />
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-semibold text-ink">Status</h3>
            {completed ? (
              <>
                <p className="mt-2 text-sm text-green-700">✓ Completed</p>
                <p className="text-xs text-ink-muted">
                  {completed.completedAt.toLocaleDateString()}
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-ink-muted">Not yet complete</p>
                <MarkCompleteButton
                  lessonId={lesson.id}
                  courseSlug={slug}
                  className="mt-3 w-full"
                />
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
