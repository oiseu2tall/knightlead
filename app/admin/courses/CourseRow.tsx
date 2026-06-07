"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Primitives";
import { CourseForm, DeleteCourseButton } from "./CourseForm";

type Person = { id: string; name: string | null; email: string; role: string };

type Course = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  instructorId: string;
  instructor: { id: string; name: string | null; email: string };
  managerId: string | null;
  manager: { id: string; name: string | null; email: string } | null;
  isPublished: boolean;
  moduleCount: number;
  enrollmentCount: number;
};

export function CourseRow({
  course,
  instructors,
  managers,
}: {
  course: Course;
  instructors: Person[];
  managers: Person[];
}) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <tr className="text-ink align-top">
        <td className="py-3 pr-4">
          <p className="font-medium">{course.title}</p>
          <p className="text-xs text-ink-muted">/{course.slug}</p>
          {course.description && (
            <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{course.description}</p>
          )}
        </td>
        <td className="py-3 pr-4 text-xs text-ink-muted">
          <p className="font-medium text-ink">{course.instructor.name ?? course.instructor.email}</p>
          <p>{course.instructor.email}</p>
        </td>
        <td className="py-3 pr-4">
          <Badge tone={course.isPublished ? "success" : "neutral"}>
            {course.isPublished ? "published" : "draft"}
          </Badge>
        </td>
        <td className="py-3 pr-4 text-xs text-ink-muted">{course.moduleCount}</td>
        <td className="py-3 pr-4 text-xs text-ink-muted">{course.enrollmentCount}</td>
        <td className="py-3">
          <div className="flex flex-col items-end gap-1">
            <Link
              href={`/admin/courses/${course.slug}`}
              className="text-xs font-medium text-brand-500 hover:text-brand-600"
            >
              Modules →
            </Link>
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="text-xs font-medium text-brand-500 hover:text-brand-600"
            >
              {editing ? "Close" : "Edit"}
            </button>
            <DeleteCourseButton id={course.id} disabled={course.enrollmentCount > 0} />
          </div>
        </td>
      </tr>
      {editing && (
        <tr className="bg-surface-dim/40">
          <td colSpan={6} className="py-3 pr-4">
            <div className="ml-auto max-w-md">
              <CourseForm
                mode="edit"
                instructors={instructors}
                managers={managers}
                initial={{
                  id: course.id,
                  title: course.title,
                  slug: course.slug,
                  description: course.description,
                  thumbnailUrl: course.thumbnailUrl,
                  instructorId: course.instructorId,
                  managerId: course.managerId,
                  isPublished: course.isPublished,
                }}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
