// /dashboard/courses/[slug] — student course view: modules with
// completion state, per-module progress, and a sticky progress bar.

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, ProgressBar, Badge } from "@/components/ui/Primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubNav } from "@/components/layout/SubNav";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Icon, type IconName } from "@/components/ui/Icon";
import { signToken } from "@/lib/storage";
import { getCourseAccess, canPreviewCourseContent } from "@/lib/auth-guard";
import { getCohortCurriculum, getCourseCurriculum, isLessonReleased } from "@/lib/curriculum";
import { ModuleFileLinks } from "@/components/files/ModuleFileLinks";
import { CoursePreview } from "@/components/courses/CoursePreview";
import {
  ModuleAssignmentsPanel,
  type ModuleAssignmentView,
} from "@/components/assignments/ModuleAssignmentsPanel";

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

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  // Lets /dashboard/assignments deep-link straight to a module's work.
  searchParams: Promise<{ module?: string }>;
}) {
  const { slug } = await params; // Next 16: params is a Promise
  const { module: focusModuleId } = await searchParams;
  const session = await auth();
  const userId = session!.user.id;

  const course = await db.course.findUnique({
    where: { slug },
    include: {
      instructor: { select: { name: true } },
    },
  });

  if (!course || !course.isPublished) notFound();

  const access = await getCourseAccess(userId, course.id);
  const enrollment = access.enrollmentId
    ? { id: access.enrollmentId, status: access.status, progress: access.progress }
    : null;

  // If the course exists + is published but the user isn't enrolled,
  // show an enrollment prompt instead of 404-ing.
  if (!enrollment) {
    // ADMIN holds no seat by design, so "not enrolled" would otherwise
    // hide the curriculum of every course they are responsible for. Give
    // them a read-only preview rather than an enrollment prompt they can
    // never act on.
    if (canPreviewCourseContent(session!.user.role)) {
      const [preview, previewAssignments] = await Promise.all([
        getCourseCurriculum(course.id),
        db.assignment.findMany({
          where: { module: { courseId: course.id } },
          select: { moduleId: true },
        }),
      ]);
      const assignmentCountByModule = new Map<string, number>();
      for (const a of previewAssignments) {
        assignmentCountByModule.set(
          a.moduleId,
          (assignmentCountByModule.get(a.moduleId) ?? 0) + 1,
        );
      }

      return (
        <>
          <SubNav items={LEARN_TABS} />
          <Breadcrumb
            items={[
              { label: "Learn", href: "/dashboard" },
              { label: "My courses", href: "/dashboard/courses" },
              { label: course.title },
            ]}
          />
          <div className="mt-3 mb-6">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              <span>Course</span>
              <Badge tone="neutral">admin preview</Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {course.title}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              Taught by{" "}
              <span className="font-medium text-ink">
                {course.instructor.name ?? "Instructor"}
              </span>
            </p>
          </div>
          <CoursePreview
            courseSlug={course.slug}
            courseTitle={course.title}
            curriculum={preview}
            assignmentCountByModule={assignmentCountByModule}
          />
        </>
      );
    }

    return (
      <>
        <SubNav items={LEARN_TABS} />

        <Breadcrumb
          items={[
            { label: "Learn", href: "/dashboard" },
            { label: "My courses", href: "/dashboard/courses" },
            { label: course.title },
          ]}
        />

        <div className="mt-3 mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              <span>Course</span>
              <Badge tone="neutral">not enrolled</Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{course.title}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Taught by{" "}
              <span className="font-medium text-ink">
                {course.instructor.name ?? "Instructor"}
              </span>
            </p>
          </div>
          <Link
            href="/dashboard/courses"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-dim"
          >
            <Icon.ArrowLeft className="h-4 w-4" />
            My courses
          </Link>
        </div>

        <EmptyState
          icon="School"
          title="You're not enrolled yet"
          description="Enroll to access modules and track your lesson progress."
          action={
            course.isPublished
              ? { label: "Browse catalog", href: "/dashboard/courses/browse" }
              : undefined
          }

        />
      </>
    );
  }

  // Self-enrollments start in PENDING: the student can't access course
  // content until a manager or admin activates the enrollment.
  if (enrollment.status === "PENDING") {
    return (
      <>
        <SubNav items={LEARN_TABS} />

        <Breadcrumb
          items={[
            { label: "Learn", href: "/dashboard" },
            { label: "My courses", href: "/dashboard/courses" },
            { label: course.title },
          ]}
        />

        <div className="mt-3 mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              <span>Course</span>
              <Badge tone="warning">pending approval</Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{course.title}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Taught by{" "}
              <span className="font-medium text-ink">
                {course.instructor.name ?? "Instructor"}
              </span>
            </p>
          </div>
          <Link
            href="/dashboard/courses"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-dim"
          >
            <Icon.ArrowLeft className="h-4 w-4" />
            My courses
          </Link>
        </div>

        <EmptyState
          icon="Clock"
          title="Enrollment pending approval"
          description="You've requested enrollment in this course. A manager or admin must activate your enrollment before you can access modules, lessons, and assignments."
          action={{ label: "Back to my courses", href: "/dashboard/courses" }}
        />
      </>
    );
  }

  // What this student sees is their intake's curriculum, not the whole
  // course: a cohort may teach a subset, in its own order, with lessons
  // released over time. The plan falls back to the full course when the
  // cohort has none of its own.
  const cohortId = access.cohortId!;
  const curriculum = await getCohortCurriculum(cohortId);

  // Module-level metadata (downloadable files) for the modules the
  // plan actually touches.
  const planModuleIds = curriculum?.modules.map((m) => m.moduleId) ?? [];
  const [moduleRows, assignments] = await Promise.all([
    planModuleIds.length
      ? db.module.findMany({
          where: { id: { in: planModuleIds } },
          select: { id: true, fileKey: true, fileName: true },
        })
      : Promise.resolve([]),
    // Module assessments, restricted to modules this intake delivers.
    planModuleIds.length
      ? db.assignment.findMany({
          where: { moduleId: { in: planModuleIds } },
          select: { id: true, moduleId: true, title: true, dueDate: true, maxScore: true },
        })
      : Promise.resolve([]),
  ]);
  const moduleById = new Map(moduleRows.map((m) => [m.id, m]));

  const planLessons = curriculum?.lessons ?? [];
  const lessonIds = planLessons.map((l) => l.lessonId);
  const completedLessons = lessonIds.length
    ? await db.lessonProgress.findMany({
        where: { userId, lessonId: { in: lessonIds } },
        select: { lessonId: true },
      })
    : [];

  const submissions = assignments.length
    ? await db.submission.findMany({
        where: { userId, assignmentId: { in: assignments.map((a) => a.id) } },
        select: { assignmentId: true, status: true, score: true },
      })
    : [];
  const submissionByAssignment = new Map(submissions.map((s) => [s.assignmentId, s]));

  // Deep-link from /dashboard/assignments: when the URL names a module
  // this intake actually delivers, expand it with full submission forms.
  // Ignored for a module outside the plan, so the param can't be used to
  // surface work this cohort doesn't teach.
  const focusedModuleId =
    focusModuleId && curriculum?.modules.some((m) => m.moduleId === focusModuleId)
      ? focusModuleId
      : null;

  const focusedAssignments = focusedModuleId
    ? await db.assignment.findMany({
        where: { moduleId: focusedModuleId },
        orderBy: { dueDate: "asc" },
        select: {
          id: true,
          title: true,
          prompt: true,
          dueDate: true,
          maxScore: true,
          attachments: true,
        },
      })
    : [];

  const focusedSubmissions = focusedAssignments.length
    ? await db.submission.findMany({
        where: { userId, assignmentId: { in: focusedAssignments.map((a) => a.id) } },
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
  const focusedSubmissionByAssignment = new Map<string, (typeof focusedSubmissions)[number]>();
  for (const s of focusedSubmissions) {
    if (!focusedSubmissionByAssignment.has(s.assignmentId)) {
      focusedSubmissionByAssignment.set(s.assignmentId, s);
    }
  }

  const focusedViews: ModuleAssignmentView[] = focusedAssignments.map((a) => {
    const sub = focusedSubmissionByAssignment.get(a.id) ?? null;
    return {
      id: a.id,
      title: a.title,
      prompt: a.prompt,
      dueDate: a.dueDate ? a.dueDate.toISOString() : null,
      maxScore: a.maxScore,
      files: a.attachments.map((key) => ({
        key,
        name: key.split("/").pop() ?? key,
        url: `/api/files/download/${encodeURIComponent(key)}?t=${signToken(key)}`,
      })),
      submission: sub
        ? {
            content: sub.content,
            attachments: sub.attachments,
            status: sub.status,
            score: sub.score,
            feedback: sub.feedback,
            submittedAt: sub.submittedAt.toISOString(),
            gradedAt: sub.gradedAt ? sub.gradedAt.toISOString() : null,
          }
        : null,
    };
  });

  const completed = new Set(completedLessons.map((p) => p.lessonId));
  const totalLessons = planLessons.length;
  const completedCount = planLessons.filter((l) => completed.has(l.lessonId)).length;
  const now = new Date();

  return (
    <>
      <SubNav items={LEARN_TABS} />

      <Breadcrumb
        items={[
          { label: "Learn", href: "/dashboard" },
          { label: "My courses", href: "/dashboard/courses" },
          { label: course.title },
        ]}
      />

      <div className="mt-3 mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            <span>Course</span>
            {enrollment.status === "COMPLETED" && <Badge tone="success">completed</Badge>}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{course.title}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Taught by{" "}
            <span className="font-medium text-ink">
              {course.instructor.name ?? "Instructor"}
            </span>
            {access.cohortName && (
              <>
                {" · "}
                <span className="font-medium text-ink">{access.cohortName}</span>
              </>
            )}
          </p>
        </div>
        <Link
          href="/dashboard/courses"
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-dim"
        >
          <Icon.ArrowLeft className="h-4 w-4" />
          My courses
        </Link>
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink">Your progress</p>
            <p className="text-xs text-ink-muted">
              {completedCount} of {totalLessons} lessons complete
              {curriculum?.hasOwnPlan ? " in this cohort's plan" : ""}
            </p>
          </div>
          <div className="flex w-full max-w-sm flex-col gap-1">
            <ProgressBar value={enrollment.progress} />
            <p className="self-end text-xs font-medium tabular-nums text-ink-muted">
              {enrollment.progress}%
            </p>
          </div>
        </div>
      </Card>

      {curriculum?.modules.length === 0 ? (
        <EmptyState
          icon="Layers"
          title="No modules yet"
          description="The instructor hasn't published any modules in this course yet."
        />
      ) : (
        <div className="space-y-4">
          {curriculum?.modules.map((mod) => {
            const modDone = mod.lessons.filter((l) => completed.has(l.lessonId)).length;
            const modTotal = mod.lessons.length;
            const modPct = modTotal > 0 ? Math.round((modDone / modTotal) * 100) : 0;
            const meta = moduleById.get(mod.moduleId);

            const fileUrl = meta?.fileKey
              ? `/api/files/download/${encodeURIComponent(meta.fileKey)}?t=${signToken(meta.fileKey)}`
              : null;

            const modAssignments = assignments.filter((a) => a.moduleId === mod.moduleId);

            return (
              <Card key={mod.moduleId}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                      <span>Module {mod.order}</span>
                      {modPct === 100 && <Badge tone="success">done</Badge>}
                      {modPct > 0 && modPct < 100 && <Badge tone="info">in progress</Badge>}
                    </div>
                    <h2 className="mt-0.5 text-lg font-semibold text-ink">{mod.moduleTitle}</h2>

                    {meta?.fileKey && meta.fileName && fileUrl && (
                      <div className="mt-2">
                        <ModuleFileLinks fileUrl={fileUrl} fileName={meta.fileName} />
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-[140px] flex-col items-end gap-1">
                    <span className="text-xs tabular-nums text-ink-muted">
                      {modDone}/{modTotal} lessons
                    </span>
                    <div className="w-32">
                      <ProgressBar value={modPct} />
                    </div>
                  </div>
                </div>
                <ul className="divide-y divide-line">
                  {mod.lessons.map((lesson) => {
                    const isDone = completed.has(lesson.lessonId);
                    const released = isLessonReleased(lesson, now);
                    const IconName = lessonIconName(lesson.contentType);
                    const I = Icon[IconName];
                    // A locked lesson is listed so the student can see what
                    // is coming, but is not a link — its content is not
                    // reachable until the release time.
                    const rowInner = (
                      <>
                        <span
                          className={[
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                            isDone
                              ? "bg-accent-500 text-ink shadow-[0_0_0_2px_var(--color-accent-100)]"
                              : released
                                ? "border border-line bg-surface text-ink-muted"
                                : "border border-line bg-surface-dim text-ink-muted/50",
                          ].join(" ")}
                          aria-label={isDone ? "Completed" : released ? "Not started" : "Not yet released"}
                        >
                          {isDone ? <Icon.Check className="h-4 w-4" /> : released ? <I className="h-4 w-4" /> : <Icon.Clock className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{lesson.lessonTitle}</p>
                          <p className="text-xs text-ink-muted">
                            {lesson.contentType.toLowerCase().replace("_", " ")}
                            {lesson.durationMin ? ` · ${lesson.durationMin} min` : ""}
                            {!released && lesson.releaseAt
                              ? ` · unlocks ${lesson.releaseAt.toLocaleDateString()}`
                              : ""}
                          </p>
                        </div>
                        <Badge tone={isDone ? "success" : released ? "neutral" : "warning"}>
                          {isDone ? "Done" : released ? "Start" : "Locked"}
                        </Badge>
                      </>
                    );

                    return (
                      <li key={lesson.lessonId}>
                        {released ? (
                          <Link
                            href={`/dashboard/courses/${course.slug}/lessons/${lesson.lessonId}`}
                            className="flex items-center gap-3 -mx-2 rounded-md px-2 py-3 hover:bg-surface-dim"
                          >
                            {rowInner}
                          </Link>
                        ) : (
                          <div className="flex items-center gap-3 px-2 py-3 opacity-70">
                            {rowInner}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {mod.moduleId === focusedModuleId ? (
                  // Deep-linked from /dashboard/assignments: show the
                  // actual work, not the summary row.
                  <div className="mt-4 border-t border-line pt-4">
                    <ModuleAssignmentsPanel
                      moduleTitle={mod.moduleTitle}
                      assignments={focusedViews}
                    />
                  </div>
                ) : modAssignments.length > 0 ? (
                  <div className="mt-4 border-t border-line pt-4">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                      Module assignments
                    </h3>
                    <ul className="space-y-1.5">
                      {modAssignments.map((a) => {
                        const sub = submissionByAssignment.get(a.id);
                        const overdue = !sub && a.dueDate && a.dueDate < now;
                        return (
                          <li key={a.id} className="flex flex-wrap items-center gap-2 text-xs">
                            <Icon.Assignment className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                            <span className="font-medium text-ink">{a.title}</span>
                            {a.dueDate && (
                              <span className={overdue ? "text-amber-700" : "text-ink-muted"}>
                                due {a.dueDate.toLocaleDateString()}
                              </span>
                            )}
                            {/* Not a link: submitting happens in the module's
                                panel or on a lesson page, not from this summary. */}
                            <span className="ml-auto">
                              <Badge tone={
                                sub?.status === "GRADED" ? "success"
                                : sub?.status === "SUBMITTED" ? "info"
                                : overdue ? "warning" : "neutral"
                              }>
                                {sub
                                  ? sub.status === "GRADED" && sub.score != null
                                    ? `${sub.score}/${a.maxScore}`
                                    : sub.status.toLowerCase()
                                  : "not submitted"}
                              </Badge>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-3 text-xs text-ink-muted">
                      Open any lesson in this module to submit, or{" "}
                      <Link
                        href={`/dashboard/courses/${course.slug}?module=${mod.moduleId}`}
                        className="text-brand-600 hover:underline"
                      >
                        view this module&apos;s work here
                      </Link>
                      .
                    </p>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
