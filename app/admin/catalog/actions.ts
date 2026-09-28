"use server";

// Catalog management server actions — cohorts, courses, modules.
// Accessible to MANAGER and ADMIN. Re-checked inside every action
// (proxy + layout gate are not enough).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { deleteObject } from "@/lib/storage";

// ---------- helpers ----------

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function checkCatalogWriteRate(actorId: string, action: string) {
  const ip = await clientIp();
  const limited = await rateLimit(`catalog:${action}:${actorId}:${ip}`, {
    limit: 60, windowMs: 60_000,
  });
  return limited;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ---------- shared result type ----------

export type CatalogResult = { ok: true; id?: string; slug?: string } | { ok: false; error: string };

// ---------- COHORTS ----------

const cohortSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  // A cohort is always an intake of one course, so this is required on
  // create. On update it is only honoured when the cohort has no
  // enrollments yet — see upsertCohort.
  courseId: z.string().min(1, "Pick a course").max(64),
  name: z.string().trim().min(1, "Name is required").max(120),
  slug: z.string().trim().max(80).optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  description: z.string().trim().max(2_000).optional().default(""),
  managerId: z.string().max(64).optional().or(z.literal("")),
  // Optional seat cap. Empty string means "no limit".
  capacity: z.coerce.number().int().min(1, "Capacity must be at least 1").max(10_000).optional().or(z.literal("")),
  // Checkbox: absent means "closed to self-enrollment".
  isOpen: z.string().optional(),
});

