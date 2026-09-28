"use client";

// /admin/courses/[slug]/modules/[moduleId] — module detail with
// lessons, their videos, and module-level assessments for MANAGER + ADMIN.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, Badge } from "@/components/ui/Primitives";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { SubNav } from "@/components/layout/SubNav";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LessonFormFields, type LessonFormData } from "./LessonForm";
import { LessonVideoFormFields, type LessonVideoFormData } from "./LessonVideoForm";
import { AssignmentFormFields, type AssignmentFormData } from "./AssignmentForm";
import { AssignmentFileLinks } from "@/components/files/AssignmentFileLinks";
import { deleteAssignment, deleteLesson, deleteLessonVideo } from "../../../../catalog/actions";

type Lesson = {
  id: string;
  title: string;
  contentType: string;
  content: string | null;
  durationMin: number | null;
  order: number;
  isFree: boolean;
};

type LessonVideo = {
  id: string;
  lessonId: string;
  lessonTitle: string;
  title: string;
  description: string | null;
  url: string | null;
  fileKey: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileType: string | null;
  durationMin: number | null;
  order: number;
  fileUrl: string | null;
};

type Assignment = {
  id: string;
  title: string;
  prompt: string;
  dueDate: Date | null;
  maxScore: number;
  attachments: string[];
  submissionCount: number;
  files: Array<{ key: string; name: string; url: string }>;
};

type Quiz = {
  id: string;
  title: string;
  description: string | null;
  timeLimit: number | null;
  passingScore: number;
  questionCount: number;
  attemptCount: number;
};

type Module = {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
  assignments: Assignment[];
  quizzes: Quiz[];
  videos: LessonVideo[];
};

type Course = { id: string; title: string; slug: string };

type Props = {
  course: Course;
  module: Module;
  role: "MANAGER" | "ADMIN";
};

