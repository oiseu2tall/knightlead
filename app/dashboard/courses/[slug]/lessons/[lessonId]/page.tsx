// /dashboard/courses/[slug]/lessons/[lessonId] — render a single
// lesson from a student's cohort curriculum, show the parent module's
// assessments, and allow marking the lesson complete.

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Primitives";
import { Icon } from "@/components/ui/Icon";
import { SubNav } from "@/components/layout/SubNav";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import {
  ModuleAssignmentsPanel,
  type ModuleAssignmentView,
} from "@/components/assignments/ModuleAssignmentsPanel";
import { signToken } from "@/lib/storage";
import { findLiveEnrollment, canPreviewCourseContent } from "@/lib/auth-guard";
import { getCohortCurriculum, findInCurriculum, isLessonReleased } from "@/lib/curriculum";
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
          course: {
            select: { id: true, slug: true, title: true, instructorId: true, isPublished: true },
          },
        },
      },
      // A lesson may carry several videos: a talk split into parts, a
      // recording plus a demo. Ordered, not singular.
      videos: { orderBy: { order: "asc" } },
    },
  });
  if (!lesson || lesson.module.course.slug !== slug) notFound();

  // Signed URLs for the lesson's videos. Built before the enrollment gate
  // because the admin preview renders them too.
  const videos = lesson.videos.map((v) => ({
    id: v.id,
    title: v.title,
    description: v.description,
    durationMin: v.durationMin,
    src: v.fileKey
      ? `/api/files/download/${encodeURIComponent(v.fileKey)}?t=${signToken(v.fileKey)}`
      : v.url,
  }));

  // Enforce enrollment. Access comes from an approved cohort seat: a
  // PENDING seat means the student can't reach course content until a
  // manager/admin activates it, and DROPPED/SUSPENDED seats are revoked.
  const enrollment = await findLiveEnrollment(userId, lesson.module.course.id);
  if (!enrollment) {
    // An admin holds no seat, so without this they could never inspect a
    // lesson they are responsible for. Preview is read-only: content and
    // videos render, but there is no progress to record and no module work
    // to submit, because neither belongs to a seat they don't have.
    if (canPreviewCourseContent(session!.user.role)) {
      // Mirror the course page: an unpublished course isn't previewable,
      // so a lesson can't become reachable by guessing its id.
      if (!lesson.module.course.isPublished) notFound();
      return renderPreview(lesson, slug, videos);
    }
    notFound();
  }

  // The seat also decides *which* lessons exist for this student. A
  // cohort teaches its own plan, so a lesson outside the plan is not part
  // of this intake even though it belongs to the course.
  const curriculum = await getCohortCurriculum(enrollment.cohortId);
  const inPlan = curriculum ? findInCurriculum(curriculum, lessonId) : undefined;
  if (!inPlan) notFound();

  // A scheduled lesson stays locked until its release time, and a locked
  // lesson's content is never rendered.
  if (!isLessonReleased(inPlan)) notFound();

  const completed = await db.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  });

  // Assessments belong to the module, not to this lesson, so the student
  // is shown the whole module's set rather than one arbitrarily chosen
  // assignment.
  const assignments = await db.assignment.findMany({
    where: { moduleId: lesson.moduleId },
    orderBy: { dueDate: "asc" },
  });

  const submissions = assignments.length
    ? await db.submission.findMany({
        where: { userId, assignmentId: { in: assignments.map((a) => a.id) } },
        orderBy: { submittedAt: "desc" },
        select: {
          assignmentId: true,
          content: true,
          attachments: true,
          status: true,
          score: true,
          feedback: true,
          submittedAt: true,
          gradedAt: true,
        },
      })
    : [];
  // A module may have more than one assignment; the latest submission per
  // assignment is the one the form should pre-fill.
  const submissionByAssignment = new Map<string, (typeof submissions)[number]>();
  for (const s of submissions) {
    if (!submissionByAssignment.has(s.assignmentId)) {
      submissionByAssignment.set(s.assignmentId, s);
    }
  }

  // Signed URLs for uploaded videos and assignment files. Assignment
  // attachments are signed here rather than in the panel, because
  // signToken needs node:crypto and the panel is a client component.
  const assignmentViews: ModuleAssignmentView[] = assignments.map((assignment) => {
    const submission = submissionByAssignment.get(assignment.id) ?? null;
    return {
      id: assignment.id,
      title: assignment.title,
      prompt: assignment.prompt,
      dueDate: assignment.dueDate ? assignment.dueDate.toISOString() : null,
      maxScore: assignment.maxScore,
      files: assignment.attachments.map((key) => ({
        key,
        name: key.split("/").pop() ?? key,
        url: `/api/files/download/${encodeURIComponent(key)}?t=${signToken(key)}`,
      })),
      submission: submission
        ? {
            content: submission.content,
            attachments: submission.attachments,
            status: submission.status,
            score: submission.score,
            feedback: submission.feedback,
            submittedAt: submission.submittedAt.toISOString(),
            gradedAt: submission.gradedAt ? submission.gradedAt.toISOString() : null,
          }
        : null,
    };
  });

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
            {lesson.module.title}
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
            {videos.map((v) => (
              <div key={v.id} className="mb-4 last:mb-0">
                <div className="aspect-video w-full overflow-hidden rounded-lg border border-line bg-black">
                  <video src={v.src ?? undefined} controls preload="metadata" className="h-full w-full">
                    Your browser does not support video playback.
                  </video>
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium text-ink">{v.title}</p>
                  {v.durationMin && (
                    <span className="shrink-0 text-xs text-ink-muted">{v.durationMin} min</span>
                  )}
                </div>
                {v.description && (
                  <p className="mt-0.5 text-xs text-ink-muted">{v.description}</p>
                )}
              </div>
            ))}
            {lesson.content && (
              <div
                className={`prose prose-sm max-w-none text-ink ${videos.length > 0 ? "mt-4 border-t border-line pt-4" : ""}`}
                // Content authored by instructors; rendered as text. For
                // production, sanitize or render Markdown via a vetted
                // library (e.g. react-markdown with rehype-sanitize).
                dangerouslySetInnerHTML={{ __html: renderLessonContent(lesson.content) }}
              />
            )}
            {videos.length === 0 && !lesson.content && (
              <p className="text-sm text-ink-muted">No content for this lesson yet.</p>
            )}
          </Card>

          {assignmentViews.length > 0 && (
            <Card>
              <ModuleAssignmentsPanel
                moduleTitle={lesson.module.title}
                assignments={assignmentViews}
              />
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
                {submissions.some((s) => s.status === "GRADED") && (
                  <p className="mt-2 text-xs text-green-700">
                    Assignment graded — this module&apos;s lessons marked complete
                  </p>
                )}
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
              {videos.length > 0 && (
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-muted">Videos</dt>
                  <dd className="font-medium text-ink">{videos.length}</dd>
                </div>
              )}
              {lesson.durationMin ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-muted">Duration</dt>
                  <dd className="font-medium text-ink">{lesson.durationMin} min</dd>
                </div>
              ) : null}
              {assignments.length > 0 && (
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-muted">Module work</dt>
                  <dd className="font-medium text-ink">
                    {assignments.length} assignment{assignments.length === 1 ? "" : "s"}
                  </dd>
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

/**
 * Read-only lesson view for an admin holding no seat.
 *
 * Content and videos render exactly as a student would see them, minus
 * the two things that require an enrollment: the completion control and
 * the module's submission forms. The banner states which is why.
 */
function renderPreview(
  lesson: {
    id: string;
    title: string;
    content: string | null;
    contentType: string;
    durationMin: number | null;
    module: { title: string; course: { title: string } };
  },
  slug: string,
  videos: Array<{
    id: string;
    title: string;
    description: string | null;
    durationMin: number | null;
    src: string | null;
  }>,
) {
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
            {lesson.module.title}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {lesson.title}
          </h1>
        </div>
        <Link
          href={`/dashboard/courses/${slug}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-dim"
        >
          <Icon.ArrowLeft className="h-4 w-4" />
          Back to course
        </Link>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <Icon.Settings className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <span className="font-semibold">Preview mode.</span> Read-only: you
          hold no seat in this course, so this lesson can&apos;t be marked
          complete and its module&apos;s assignments are not shown.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            {videos.map((v) => (
              <div key={v.id} className="mb-4 last:mb-0">
                <div className="aspect-video w-full overflow-hidden rounded-lg border border-line bg-black">
                  <video src={v.src ?? undefined} controls preload="metadata" className="h-full w-full">
                    Your browser does not support video playback.
                  </video>
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium text-ink">{v.title}</p>
                  {v.durationMin && (
                    <span className="shrink-0 text-xs text-ink-muted">{v.durationMin} min</span>
                  )}
                </div>
                {v.description && (
                  <p className="mt-0.5 text-xs text-ink-muted">{v.description}</p>
                )}
              </div>
            ))}
            {lesson.content && (
              <div
                className={`prose prose-sm max-w-none text-ink ${videos.length > 0 ? "mt-4 border-t border-line pt-4" : ""}`}
                dangerouslySetInnerHTML={{ __html: renderLessonContent(lesson.content) }}
              />
            )}
            {videos.length === 0 && !lesson.content && (
              <p className="text-sm text-ink-muted">No content for this lesson yet.</p>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-semibold text-ink">Lesson info</h3>
            <dl className="mt-2 space-y-1.5 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-muted">Type</dt>
                <dd className="font-medium text-ink">
                  {lesson.contentType.toLowerCase().replace("_", " ")}
                </dd>
              </div>
              {videos.length > 0 && (
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-muted">Videos</dt>
                  <dd className="font-medium text-ink">{videos.length}</dd>
                </div>
              )}
              {lesson.durationMin ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-muted">Duration</dt>
                  <dd className="font-medium text-ink">{lesson.durationMin} min</dd>
                </div>
              ) : null}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

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