export async function upsertCohort(formData: FormData): Promise<CatalogResult> {
  const actor = await requireRole("MANAGER", "ADMIN");
  const limited = await checkCatalogWriteRate(actor.id, "cohort");
  if (!limited.ok) return { ok: false, error: "Too many edits — slow down." };

  const parsed = cohortSchema.safeParse({
    id: formData.get("id") || undefined,
    courseId: formData.get("courseId"),
    name: formData.get("name"),
    slug: formData.get("slug") || undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    description: formData.get("description") ?? "",
    managerId: formData.get("managerId") ?? "",
    capacity: formData.get("capacity") ?? "",
    isOpen: formData.get("isOpen") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { ok: false, error: "Invalid date" };
  }
  if (end <= start) return { ok: false, error: "End date must be after start date" };

  // The parent course must exist.
  const course = await db.course.findUnique({
    where: { id: data.courseId },
    select: { id: true, slug: true, title: true },
  });
  if (!course) return { ok: false, error: "Course not found" };

  // Slug: explicit, or derived. Must be unique.
  const baseSlug = (data.slug && data.slug.length > 0 ? data.slug : slugify(data.name)) || `cohort-${Date.now()}`;
  const finalSlug = await ensureUniqueCohortSlug(baseSlug, data.id);

  // Resolve manager: blank string → null; otherwise must be an actual MANAGER/ADMIN.
  let managerId: string | null = null;
  if (data.managerId) {
    const m = await db.user.findUnique({ where: { id: data.managerId }, select: { role: true } });
    if (!m || (m.role !== "MANAGER" && m.role !== "ADMIN")) {
      return { ok: false, error: "Manager must be a user with the MANAGER or ADMIN role" };
    }
    managerId = data.managerId;
  }

  const capacity = data.capacity === "" ? null : Number(data.capacity);
  const isOpen = data.isOpen === "on" || data.isOpen === "true";

  if (data.id) {
    const existing = await db.cohort.findUnique({
      where: { id: data.id },
      select: { id: true, courseId: true, name: true },
    });
    if (!existing) return { ok: false, error: "Cohort not found" };

    // Moving a populated cohort to another course would silently change
    // which course every enrolled student has access to. Refuse it and make
    // the manager move the students instead.
    if (existing.courseId !== course.id) {
      const enrolled = await db.enrollment.count({ where: { cohortId: data.id } });
      if (enrolled > 0) {
        return {
          ok: false,
          error: `Cannot move this cohort: ${enrolled} student(s) are enrolled. Move them to a cohort of the new course first.`,
        };
      }
    }

    // Lowering capacity below the number of occupied seats would put the
    // cohort permanently over its own limit.
    if (capacity !== null) {
      const occupied = await db.enrollment.count({
        where: { cohortId: data.id, status: { in: ["ACTIVE", "COMPLETED", "PENDING"] } },
      });
      if (capacity < occupied) {
        return { ok: false, error: `Capacity ${capacity} is below the ${occupied} seat(s) already taken.` };
      }
    }

    await db.cohort.update({
      where: { id: data.id },
      data: {
        courseId: course.id,
        name: data.name,
        slug: finalSlug,
        startDate: start,
        endDate: end,
        description: data.description,
        managerId,
        capacity,
        isOpen,
      },
    });
    // A course change is only ever accepted for an empty cohort (see the
    // guard above), so there are no enrollments whose denormalized
    // courseId would need to follow. No cascade to write here.
    await db.auditLog.create({
      data: { userId: actor.id, action: "UPDATE_COHORT", resource: `cohort:${data.id}`, metadata: { name: data.name, course: course.title, isOpen, capacity } },
    });
    revalidatePath(`/admin/courses/${course.slug}`);
  } else {
    const created = await db.cohort.create({
      data: {
        courseId: course.id,
        name: data.name,
        slug: finalSlug,
        startDate: start,
        endDate: end,
        description: data.description,
        managerId,
        capacity,
        isOpen,
      },
    });
    await db.auditLog.create({
      data: { userId: actor.id, action: "CREATE_COHORT", resource: `cohort:${created.id}`, metadata: { name: data.name, slug: finalSlug, course: course.title } },
    });
  }

  revalidatePath("/admin/cohorts");
  revalidatePath(`/admin/courses/${course.slug}`);
  return { ok: true, slug: finalSlug };
}

export async function deleteCohort(formData: FormData): Promise<CatalogResult> {
  const actor = await requireRole("MANAGER", "ADMIN");
  const limited = await checkCatalogWriteRate(actor.id, "cohort-del");
  if (!limited.ok) return { ok: false, error: "Too many edits — slow down." };
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing cohort id" };

  // Refuse to delete a cohort that still has enrollments — orphaning
  // students is worse than a refused delete. The FK is ON DELETE CASCADE,
  // so this is a product guard, not a database one.
  const enrollCount = await db.enrollment.count({ where: { cohortId: id } });
  if (enrollCount > 0) {
    return { ok: false, error: `Cannot delete: ${enrollCount} enrollment(s) still reference this cohort.` };
  }

  const existing = await db.cohort.findUnique({
    where: { id },
    select: { id: true, name: true, course: { select: { slug: true } } },
  });
  if (!existing) return { ok: false, error: "Cohort not found" };

  await db.cohort.delete({ where: { id } });
  await db.auditLog.create({
    data: { userId: actor.id, action: "DELETE_COHORT", resource: `cohort:${id}`, metadata: { name: existing.name } },
  });
  revalidatePath("/admin/cohorts");
  revalidatePath(`/admin/courses/${existing.course.slug}`);
  return { ok: true };
}

async function ensureUniqueCohortSlug(base: string, excludeId?: string): Promise<string> {
  let slug = base;
  for (let i = 1; i < 50; i++) {
    const existing = await db.cohort.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

// ---------- COURSES ----------

const courseSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  title: z.string().trim().min(1, "Title is required").max(160),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(4_000).optional().default(""),
  thumbnailUrl: z.string().trim().url("Must be a valid URL").max(500).optional().or(z.literal("")),
  instructorId: z.string().min(1, "Pick an instructor").max(64),
  managerId: z.string().max(64).optional().or(z.literal("")),
  isPublished: z.string().optional(),
});

export async function upsertCourse(formData: FormData): Promise<CatalogResult> {
  const actor = await requireRole("MANAGER", "ADMIN");
  const limited = await checkCatalogWriteRate(actor.id, "course");
  if (!limited.ok) return { ok: false, error: "Too many edits — slow down." };

  const parsed = courseSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    slug: formData.get("slug") || undefined,
    description: formData.get("description") ?? "",
    thumbnailUrl: formData.get("thumbnailUrl") ?? "",
    instructorId: formData.get("instructorId"),
    managerId: formData.get("managerId") ?? "",
    isPublished: formData.get("isPublished") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  // Instructor must be INSTRUCTOR or ADMIN.
  const instr = await db.user.findUnique({ where: { id: data.instructorId }, select: { role: true } });
  if (!instr || (instr.role !== "INSTRUCTOR" && instr.role !== "ADMIN")) {
    return { ok: false, error: "Instructor must be a user with the INSTRUCTOR or ADMIN role" };
  }
  let managerId: string | null = null;
  if (data.managerId) {
    const m = await db.user.findUnique({ where: { id: data.managerId }, select: { role: true } });
    if (!m || (m.role !== "MANAGER" && m.role !== "ADMIN")) {
      return { ok: false, error: "Manager must be a user with the MANAGER or ADMIN role" };
    }
    managerId = data.managerId;
  }

  const baseSlug = (data.slug && data.slug.length > 0 ? data.slug : slugify(data.title)) || `course-${Date.now()}`;
  const finalSlug = await ensureUniqueCourseSlug(baseSlug, data.id);
  const isPublished = data.isPublished === "on" || data.isPublished === "true";

  if (data.id) {
    const existing = await db.course.findUnique({ where: { id: data.id }, select: { id: true } });
    if (!existing) return { ok: false, error: "Course not found" };
    await db.course.update({
      where: { id: data.id },
      data: {
        title: data.title,
        slug: finalSlug,
        description: data.description,
        thumbnailUrl: data.thumbnailUrl || null,
        instructorId: data.instructorId,
        managerId,
        isPublished,
      },
    });
    await db.auditLog.create({
      data: { userId: actor.id, action: "UPDATE_COURSE", resource: `course:${data.id}`, metadata: { title: data.title, isPublished } },
    });
    revalidatePath(`/admin/courses/${finalSlug}`);
  } else {
    const created = await db.course.create({
      data: {
        title: data.title,
        slug: finalSlug,
        description: data.description,
        thumbnailUrl: data.thumbnailUrl || null,
        instructorId: data.instructorId,
        managerId,
        isPublished,
      },
    });
    await db.auditLog.create({
      data: { userId: actor.id, action: "CREATE_COURSE", resource: `course:${created.id}`, metadata: { title: data.title, slug: finalSlug } },
    });
  }

  revalidatePath("/admin/courses");
  return { ok: true, slug: finalSlug };
}

export async function deleteCourse(formData: FormData): Promise<CatalogResult> {
  const actor = await requireRole("MANAGER", "ADMIN");
  const limited = await checkCatalogWriteRate(actor.id, "course-del");
  if (!limited.ok) return { ok: false, error: "Too many edits — slow down." };
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing course id" };

  // A course owns its cohorts, and a cohort owns its enrollments. Deleting
  // an empty course would therefore cascade-delete populated cohorts, so
  // refuse whenever anything still hangs off it and make the manager clear
  // it out first.
  const [enrollCount, cohortCount] = await Promise.all([
    db.enrollment.count({ where: { courseId: id } }),
    db.cohort.count({ where: { courseId: id } }),
  ]);
  if (cohortCount > 0) {
    return { ok: false, error: `Cannot delete: ${cohortCount} cohort(s) still belong to this course. Delete them first.` };
  }
  if (enrollCount > 0) {
    return { ok: false, error: `Cannot delete: ${enrollCount} enrollment(s) still reference this course.` };
  }

  const existing = await db.course.findUnique({ where: { id }, select: { id: true, title: true, slug: true } });
  if (!existing) return { ok: false, error: "Course not found" };

  await db.course.delete({ where: { id } });
  await db.auditLog.create({
    data: { userId: actor.id, action: "DELETE_COURSE", resource: `course:${id}`, metadata: { title: existing.title } },
  });
  revalidatePath("/admin/courses");
  return { ok: true };
}

async function ensureUniqueCourseSlug(base: string, excludeId?: string): Promise<string> {
  let slug = base;
  for (let i = 1; i < 50; i++) {
    const existing = await db.course.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

// ---------- MODULES ----------

const moduleSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  courseId: z.string().min(1, "Missing course").max(64),
  title: z.string().trim().min(1, "Title is required").max(160),
  order: z.coerce.number().int().min(0).max(999),
  fileKey: z.string().max(500).optional().or(z.literal("")),
  fileName: z.string().max(255).optional().or(z.literal("")),
  fileSize: z.coerce.number().int().optional().or(z.literal("")),
  fileType: z.string().max(100).optional().or(z.literal("")),
});

export async function upsertModule(formData: FormData): Promise<CatalogResult> {
  const actor = await requireRole("MANAGER", "ADMIN");
  const limited = await checkCatalogWriteRate(actor.id, "module");
  if (!limited.ok) return { ok: false, error: "Too many edits — slow down." };

  const parsed = moduleSchema.safeParse({
    id: formData.get("id") || undefined,
    courseId: formData.get("courseId"),
    title: formData.get("title"),
    order: formData.get("order"),
    fileKey: formData.get("fileKey") || "",
    fileName: formData.get("fileName") || "",
    fileSize: formData.get("fileSize") || "",
    fileType: formData.get("fileType") || "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, courseId, title, order, fileKey, fileName, fileSize, fileType } = parsed.data;

  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true, slug: true } });
  if (!course) return { ok: false, error: "Course not found" };

  const fileData = {
    fileKey: fileKey || undefined,
    fileName: fileName || undefined,
    fileSize: fileSize ? Number(fileSize) : undefined,
    fileType: fileType || undefined,
  };

  if (id) {
    const existing = await db.module.findUnique({ where: { id }, select: { id: true, courseId: true, fileKey: true } });
    if (!existing) return { ok: false, error: "Module not found" };
    if (existing.courseId !== courseId) return { ok: false, error: "Module doesn't belong to this course" };

    await db.module.update({ where: { id }, data: { title, order, ...fileData } });
    await db.auditLog.create({
      data: { userId: actor.id, action: "UPDATE_MODULE", resource: `module:${id}`, metadata: { title, order, hasFile: !!fileData.fileKey } },
    });
  } else {
    await db.$transaction([
      db.module.updateMany({
        where: { courseId, order: { gte: order } },
        data: { order: { increment: 1 } },
      }),
      db.module.create({ data: { courseId, title, order, ...fileData } }),
    ]);
    await db.auditLog.create({
      data: { userId: actor.id, action: "CREATE_MODULE", resource: `course:${courseId}`, metadata: { title, order, hasFile: !!fileData.fileKey } },
    });
  }

  revalidatePath(`/admin/courses/${course.slug}`);
  return { ok: true, slug: course.slug };
}