export default function ModuleAssignmentsClient({ course, module: mod, role: _role }: Props) {
  const router = useRouter();
  const [createLessonOpen, setCreateLessonOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [createAssignmentOpen, setCreateAssignmentOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [createVideoFor, setCreateVideoFor] = useState<Lesson | null>(null);
  const [editingVideo, setEditingVideo] = useState<LessonVideo | null>(null);

  const subNavItems = [
    { href: `/admin/courses/${course.slug}`, label: "Modules", icon: "Layers" as IconName },
  ];

  const nextLessonOrder = mod.lessons.length === 0 ? 1 : Math.max(...mod.lessons.map((l) => l.order)) + 1;

  function lessonToFormData(l: Lesson): LessonFormData {
    return {
      id: l.id,
      moduleId: mod.id,
      title: l.title,
      contentType: l.contentType,
      content: l.content ?? undefined,
      durationMin: l.durationMin ?? undefined,
      order: l.order,
      isFree: l.isFree,
    };
  }

  function videoToFormData(v: LessonVideo): LessonVideoFormData {
    return {
      id: v.id,
      title: v.title,
      description: v.description ?? undefined,
      url: v.url ?? undefined,
      fileKey: v.fileKey ?? undefined,
      fileName: v.fileName ?? undefined,
      fileSize: v.fileSize ?? undefined,
      fileType: v.fileType ?? undefined,
      durationMin: v.durationMin ?? undefined,
      order: v.order,
    };
  }

  function assignmentToFormData(a: Assignment): AssignmentFormData {
    return {
      id: a.id,
      title: a.title,
      prompt: a.prompt,
      dueDate: a.dueDate ? a.dueDate.toISOString() : undefined,
      maxScore: a.maxScore,
      attachments: a.attachments,
    };
  }

  function videosFor(lessonId: string) {
    return mod.videos.filter((v) => v.lessonId === lessonId).sort((a, b) => a.order - b.order);
  }

  function nextVideoOrder(lessonId: string) {
    const existing = videosFor(lessonId);
    return existing.length === 0 ? 0 : Math.max(...existing.map((v) => v.order)) + 1;
  }

  const onDeleteVideo = async (v: LessonVideo) => {
    if (!confirm(`Delete video "${v.title}"?`)) return;
    const fd = new FormData();
    fd.set("id", v.id);
    const res = await deleteLessonVideo(fd);
    if (!res.ok) { alert(res.error); return; }
    router.refresh();
  };

  return (
    <>
      <SubNav items={subNavItems} />

      <Breadcrumb
        items={[
          { label: "Manage", href: "/admin" },
          { label: "Courses", href: "/admin/courses" },
          { label: course.title, href: `/admin/courses/${course.slug}` },
          { label: `Module ${mod.order}` },
        ]}
      />

      <div className="mt-3 mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            <span>Module {mod.order}</span>
            <span>·</span>
            <span>{mod.lessons.length} lessons</span>
            <span>·</span>
            <span>{mod.videos.length} videos</span>
            <span>·</span>
            <span>{mod.assignments.length} assignments</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{mod.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/courses/${course.slug}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-dim"
          >
            <Icon.ArrowLeft className="h-4 w-4" />
            All modules
          </Link>
          <Button type="button" size="sm" onClick={() => setCreateLessonOpen(true)}>
            <Icon.Plus className="h-4 w-4" />
            Add lesson
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setCreateAssignmentOpen(true)}>
            <Icon.Plus className="h-4 w-4" />
            Add assignment
          </Button>
        </div>
      </div>

      {mod.lessons.length === 0 ? (
        <EmptyState
          icon="Book"
          title="No lessons yet"
          description="Lessons are the building blocks of a module. Add the first one to start organizing content."
          action={{ label: "Add lesson", onClick: () => setCreateLessonOpen(true) }}
        />
      ) : (
        <div className="kl-virtualize space-y-3 mb-8">
          {mod.lessons.map((l) => {
            const videos = videosFor(l.id);
            return (
              <Card key={l.id} className="card-hover">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-200">
                    {l.order}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-ink">{l.title}</p>
                      {l.isFree && <Badge tone="success">Free</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">
                      {l.contentType.toLowerCase().replace("_", " ")}
                      {l.durationMin ? ` · ${l.durationMin} min` : ""}
                      {videos.length > 0 ? ` · ${videos.length} video${videos.length === 1 ? "" : "s"}` : ""}
                    </p>
                    {l.content && (
                      <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{l.content}</p>
                    )}

                    {videos.length > 0 && (
                      <ul className="mt-3 space-y-1.5 border-l-2 border-line pl-3">
                        {videos.map((v) => (
                          <li key={v.id} className="flex items-center gap-2 text-xs">
                            <Icon.Play className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                            <span className="truncate text-ink">{v.title}</span>
                            <span className="shrink-0 text-ink-muted">
                              {v.durationMin ? `${v.durationMin} min` : v.url ? "link" : "file"}
                            </span>
                            <span className="ml-auto flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingVideo(v)}
                                className="text-ink-muted hover:text-brand-600"
                                aria-label={`Edit video ${v.title}`}
                              >
                                <Icon.Edit className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteVideo(v)}
                                className="text-ink-muted hover:text-red-600"
                                aria-label={`Delete video ${v.title}`}
                              >
                                <Icon.Trash className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <DropdownMenu
                      ariaLabel={`Actions for lesson ${l.title}`}
                      items={[
                        {
                          label: "Edit lesson",
                          icon: <Icon.Edit className="h-4 w-4" />,
                          onClick: () => setEditingLesson(l),
                        },
                        {
                          label: "Add video",
                          icon: <Icon.Plus className="h-4 w-4" />,
                          onClick: () => setCreateVideoFor(l),
                        },
                        { kind: "separator" },
                        {
                          label: "Delete",
                          icon: <Icon.Trash className="h-4 w-4" />,
                          danger: true,
                          onClick: async () => {
                            if (!confirm(`Delete lesson "${l.title}"? Its videos will also be removed.`)) return;
                            const fd = new FormData();
                            fd.set("id", l.id);
                            const res = await deleteLesson(fd);
                            if (!res.ok) { alert(res.error); return; }
                            router.refresh();
                          },
                        },
                      ]}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <h2 className="mb-3 mt-2 text-sm font-semibold uppercase tracking-[0.12em] text-ink-muted">
        Assessments
      </h2>

      {mod.assignments.length === 0 && mod.quizzes.length === 0 ? (
        <EmptyState
          icon="Assignment"
          title="No assessments yet"
          description="Assignments and quizzes belong to this module, covering its lessons as a whole."
          action={{ label: "Add assignment", onClick: () => setCreateAssignmentOpen(true) }}
        />
      ) : (
        <div className="kl-virtualize space-y-3">
          {mod.assignments.map((a) => (
            <Card key={a.id} className="card-hover">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-50 font-semibold text-accent-700 dark:bg-accent-500/10 dark:text-accent-200">
                  <Icon.Assignment className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{a.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{a.prompt}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                    <span>Max {a.maxScore} pts</span>
                    {a.dueDate && (
                      <>
                        <span>·</span>
                        <span>Due {new Date(a.dueDate).toLocaleString()}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{a.submissionCount} submission{a.submissionCount === 1 ? "" : "s"}</span>
                    {a.attachments.length > 0 && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Icon.File className="h-3.5 w-3.5" />
                          {a.attachments.length} file{a.attachments.length === 1 ? "" : "s"}
                        </span>
                      </>
                    )}
                  </div>
                  <AssignmentFileLinks files={a.files} />
                </div>
                <div className="flex items-center gap-2">
                  <DropdownMenu
                    ariaLabel={`Actions for assignment ${a.title}`}
                    items={[
                      {
                        label: "Edit",
                        icon: <Icon.Edit className="h-4 w-4" />,
                        onClick: () => setEditingAssignment(a),
                      },
                      { kind: "separator" },
                      {
                        label: "Delete",
                        icon: <Icon.Trash className="h-4 w-4" />,
                        danger: true,
                        onClick: async () => {
                          if (!confirm(`Delete assignment "${a.title}"?`)) return;
                          const fd = new FormData();
                          fd.set("id", a.id);
                          const res = await deleteAssignment(fd);
                          if (!res.ok) { alert(res.error); return; }
                          router.refresh();
                        },
                      },
                    ]}
                  />
                </div>
              </div>
            </Card>
          ))}

          {mod.quizzes.map((q) => (
            <Card key={q.id} className="card-hover">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-200">
                  <Icon.Quiz className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{q.title}</p>
                  {q.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{q.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                    <span>{q.questionCount} question{q.questionCount === 1 ? "" : "s"}</span>
                    <span>·</span>
                    <span>Pass at {q.passingScore}%</span>
                    {q.timeLimit != null && (
                      <>
                        <span>·</span>
                        <span>{Math.round(q.timeLimit / 60)} min limit</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{q.attemptCount} attempt{q.attemptCount === 1 ? "" : "s"}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Lesson modals */}
      <Modal
        open={createLessonOpen}
        onClose={() => setCreateLessonOpen(false)}
        title="Add lesson"
        description="Add a lesson to this module."
        widthClass="max-w-xl"
      >
        <LessonFormFields
          moduleId={mod.id}
          nextOrder={nextLessonOrder}
          onDone={() => setCreateLessonOpen(false)}
        />
      </Modal>

      <Modal
        open={editingLesson !== null}
        onClose={() => setEditingLesson(null)}
        title="Edit lesson"
        description={editingLesson?.title}
        widthClass="max-w-xl"
      >
        {editingLesson && (
          <LessonFormFields
            moduleId={mod.id}
            nextOrder={editingLesson.order}
            initial={lessonToFormData(editingLesson)}
            onDone={() => setEditingLesson(null)}
          />
        )}
      </Modal>

      {/* Lesson video modals */}
      <Modal
        open={createVideoFor !== null}
        onClose={() => setCreateVideoFor(null)}
        title="Add video"
        description={createVideoFor ? `Add a video to "${createVideoFor.title}".` : undefined}
        widthClass="max-w-xl"
      >
        {createVideoFor && (
          <LessonVideoFormFields
            lessonId={createVideoFor.id}
            nextOrder={nextVideoOrder(createVideoFor.id)}
            onDone={() => setCreateVideoFor(null)}
          />
        )}
      </Modal>

      <Modal
        open={editingVideo !== null}
        onClose={() => setEditingVideo(null)}
        title="Edit video"
        description={editingVideo?.title}
        widthClass="max-w-xl"
      >
        {editingVideo && (
          <LessonVideoFormFields
            lessonId={editingVideo.lessonId}
            nextOrder={editingVideo.order}
            initial={videoToFormData(editingVideo)}
            onDone={() => setEditingVideo(null)}
          />
        )}
      </Modal>

      {/* Assignment modals */}
      <Modal
        open={createAssignmentOpen}
        onClose={() => setCreateAssignmentOpen(false)}
        title="Add assignment"
        description="This assignment covers the module as a whole."
        widthClass="max-w-xl"
      >
        <AssignmentFormFields
          moduleId={mod.id}
          onDone={() => setCreateAssignmentOpen(false)}
        />
      </Modal>

      <Modal
        open={editingAssignment !== null}
        onClose={() => setEditingAssignment(null)}
        title="Edit assignment"
        description={editingAssignment?.title}
        widthClass="max-w-xl"
      >
        {editingAssignment && (
          <AssignmentFormFields
            moduleId={mod.id}
            initial={assignmentToFormData(editingAssignment)}
            onDone={() => setEditingAssignment(null)}
          />
        )}
      </Modal>
    </>
  );
}
