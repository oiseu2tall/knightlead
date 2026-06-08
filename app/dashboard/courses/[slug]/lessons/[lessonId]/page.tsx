// /dashboard/courses/[slug]/lessons/[lessonId] — render a single
// lesson, show assignment if present, allow marking complete.

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, PageHeader, Badge } from "@/components/ui/Primitives";
import { Icon } from "@/components/ui/Icon";
import { SubNav } from "@/components/layout/SubNav";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { MarkCompleteButton } from "./MarkCompleteButton";
import { SubmissionForm } from "./SubmissionForm";
import type { IconName } from "@/components/ui/Icon";

const LEARN_TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "Dashboard" },
  { href: "/dashboard/courses", label: "My courses", icon: "School" },
  { href: "/dashboard/courses/browse", label: "Browse", icon: "Group" },
];

function lessonIconName(t: string): IconName {
  switch (t) {
    case "VIDEO": return "Video";
    case "ARTICLE": return "Article";
    case "QUIZ": return "Quiz";
    case "ASSIGNMENT": return "Assignment";
    default: return "Book";
  }
}

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
      assignments: {
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });
  if (!lesson || lesson.module.course.slug !== slug) notFound();

  // Enforce enrollment.
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: lesson.module.course.id } },
  });
  if (!enrollment) notFound();

  const completed = await db.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  });

  // Pull the user's most recent submission for this assignment (if any)
  // so the form can pre-fill and surface grade/feedback.
  const assignment = lesson.assignments[0] ?? null;
  const submission = assignment
    ? await db.submission.findFirst({
        where: { assignmentId: assignment.id, userId },
        orderBy: { submittedAt: "desc" },
        select: {
          content: true,
          attachments: true,
          status: true,
          score: true,
          feedback: true,
          submittedAt: true,
          gradedAt: true,
        },
      })
    : null;

  const IconName = lessonIconName(lesson.contentType);
  const I = Icon[IconName];

  return (
    <>
      <SubNav items={LEARN_TABS} />

      <Breadcrumb
        items={[
          { label: "Learn", href: "/dashboard" },
          { label: "My courses", href: "/dashboard/courses" },
          { label: lesson.module.course.title, href: `/dashboard/courses/${slug}` },
          { label: lesson.title },
        ]}
      />

      <div className="mt-3 mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            <I className="h-3.5 w-3.5" />
            {lesson.contentType.toLowerCase().replace("_", " ")}
            <span aria-hidden>·</span>
            Module {lesson.module.order}
            {completed && (
              <>
                <span aria-hidden>·</span>
                <span className="text-green-700">completed</span>
              </>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{lesson.title}</h1>
        </div>
        <Link
          href={`/dashboard/courses/${slug}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-dim"
        >
          <Icon.ArrowLeft className="h-4 w-4" />
          Back to course
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            {lesson.videoUrl && (
              <div className="mb-4 aspect-video w-full overflow-hidden rounded-lg border border-line bg-black">
                <video src={lesson.videoUrl} controls className="h-full w-full" />
              </div>
            )}
            {lesson.content && (
              <div
                className="prose prose-sm max-w-none text-ink"
                // Content authored by instructors; rendered as text. For
                // production, sanitize or render Markdown via a vetted
                // library (e.g. react-markdown with rehype-sanitize).
                dangerouslySetInnerHTML={{ __html: renderLessonContent(lesson.content) }}
              />
            )}
            {!lesson.videoUrl && !lesson.content && (
              <p className="text-sm text-ink-muted">No content for this lesson yet.</p>
            )}
          </Card>

          {assignment && (
            <Card>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-ink">Assignment</h2>
                  <p className="mt-0.5 text-sm text-ink-muted">{assignment.title}</p>
                </div>
                {assignment.dueDate && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-ink-muted">
                    <Icon.Calendar className="h-3.5 w-3.5" />
                    Due {assignment.dueDate.toLocaleDateString()}
                  </span>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm text-ink">{assignment.prompt}</p>
              <div className="mt-4 border-t border-line pt-4">
                <SubmissionForm
                  assignmentId={assignment.id}
                  maxScore={assignment.maxScore}
                  existing={
                    submission
                      ? {
                          content: submission.content,
                          attachments: submission.attachments,
                          status: submission.status,
                          score: submission.score,
                          feedback: submission.feedback,
                          submittedAt: submission.submittedAt.toISOString(),
                          gradedAt: submission.gradedAt ? submission.gradedAt.toISOString() : null,
                        }
                      : null
                  }
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
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-green-700">
                  <Icon.Check className="h-4 w-4" /> Completed
                </p>
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

          <Card>
            <h3 className="text-sm font-semibold text-ink">Lesson info</h3>
            <dl className="mt-2 space-y-1.5 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-muted">Type</dt>
                <dd className="font-medium text-ink">
                  {lesson.contentType.toLowerCase().replace("_", " ")}
                </dd>
              </div>
              {lesson.durationMin ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-muted">Duration</dt>
                  <dd className="font-medium text-ink">{lesson.durationMin} min</dd>
                </div>
              ) : null}
              {assignment && (
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-muted">Max score</dt>
                  <dd className="font-medium text-ink">{assignment.maxScore}</dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

// Build escaped HTML for lesson content without putting raw entities
// in the source (some formatters mangle them in string literals).
const AMP = "&" + "amp;";
const LT = "&" + "lt;";
const GT = "&" + "gt;";
const QUOT = "&" + "quot;";
const APOS = "&" + "#39;";

function renderLessonContent(s: string): string {
  return s
    .replace(/&/g, AMP)
    .replace(/</g, LT)
    .replace(/>/g, GT)
    .replace(/"/g, QUOT)
    .replace(/'/g, APOS)
    .replace(/\n/g, "<br/>");
}