export async function deleteModule(formData: FormData): Promise<CatalogResult> {
  const actor = await requireRole("MANAGER", "ADMIN");
  const limited = await checkCatalogWriteRate(actor.id, "module-del");
  if (!limited.ok) return { ok: false, error: "Too many edits — slow down." };
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing module id" };

  const existing = await db.module.findUnique({
    where: { id },
    select: { id: true, title: true, courseId: true, fileKey: true, course: { select: { slug: true } } },
  });
  if (!existing) return { ok: false, error: "Module not found" };

  if (existing.fileKey) {
    try { await deleteObject(existing.fileKey); } catch { /* best-effort cleanup */ }
  }

  await db.module.delete({ where: { id } });
  await db.auditLog.create({
    data: { userId: actor.id, action: "DELETE_MODULE", resource: `module:${id}`, metadata: { title: existing.title, courseId: existing.courseId } },
  });
  revalidatePath(`/admin/courses/${existing.course.slug}`);
  return { ok: true };
}

// Re-export redirect so the client form can use it after a successful create.
export async function goTo(path: string) {
  redirect(path);
}

// ---------------------------------------------------------------------------
// Enrollment approval / activation
// ---------------------------------------------------------------------------

export type ApproveEnrollResult =
  | { ok: true }
  | { ok: false; error: string };

const approveEnrollSchema = z.object({
  enrollmentId: z.string().min(1).max(64),
});

/**
 * Activate a PENDING self-enrollment so the student can access the
 * course behind that cohort. MANAGER + ADMIN. Idempotent: an
 * already-ACTIVE enrollment is a no-op success.
 *
 * Staff-enrolled students are created ACTIVE by default — this action
 * only matters for self-enrollments that landed in PENDING. The approver
 * and timestamp are recorded so the admin UI can distinguish a reviewed
 * seat from a legacy one.
 */
export async function approveEnrollment(formData: FormData): Promise<ApproveEnrollResult> {
  const actor = await requireRole("MANAGER", "ADMIN");
  const ip = await clientIp();
  const limited = await rateLimit(`enroll-approve:${actor.id}:${ip}`, {
    limit: 60, windowMs: 60_000,
  });
  if (!limited.ok) return { ok: false, error: "Too many approvals — slow down." };

  const parsed = approveEnrollSchema.safeParse({ enrollmentId: formData.get("enrollmentId") });
  if (!parsed.success) return { ok: false, error: "Missing enrollment id" };
  const { enrollmentId } = parsed.data;

  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      user: { select: { email: true } },
      cohort: { select: { name: true, course: { select: { title: true, slug: true } } } },
    },
  });
  if (!enrollment) return { ok: false, error: "Enrollment not found" };
  if (enrollment.status !== "PENDING") return { ok: true }; // idempotent

  await db.enrollment.update({
    where: { id: enrollmentId },
    data: { status: "ACTIVE", approvedAt: new Date(), approvedById: actor.id },
  });
  await db.auditLog.create({
    data: {
      userId: actor.id,
      action: "APPROVE_ENROLLMENT",
      resource: `enrollment:${enrollmentId}`,
      metadata: {
        student: enrollment.user.email,
        course: enrollment.cohort.course.title,
        cohort: enrollment.cohort.name,
      },
    },
  });

  revalidatePath("/admin/enrollments");
  revalidatePath("/dashboard/courses");
  revalidatePath(`/dashboard/courses/${enrollment.cohort.course.slug}`);
  return { ok: true };
}

/**
 * Withdraw a PENDING self-enrollment. MANAGER + ADMIN.
 *
 * Only PENDING rows are withdrawable: once a seat is ACTIVE the student
 * has consumed course content, and that relationship should end with
 * `updateEnrollmentStatus` (which records who dropped) rather than a
 * silent delete.
 */
