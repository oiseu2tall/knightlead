"use client";

// Enroll-student form. Lets a manager/admin pick a student, a course,
// and an optional cohort. Idempotent on the server.
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { staffEnrollStudent } from "../catalog/actions";

type Student = { id: string; name: string | null; email: string };
type Course = { id: string; title: string; slug: string; isPublished: boolean };
type Cohort = { id: string; name: string; startDate: Date };

export function EnrollStudentForm({
  students,
  courses,
  cohorts,
}: {
  students: Student[];
  courses: Course[];
  cohorts: Cohort[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Optional: live student search.
  const [studentQuery, setStudentQuery] = useState("");
  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return students.slice(0, 25);
    return students
      .filter(
        (s) =>
          (s.name ?? "").toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q),
      )
      .slice(0, 25);
  }, [students, studentQuery]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const res = await staffEnrollStudent(fd);
          if (!res.ok) { setError(res.error); return; }
          setSuccess(
            res.created
              ? "Student enrolled."
              : "Already enrolled — cohort tag updated if you picked one.",
          );
          router.refresh();
        });
      }}
      className="space-y-3"
    >
      <Field label="Student" name="studentId">
        <div className="space-y-1.5">
          <input
            type="search"
            value={studentQuery}
            onChange={(e) => setStudentQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
          <select
            name="studentId"
            required
            size={Math.min(6, Math.max(3, filteredStudents.length))}
            className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            {filteredStudents.length === 0 && (
              <option value="" disabled>No students match.</option>
            )}
            {filteredStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name ?? "—"}{s.name ? " · " : ""}{s.email}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-ink-muted">
            Only STUDENTs are listed. Staff cannot be enrolled.
          </p>
        </div>
      </Field>

      <Field label="Course" name="courseId">
        <select
          name="courseId"
          required
          defaultValue=""
          className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="" disabled>— Pick a course —</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}{c.isPublished ? "" : " (draft)"}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Cohort (optional)"
        name="cohortId"
        hint="If you pick a cohort, the student is tagged with it for this course. Leave blank to enroll without a cohort."
      >
        <select
          name="cohortId"
          defaultValue=""
          className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="">— No cohort —</option>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} (starts {c.startDate.toLocaleDateString()})
            </option>
          ))}
        </select>
      </Field>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}
      {success && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">{success}</p>
      )}

      <Button type="submit" variant="primary" loading={pending} className="w-full">
        Enroll student
      </Button>
    </form>
  );
}