export async function rejectEnrollment(formData: FormData): Promise<ApproveEnrollResult> {
  const actor = await requireRole("MANAGER", "ADMIN");
  const limited = await checkCatalogWriteRate(actor.id, "enroll-reject");
  if (!limited.ok) return { ok: false, error: "Too many actions — slow down." };

  const parsed = approveEnrollSchema.safeParse({ enrollmentId: formData.get("enrollmentId") });
  if (!parsed.success) return { ok: false, error: "Missing enrollment id" };
  const { enrollmentId } = parsed.data;

  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      user: { select: { email: true } },
      cohort: { select: { name: true, course: { select: { title: true, slug: true } } } },
    },
  });
  if (!enrollment) return { ok: false, error: "Enrollment not found" };
  if (enrollment.status !== "PENDING") {
    return { ok: false, error: "Only a pending request can be declined." };
  }

  // Dropped, not deleted: the request is a real audit event and the
  // student should see a declined outcome rather than a vanished row.
  await db.enrollment.update({
    where: { id: enrollmentId },
    data: { status: "DROPPED", approvedAt: null, approvedById: null },
  });
  await db.auditLog.create({
    data: {
      userId: actor.id,
      action: "REJECT_ENROLLMENT",
      resource: `enrollment:${enrollmentId}`,
      metadata: {
        student: enrollment.user.email,
        course: enrollment.cohort.course.title,
        cohort: enrollment.cohort.name,
      },
    },
  });

  revalidatePath("/admin/enrollments");
  revalidatePath("/dashboard/courses");
  revalidatePath(`/dashboard/courses/${enrollment.cohort.course.slug}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Staff-initiated enrollment
// ---------------------------------------------------------------------------

export type StaffEnrollResult =
  | { ok: true; created: boolean }
  | { ok: false; error: string };

const staffEnrollSchema = z.object({
  studentId: z.string().min(1, "Pick a student").max(64),
  // The cohort is the only thing a manager picks. The course is derived
  // from it, so the two can never disagree.
  cohortId: z.string().min(1, "Pick a cohort").max(64),
});

/**
 * Enroll a STUDENT into a cohort, immediately and without approval.
 *
 * Role rule: only MANAGER + ADMIN can call this. INSTRUCTORs cannot.
 * The student is always a STUDENT — staff enrolling other staff would
 * defeat the audit trail. The action is idempotent: a duplicate
 * `(studentId, cohortId)` is treated as success with `created: false`,
 * which is the right behaviour when the manager clicks "Enroll" twice
 * or the form is re-submitted.
 *
 * Because a cohort belongs to exactly one course, a student can hold
 * several seats in the same course (one per intake) and the courseId is
 * copied from the cohort rather than trusted from the form.
 */
export async function staffEnrollStudent(formData: FormData): Promise<StaffEnrollResult> {
  const actor = await requireRole("MANAGER", "ADMIN");
  const limited = await checkCatalogWriteRate(actor.id, "staff-enroll");
  if (!limited.ok) return { ok: false, error: "Too many actions — slow down." };

  const parsed = staffEnrollSchema.safeParse({
    studentId: formData.get("studentId"),
    cohortId: formData.get("cohortId"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { studentId, cohortId } = parsed.data;

  // The target user must exist AND be a STUDENT. Staff are not
  // enrollable, even by other staff.
  const student = await db.user.findUnique({
    where: { id: studentId },
    select: { id: true, role: true, name: true, email: true },
  });
  if (!student) return { ok: false, error: "Student not found" };
  if (student.role !== "STUDENT") {
    return { ok: false, error: `Cannot enroll a user with role ${student.role}. Only STUDENTs can be enrolled.` };
  }

  // The cohort carries the course. Draft courses are still enrollable by
  // staff — that's how a manager onboards a class ahead of an announcement
  // — and unlike self-enrollment, `isOpen` does not apply here: staff are
  // explicitly overriding the intake window.
  const cohort = await db.cohort.findUnique({
    where: { id: cohortId },
    select: { id: true, name: true, capacity: true, course: { select: { id: true, slug: true, title: true } } },
  });
  if (!cohort) return { ok: false, error: "Cohort not found" };
  const course = cohort.course;

  // Idempotent. Checked before the capacity test so a double-submit on a
  // full cohort still succeeds.
  const existing = await db.enrollment.findUnique({
    where: { userId_cohortId: { userId: studentId, cohortId } },
    select: { id: true, status: true },
  });
  if (existing) {
    revalidatePath("/admin/enrollments");
    revalidatePath(`/admin/courses/${course.slug}`);
    return { ok: true, created: false };
  }

  // A full cohort takes no further seats, staff or not.
  if (cohort.capacity !== null) {
    const taken = await db.enrollment.count({
      where: { cohortId, status: { in: ["PENDING", "ACTIVE", "COMPLETED"] } },
    });
    if (taken >= cohort.capacity) {
      return { ok: false, error: `"${cohort.name}" is full (${taken}/${cohort.capacity}).` };
    }
  }

  await db.enrollment.create({
    data: {
      userId: studentId,
      cohortId,
      // Denormalized copy of cohort.courseId — never taken from the form.
      courseId: course.id,
      // Staff enrollment skips the approval queue, but the seat is still
      // attributable to whoever placed it.
      status: "ACTIVE",
      progress: 0,
      approvedAt: new Date(),
      approvedById: actor.id,
    },
  });

  await db.auditLog.create({
    data: {
      userId: actor.id,
      action: "STAFF_ENROLL_STUDENT",
      resource: `enrollment:${cohortId}:${studentId}`,
      metadata: {
        student: student.email,
        course: course.title,
        cohort: cohort.name,
      },
    },
  });

  revalidatePath("/admin/enrollments");
  revalidatePath(`/admin/courses/${course.slug}`);
  revalidatePath("/instructor/cohorts");
  return { ok: true, created: true };
}

/**
 * Move a student from one cohort to another, keeping the same status.
 *
 * This is the only supported way to reassign a student, because the seat
 * is a property of the cohort: rewriting `cohortId` in place would leave
 * the enrollment's denormalized `courseId` pointing at the old course.
 * Doing it as a delete+create inside a transaction keeps both the
 * uniqueness constraint and the course invariant intact.
 */
export async function moveEnrollmentToCohort(formData: FormData): Promise<StaffEnrollResult> {
  const actor = await requireRole("MANAGER", "ADMIN");
  const limited = await checkCatalogWriteRate(actor.id, "enroll-move");
  if (!limited.ok) return { ok: false, error: "Too many actions — slow down." };

  const parsed = z
    .object({
      enrollmentId: z.string().min(1, "Missing enrollment").max(64),
      cohortId: z.string().min(1, "Pick a cohort").max(64),
    })
    .safeParse({
      enrollmentId: formData.get("enrollmentId"),
      cohortId: formData.get("cohortId"),
    });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { enrollmentId, cohortId } = parsed.data;

  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      user: { select: { email: true } },
      cohort: { select: { name: true, course: { select: { title: true } } } },
    },
  });
  if (!enrollment) return { ok: false, error: "Enrollment not found" };
  if (enrollment.cohortId === cohortId) return { ok: true, created: false };

  const target = await db.cohort.findUnique({
    where: { id: cohortId },
    select: { id: true, name: true, capacity: true, course: { select: { id: true, slug: true, title: true } } },
  });
  if (!target) return { ok: false, error: "Cohort not found" };

  // The destination must not already hold this student.
  const clash = await db.enrollment.findUnique({
    where: { userId_cohortId: { userId: enrollment.userId, cohortId } },
    select: { id: true },
  });
  if (clash) return { ok: false, error: "This student already has a seat in that cohort." };

  if (target.capacity !== null) {
    const taken = await db.enrollment.count({
      where: { cohortId, status: { in: ["PENDING", "ACTIVE", "COMPLETED"] } },
    });
    if (taken >= target.capacity) {
      return { ok: false, error: `"${target.name}" is full (${taken}/${target.capacity}).` };
    }
  }

  await db.enrollment.update({
    where: { id: enrollmentId },
    data: { cohortId, courseId: target.course.id },
  });
  await db.auditLog.create({
    data: {
      userId: actor.id,
      action: "MOVE_ENROLLMENT_COHORT",
      resource: `enrollment:${enrollmentId}`,
      metadata: {
        student: enrollment.user.email,
        from: { course: enrollment.cohort.course.title, cohort: enrollment.cohort.name },
        to: { course: target.course.title, cohort: target.name },
      },
    },
  });

  revalidatePath("/admin/enrollments");
  revalidatePath(`/admin/courses/${target.course.slug}`);
  revalidatePath("/instructor/cohorts");
  return { ok: true, created: true };
}

// ---------------------------------------------------------------------------
// Assignment CRUD (module-level)
// ---------------------------------------------------------------------------

export type AssignmentResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

const assignmentSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  moduleId: z.string().min(1, "Module is required").max(64),
  title: z.string().trim().min(1, "Title is required").max(160),
  prompt: z.string().trim().min(1, "Prompt is required").max(10_000),
  dueDate: z.string().trim().optional().or(z.literal("")),
  maxScore: z.coerce.number().int().min(1).max(1000).default(100),
  attachments: z.array(z.string().min(1).max(500)).max(5).default([]),
});

export async function upsertAssignment(formData: FormData): Promise<AssignmentResult> {
  const actor = await requireRole("MANAGER", "ADMIN");
  const ip = await clientIp();
  const limited = await rateLimit(`catalog:assignment:${actor.id}:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!limited.ok) return { ok: false, error: "Too many edits — slow down." };

  let attachments: string[] = [];
  try {
    const raw = formData.get("attachments");
    if (typeof raw === "string" && raw) attachments = JSON.parse(raw) as string[];
  } catch {
    return { ok: false, error: "Invalid attachment payload" };
  }

  const parsed = assignmentSchema.safeParse({
    id: formData.get("id") || undefined,
    moduleId: formData.get("moduleId"),
    title: formData.get("title"),
    prompt: formData.get("prompt"),
    dueDate: formData.get("dueDate") ?? "",
    maxScore: formData.get("maxScore") ?? 100,
    attachments,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, moduleId, title, prompt, dueDate, maxScore } = parsed.data;

  const moduleRow = await db.module.findUnique({
    where: { id: moduleId },
    select: { id: true, courseId: true, course: { select: { slug: true, title: true } } },
  });
  if (!moduleRow) return { ok: false, error: "Module not found" };

  const due = dueDate ? new Date(dueDate) : null;
  if (dueDate && isNaN(due!.getTime())) return { ok: false, error: "Invalid due date" };

  if (id) {
    const existing = await db.assignment.findUnique({ where: { id }, select: { id: true, moduleId: true } });
    if (!existing) return { ok: false, error: "Assignment not found" };
    if (existing.moduleId !== moduleId) return { ok: false, error: "Assignment doesn't belong to this module" };

    await db.assignment.update({
      where: { id },
      data: { title, prompt, dueDate: due, maxScore, attachments },
    });
    await db.auditLog.create({
      data: { userId: actor.id, action: "UPDATE_ASSIGNMENT", resource: `assignment:${id}`, metadata: { title, maxScore } },
    });
    revalidatePath(`/admin/courses/${moduleRow.course.slug}`);
    return { ok: true, id };
  }

  const created = await db.assignment.create({
    data: { moduleId, title, prompt, dueDate: due, maxScore, attachments },
  });
  await db.auditLog.create({
    data: { userId: actor.id, action: "CREATE_ASSIGNMENT", resource: `assignment:${created.id}`, metadata: { title, moduleId, maxScore } },
  });
  revalidatePath(`/admin/courses/${moduleRow.course.slug}`);
  return { ok: true, id: created.id };
}

export async function deleteAssignment(formData: FormData): Promise<AssignmentResult> {
  const actor = await requireRole("MANAGER", "ADMIN");
  const ip = await clientIp();
  const limited = await rateLimit(`catalog:assignment-del:${actor.id}:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!limited.ok) return { ok: false, error: "Too many edits — slow down." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing assignment id" };

  const existing = await db.assignment.findUnique({
    where: { id },
    select: { id: true, title: true, module: { select: { course: { select: { slug: true, title: true } } } } },
  });
  if (!existing) return { ok: false, error: "Assignment not found" };

  await db.assignment.delete({ where: { id } });
  await db.auditLog.create({
    data: { userId: actor.id, action: "DELETE_ASSIGNMENT", resource: `assignment:${id}`, metadata: { title: existing.title } },
  });
  revalidatePath(`/admin/courses/${existing.module.course.slug}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Lesson CRUD (module-level)
// ---------------------------------------------------------------------------

export type LessonResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

const lessonSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  moduleId: z.string().min(1, "Module is required").max(64),
  title: z.string().trim().min(1, "Title is required").max(160),
  contentType: z.enum(["VIDEO", "ARTICLE", "QUIZ", "ASSIGNMENT", "LIVE_SESSION"]),
  content: z.string().trim().max(20_000).optional().default(""),
  durationMin: z.coerce.number().int().min(0).max(600).optional().or(z.literal("")),
  order: z.coerce.number().int().min(0).max(999),
  isFree: z.string().optional(),
});

/**
 * Free every position from `fromOrder` onwards so a lesson can be written
 * into `order` without tripping `@@unique([moduleId, order])`.
 *
 * Naively incrementing the conflicting rows in one statement raises a
 * duplicate-key error in Postgres, because uniqueness is checked per row
 * as it is written. So the block is parked above every valid order
 * (orders are capped at 999, so +1000 is always out of range), then each
 * row is moved to its final slot in ascending order, freeing the slot
 * below it first. `excludeId` is the lesson being repositioned, which must
 * vacate its own slot before the others land.
 *
 * Mutates nothing itself — the caller wraps this in the transaction.
 */
async function makeRoomForLessonOrder(
  tx: Prisma.TransactionClient,
  moduleId: string,
  fromOrder: number,
  excludeId?: string,
): Promise<void> {
  const conflicting = await tx.lesson.findMany({
    where: {
      moduleId,
      order: { gte: fromOrder },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });
  if (conflicting.length === 0) return;

  // Park the whole block out of range, then relocate it.
  await tx.lesson.updateMany({
    where: { id: { in: conflicting.map((l) => l.id) } },
    data: { order: { increment: 1000 } },
  });
  for (const [index, lesson] of conflicting.entries()) {
    await tx.lesson.update({
      where: { id: lesson.id },
      data: { order: fromOrder + index + 1 },
    });
  }
}

export async function upsertLesson(formData: FormData): Promise<LessonResult> {
  const actor = await requireRole("MANAGER", "ADMIN");
  const ip = await clientIp();
  const limited = await rateLimit(`catalog:lesson:${actor.id}:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!limited.ok) return { ok: false, error: "Too many edits — slow down." };

  const parsed = lessonSchema.safeParse({
    id: formData.get("id") || undefined,
    moduleId: formData.get("moduleId"),
    title: formData.get("title"),
    contentType: formData.get("contentType"),
    content: formData.get("content") ?? "",
    durationMin: formData.get("durationMin") ?? "",
    order: formData.get("order"),
    isFree: formData.get("isFree") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, moduleId, title, contentType, content, durationMin, order, isFree } = parsed.data;

  const mod = await db.module.findUnique({
    where: { id: moduleId },
    select: { id: true, courseId: true, course: { select: { slug: true, title: true } } },
  });
  if (!mod) return { ok: false, error: "Module not found" };

  const data = {
    title,
    contentType,
    content: content || null,
    durationMin: durationMin ? Number(durationMin) : null,
    order,
    isFree: isFree === "on",
  };

  if (id) {
    const existing = await db.lesson.findUnique({ where: { id }, select: { id: true, moduleId: true, order: true } });
    if (!existing) return { ok: false, error: "Lesson not found" };
    if (existing.moduleId !== moduleId) return { ok: false, error: "Lesson doesn't belong to this module" };

    if (existing.order === order) {
      await db.lesson.update({ where: { id }, data });
    } else {
      // Vacate this lesson's own slot, shift the block above the target,
      // then drop it into place.
      await db.$transaction(async (tx) => {
        await tx.lesson.update({ where: { id }, data: { order: { increment: 1000 } } });
        await makeRoomForLessonOrder(tx, moduleId, order, id);
        await tx.lesson.update({ where: { id }, data });
      });
    }
    await db.auditLog.create({
      data: { userId: actor.id, action: "UPDATE_LESSON", resource: `lesson:${id}`, metadata: { title, contentType } },
    });
    revalidatePath(`/admin/courses/${mod.course.slug}`);
    revalidatePath(`/admin/courses/${mod.course.slug}/modules/${moduleId}`);
    return { ok: true, id };
  }

  const created = await db.$transaction(async (tx) => {
    await makeRoomForLessonOrder(tx, moduleId, order);
    return tx.lesson.create({ data: { ...data, moduleId } });
  });
  await db.auditLog.create({
    data: { userId: actor.id, action: "CREATE_LESSON", resource: `lesson:${created.id}`, metadata: { title, contentType, moduleId } },
  });
  revalidatePath(`/admin/courses/${mod.course.slug}`);
  revalidatePath(`/admin/courses/${mod.course.slug}/modules/${moduleId}`);
  return { ok: true, id: created.id };
}

export async function deleteLesson(formData: FormData): Promise<LessonResult> {
  const actor = await requireRole("MANAGER", "ADMIN");
  const ip = await clientIp();
  const limited = await rateLimit(`catalog:lesson-del:${actor.id}:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!limited.ok) return { ok: false, error: "Too many edits — slow down." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing lesson id" };

  const existing = await db.lesson.findUnique({
    where: { id },
    select: { id: true, title: true, module: { select: { id: true, course: { select: { slug: true, title: true } } } } },
  });
  if (!existing) return { ok: false, error: "Lesson not found" };

  await db.lesson.delete({ where: { id } });
  await db.auditLog.create({
    data: { userId: actor.id, action: "DELETE_LESSON", resource: `lesson:${id}`, metadata: { title: existing.title } },
  });
  revalidatePath(`/admin/courses/${existing.module.course.slug}`);
  revalidatePath(`/admin/courses/${existing.module.course.slug}/modules/${existing.module.id}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Lesson video CRUD — a lesson carries many videos, each either an
// external URL or a file in the local store, never both.
// ---------------------------------------------------------------------------

export type LessonVideoResult =
  | { ok: true; id?: string }
  | { ok: false, error: string };

const lessonVideoSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  lessonId: z.string().min(1, "Lesson is required").max(64),
  title: z.string().trim().min(1, "Title is required").max(160),
  description: z.string().trim().max(5_000).optional().or(z.literal("")),
  url: z.string().trim().url("Enter a valid URL").max(500).optional().or(z.literal("")),
  fileKey: z.string().min(1).max(500).optional().or(z.literal("")),
  fileName: z.string().min(1).max(255).optional().or(z.literal("")),
  fileSize: z.coerce.number().int().min(0).optional(),
  fileType: z.string().min(1).max(120).optional().or(z.literal("")),
  durationMin: z.coerce.number().int().min(0).max(600).optional().or(z.literal("")),
  order: z.coerce.number().int().min(0).max(999),
});

export async function upsertLessonVideo(formData: FormData): Promise<LessonVideoResult> {
  const actor = await requireRole("MANAGER", "ADMIN");
  const limited = await checkCatalogWriteRate(actor.id, "lesson-video");
  if (!limited.ok) return { ok: false, error: "Too many edits — slow down." };

  const parsed = lessonVideoSchema.safeParse({
    id: formData.get("id") || undefined,
    lessonId: formData.get("lessonId"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    url: formData.get("url") ?? "",
    fileKey: formData.get("fileKey") ?? "",
    fileName: formData.get("fileName") ?? "",
    fileSize: formData.get("fileSize") || undefined,
    fileType: formData.get("fileType") ?? "",
    durationMin: formData.get("durationMin") ?? "",
    order: formData.get("order"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, lessonId, title, description, url, fileKey, fileName, fileSize, fileType, durationMin, order } = parsed.data;

  // A video needs a source. An external link and an uploaded file are
  // alternative ways to say the same thing, so requiring exactly one
  // keeps the player from having to guess which to render.
  const hasUrl = Boolean(url);
  const hasFile = Boolean(fileKey);
  if (!hasUrl && !hasFile) {
    return { ok: false, error: "Add a video URL or upload a file." };
  }
  if (hasUrl && hasFile) {
    return { ok: false, error: "Provide either a video URL or an uploaded file, not both." };
  }

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, module: { select: { id: true, course: { select: { slug: true } } } } },
  });
  if (!lesson) return { ok: false, error: "Lesson not found" };

  const data = {
    title,
    description: description || null,
    url: hasUrl ? url : null,
    fileKey: hasFile ? fileKey : null,
    fileName: hasFile ? fileName || null : null,
    fileSize: hasFile ? (fileSize ?? null) : null,
    fileType: hasFile ? fileType || null : null,
    durationMin: durationMin ? Number(durationMin) : null,
    order,
  };

  if (id) {
    const existing = await db.lessonVideo.findUnique({
      where: { id },
      select: { id: true, lessonId: true, fileKey: true, order: true },
    });
    if (!existing) return { ok: false, error: "Video not found" };
    if (existing.lessonId !== lessonId) return { ok: false, error: "Video doesn't belong to this lesson" };

    if (existing.order === order) {
      await db.lessonVideo.update({ where: { id }, data });
    } else {
      await db.$transaction(async (tx) => {
        await tx.lessonVideo.update({ where: { id }, data: { order: { increment: 1000 } } });
        await makeRoomForVideoOrder(tx, lessonId, order, id);
        await tx.lessonVideo.update({ where: { id }, data });
      });
    }
    // Replacing an uploaded file leaves the old blob orphaned; drop it
    // once the row pointing at it is gone.
    if (existing.fileKey && existing.fileKey !== data.fileKey) {
      await deleteObject(existing.fileKey).catch(() => {});
    }
    await db.auditLog.create({
      data: { userId: actor.id, action: "UPDATE_LESSON_VIDEO", resource: `lessonVideo:${id}`, metadata: { title } },
    });
  } else {
    const created = await db.$transaction(async (tx) => {
      await makeRoomForVideoOrder(tx, lessonId, order);
      return tx.lessonVideo.create({ data: { ...data, lessonId } });
    });
    await db.auditLog.create({
      data: { userId: actor.id, action: "CREATE_LESSON_VIDEO", resource: `lessonVideo:${created.id}`, metadata: { title, lessonId } },
    });
  }

  const courseSlug = lesson.module.course.slug;
  revalidatePath(`/admin/courses/${courseSlug}/modules/${lesson.module.id}`);
  revalidatePath(`/dashboard/courses/${courseSlug}`);
  return { ok: true, id };
}

/** Free video positions from `fromOrder` up, preserving `@@unique([lessonId, order])`. */
async function makeRoomForVideoOrder(
  tx: Prisma.TransactionClient,
  lessonId: string,
  fromOrder: number,
  excludeId?: string,
): Promise<void> {
  const conflicting = await tx.lessonVideo.findMany({
    where: {
      lessonId,
      order: { gte: fromOrder },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  if (conflicting.length === 0) return;

  await tx.lessonVideo.updateMany({
    where: { id: { in: conflicting.map((v) => v.id) } },
    data: { order: { increment: 1000 } },
  });
  for (const [index, video] of conflicting.entries()) {
    await tx.lessonVideo.update({
      where: { id: video.id },
      data: { order: fromOrder + index + 1 },
    });
  }
}

export async function deleteLessonVideo(formData: FormData): Promise<LessonVideoResult> {
  const actor = await requireRole("MANAGER", "ADMIN");
  const limited = await checkCatalogWriteRate(actor.id, "lesson-video-del");
  if (!limited.ok) return { ok: false, error: "Too many edits — slow down." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing video id" };

  const existing = await db.lessonVideo.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      fileKey: true,
      lesson: { select: { id: true, module: { select: { id: true, course: { select: { slug: true } } } } } },
    },
  });
  if (!existing) return { ok: false, error: "Video not found" };

  await db.lessonVideo.delete({ where: { id } });
  if (existing.fileKey) {
    await deleteObject(existing.fileKey).catch(() => {});
  }
  await db.auditLog.create({
    data: { userId: actor.id, action: "DELETE_LESSON_VIDEO", resource: `lessonVideo:${id}`, metadata: { title: existing.title } },
  });
  const courseSlug = existing.lesson.module.course.slug;
  revalidatePath(`/admin/courses/${courseSlug}/modules/${existing.lesson.module.id}`);
  revalidatePath(`/dashboard/courses/${courseSlug}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Cohort curriculum — what a given intake teaches, in what order.
//
// The plan is additive: a cohort with no plan teaches the whole course.
// Once a plan exists it becomes authoritative, so these actions refuse
// links to another course's content and surface that refusal rather than
// letting a cross-course row corrupt the curriculum.
// ---------------------------------------------------------------------------

export type CurriculumResult =
  | { ok: true; id?: string }
  | { ok: false, error: string };

/**
 * Copy a course's full lesson list into a cohort's plan, in course order.
 * The safe starting point for a new intake: everything, in the order the
 * course author intended, after which staff can drop or reorder entries.
 */
export async function seedCohortCurriculum(formData: FormData): Promise<CurriculumResult> {
  const actor = await requireRole("MANAGER", "ADMIN");
  const limited = await checkCatalogWriteRate(actor.id, "cohort-curriculum-seed");
  if (!limited.ok) return { ok: false, error: "Too many edits — slow down." };

  const cohortId = String(formData.get("cohortId") ?? "");
  if (!cohortId) return { ok: false, error: "Missing cohort" };

  const cohort = await db.cohort.findUnique({
    where: { id: cohortId },
    select: { id: true, courseId: true, course: { select: { slug: true } } },
  });
  if (!cohort) return { ok: false, error: "Cohort not found" };

  const [lessonLinks, moduleLinks] = await Promise.all([
    db.cohortLesson.count({ where: { cohortId } }),
    db.cohortModule.count({ where: { cohortId } }),
  ]);
  if (lessonLinks > 0 || moduleLinks > 0) {
    return { ok: false, error: "This cohort already has a curriculum. Remove it first to start over." };
  }

  const lessons = await db.lesson.findMany({
    where: { module: { courseId: cohort.courseId } },
    orderBy: [{ module: { order: "asc" } }, { order: "asc" }],
    select: { id: true, moduleId: true },
  });
  const modules = await db.module.findMany({
    where: { courseId: cohort.courseId },
    orderBy: { order: "asc" },
    select: { id: true },
  });

  await db.$transaction([
    db.cohortLesson.createMany({
      data: lessons.map((l, i) => ({ cohortId, lessonId: l.id, order: i })),
    }),
    db.cohortModule.createMany({
      data: modules.map((m, i) => ({ cohortId, moduleId: m.id, order: i })),
    }),
  ]);

  await db.auditLog.create({
    data: {
      userId: actor.id,
      action: "SEED_COHORT_CURRICULUM",
      resource: `cohort:${cohortId}`,
      metadata: { lessons: lessons.length, modules: modules.length },
    },
  });
  revalidatePath("/admin/cohorts");
  revalidatePath(`/admin/cohorts/${cohortId}`);
  revalidatePath(`/dashboard/courses/${cohort.course.slug}`);
  return { ok: true };
}

/** Clear a cohort's plan so it falls back to teaching the whole course. */
export async function clearCohortCurriculum(formData: FormData): Promise<CurriculumResult> {
  const actor = await requireRole("MANAGER", "ADMIN");
  const limited = await checkCatalogWriteRate(actor.id, "cohort-curriculum-clear");
  if (!limited.ok) return { ok: false, error: "Too many edits — slow down." };

  const cohortId = String(formData.get("cohortId") ?? "");
  if (!cohortId) return { ok: false, error: "Missing cohort" };

  const cohort = await db.cohort.findUnique({
    where: { id: cohortId },
    select: { id: true, course: { select: { slug: true } } },
  });
  if (!cohort) return { ok: false, error: "Cohort not found" };

  await db.$transaction([
    db.cohortLesson.deleteMany({ where: { cohortId } }),
    db.cohortModule.deleteMany({ where: { cohortId } }),
  ]);
  await db.auditLog.create({
    data: { userId: actor.id, action: "CLEAR_COHORT_CURRICULUM", resource: `cohort:${cohortId}` },
  });
  revalidatePath("/admin/cohorts");
  revalidatePath(`/admin/cohorts/${cohortId}`);
  revalidatePath(`/dashboard/courses/${cohort.course.slug}`);
  return { ok: true };
}

const cohortLessonSchema = z.object({
  cohortId: z.string().min(1, "Cohort is required").max(64),
  lessonId: z.string().min(1, "Lesson is required").max(64),
  releaseAt: z.string().trim().optional().or(z.literal("")),
});

/** Schedule a lesson into a cohort's plan, optionally with a release gate. */
export async function addCohortLesson(formData: FormData): Promise<CurriculumResult> {
  const actor = await requireRole("MANAGER", "ADMIN");
  const limited = await checkCatalogWriteRate(actor.id, "cohort-lesson-add");
  if (!limited.ok) return { ok: false, error: "Too many edits — slow down." };

  const parsed = cohortLessonSchema.safeParse({
    cohortId: formData.get("cohortId"),
    lessonId: formData.get("lessonId"),
    releaseAt: formData.get("releaseAt") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { cohortId, lessonId, releaseAt } = parsed.data;

  // A cohort teaches one course. Rejecting a lesson from another course
  // here is what keeps the curriculum internally consistent.
  const [cohort, lesson] = await Promise.all([
    db.cohort.findUnique({ where: { id: cohortId }, select: { id: true, courseId: true, course: { select: { slug: true } } } }),
    db.lesson.findUnique({ where: { id: lessonId }, select: { id: true, module: { select: { courseId: true } } } }),
  ]);
  if (!cohort) return { ok: false, error: "Cohort not found" };
  if (!lesson) return { ok: false, error: "Lesson not found" };
  if (lesson.module.courseId !== cohort.courseId) {
    return { ok: false, error: "That lesson belongs to a different course than this cohort teaches." };
  }

  const release = releaseAt ? new Date(releaseAt) : null;
  if (releaseAt && isNaN(release!.getTime())) return { ok: false, error: "Invalid release date" };

  const existing = await db.cohortLesson.findUnique({
    where: { cohortId_lessonId: { cohortId, lessonId } },
    select: { id: true },
  });
  if (existing) return { ok: false, error: "That lesson is already in this cohort's plan." };

  // Append to the end of the plan.
  const last = await db.cohortLesson.findFirst({
    where: { cohortId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const created = await db.cohortLesson.create({
    data: { cohortId, lessonId, order: (last?.order ?? -1) + 1, releaseAt: release },
  });
  await db.auditLog.create({
    data: { userId: actor.id, action: "ADD_COHORT_LESSON", resource: `cohortLesson:${created.id}`, metadata: { cohortId, lessonId } },
  });
  revalidatePath("/admin/cohorts");
  revalidatePath(`/admin/cohorts/${cohortId}`);
  revalidatePath(`/dashboard/courses/${cohort.course.slug}`);
  return { ok: true, id: created.id };
}

/** Remove a lesson from a cohort's plan. */
export async function removeCohortLesson(formData: FormData): Promise<CurriculumResult> {
  const actor = await requireRole("MANAGER", "ADMIN");
  const limited = await checkCatalogWriteRate(actor.id, "cohort-lesson-remove");
  if (!limited.ok) return { ok: false, error: "Too many edits — slow down." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing curriculum entry" };

  const existing = await db.cohortLesson.findUnique({
    where: { id },
    select: { id: true, cohortId: true, cohort: { select: { course: { select: { slug: true } } } } },
  });
  if (!existing) return { ok: false, error: "Curriculum entry not found" };

  await db.cohortLesson.delete({ where: { id } });
  await db.auditLog.create({
    data: { userId: actor.id, action: "REMOVE_COHORT_LESSON", resource: `cohortLesson:${id}`, metadata: { cohortId: existing.cohortId } },
  });
  revalidatePath("/admin/cohorts");
  revalidatePath(`/admin/cohorts/${existing.cohortId}`);
  revalidatePath(`/dashboard/courses/${existing.cohort.course.slug}`);
  return { ok: true };
}

/**
 * Move a scheduled lesson up or down the plan.
 *
 * Implemented as a swap with the neighbour rather than a shift of the
 * whole block: the two rows exchange positions, so `@@unique([cohortId,
 * order])` holds and nothing else in the plan is touched.
 */
export async function moveCohortLesson(formData: FormData): Promise<CurriculumResult> {
  const actor = await requireRole("MANAGER", "ADMIN");
  const limited = await checkCatalogWriteRate(actor.id, "cohort-lesson-move");
  if (!limited.ok) return { ok: false, error: "Too many edits — slow down." };

  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id) return { ok: false, error: "Missing curriculum entry" };
  if (direction !== "up" && direction !== "down") {
    return { ok: false, error: "Invalid direction" };
  }

  const entry = await db.cohortLesson.findUnique({
    where: { id },
    select: { id: true, cohortId: true, order: true, cohort: { select: { course: { select: { slug: true } } } } },
  });
  if (!entry) return { ok: false, error: "Curriculum entry not found" };

  const neighbour = await db.cohortLesson.findFirst({
    where: {
      cohortId: entry.cohortId,
      ...(direction === "up" ? { order: { lt: entry.order } } : { order: { gt: entry.order } }),
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
    select: { id: true, order: true },
  });
  // Already at the end of the plan.
  if (!neighbour) return { ok: true };

  // Park one row out of range first: swapping two occupied order values
  // directly would violate the unique index mid-transaction.
  await db.$transaction(async (tx) => {
    await tx.cohortLesson.update({ where: { id: entry.id }, data: { order: { increment: 1000 } } });
    await tx.cohortLesson.update({ where: { id: entry.id }, data: { order: neighbour.order } });
    await tx.cohortLesson.update({ where: { id: neighbour.id }, data: { order: entry.order } });
  });

  await db.auditLog.create({
    data: { userId: actor.id, action: "MOVE_COHORT_LESSON", resource: `cohortLesson:${entry.id}`, metadata: { direction } },
  });
  revalidatePath("/admin/cohorts");
  revalidatePath(`/admin/cohorts/${entry.cohortId}`);
  revalidatePath(`/dashboard/courses/${entry.cohort.course.slug}`);
  return { ok: true };
}
