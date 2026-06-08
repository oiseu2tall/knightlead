"use server";

// Catalog management server actions — cohorts, courses, modules.
// Accessible to MANAGER and ADMIN. Re-checked inside every action
// (proxy + layout gate are not enough).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
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
  name: z.string().trim().min(1, "Name is required").max(120),
  slug: z.string().trim().max(80).optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  description: z.string().trim().max(2_000).optional().default(""),
  managerId: z.string().max(64).optional().or(z.literal("")),
});

export async function upsertCohort(formData: FormData): Promise<CatalogResult> {
  const actor = await requireRole("MANAGER", "ADMIN");
  const limited = await checkCatalogWriteRate(actor.id, "cohort");
  if (!limited.ok) return { ok: false, error: "Too many edits — slow down." };

  const parsed = cohortSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    slug: formData.get("slug") || undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    description: formData.get("description") ?? "",
    managerId: formData.get("managerId") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { ok: false, error: "Invalid date" };
  }
  if (end <= start) return { ok: false, error: "End date must be after start date" };

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

  if (data.id) {
    const existing = await db.cohort.findUnique({ where: { id: data.id }, select: { id: true } });
    if (!existing) return { ok: false, error: "Cohort not found" };
    await db.cohort.update({
      where: { id: data.id },
      data: { name: data.name, slug: finalSlug, startDate: start, endDate: end, description: data.description, managerId },
    });
    await db.auditLog.create({
      data: { userId: actor.id, action: "UPDATE_COHORT", resource: `cohort:${data.id}`, metadata: { name: data.name } },
    });
  } else {
    const created = await db.cohort.create({
      data: { name: data.name, slug: finalSlug, startDate: start, endDate: end, description: data.description, managerId },
    });
    await db.auditLog.create({
      data: { userId: actor.id, action: "CREATE_COHORT", resource: `cohort:${created.id}`, metadata: { name: data.name, slug: finalSlug } },
    });
  }

  revalidatePath("/admin/cohorts");
  return { ok: true, slug: finalSlug };
}

export async function deleteCohort(formData: FormData): Promise<CatalogResult> {
  const actor = await requireRole("MANAGER", "ADMIN");
  const limited = await checkCatalogWriteRate(actor.id, "cohort-del");
  if (!limited.ok) return { ok: false, error: "Too many edits — slow down." };
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing cohort id" };

  // Refuse to delete a cohort that still has enrollments — orphaning
  // students is worse than a refused delete.
  const enrollCount = await db.enrollment.count({ where: { cohortId: id } });
  if (enrollCount > 0) {
    return { ok: false, error: `Cannot delete: ${enrollCount} enrollment(s) still reference this cohort.` };
  }

  const existing = await db.cohort.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!existing) return { ok: false, error: "Cohort not found" };

  await db.cohort.delete({ where: { id } });
  await db.auditLog.create({
    data: { userId: actor.id, action: "DELETE_COHORT", resource: `cohort:${id}`, metadata: { name: existing.name } },
  });
  revalidatePath("/admin/cohorts");
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

  const enrollCount = await db.enrollment.count({ where: { courseId: id } });
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
// Staff-initiated enrollment
// ---------------------------------------------------------------------------

export type StaffEnrollResult =
  | { ok: true; created: boolean }
  | { ok: false; error: string };

const staffEnrollSchema = z.object({
  studentId: z.string().min(1, "Pick a student").max(64),
  courseId: z.string().min(1, "Pick a course").max(64),
  // Optional — manager may attach the student to a specific cohort for
  // this course. An empty string means "no cohort".
  cohortId: z.string().max(64).optional().or(z.literal("")),
});

/**
 * Enroll a STUDENT in a course, optionally tagged with a cohort.
 *
 * Role rule: only MANAGER + ADMIN can call this. INSTRUCTORs cannot.
 * The student is always a STUDENT — staff enrolling other staff would
 * defeat the audit trail. The action is idempotent: a duplicate
 * `(studentId, courseId)` is treated as success with `created: false`,
 * which is the right behaviour when the manager clicks "Enroll"
 * twice or the form is re-submitted.
 *
 * The `cohortId` is attached only to this enrollment; it does not
 * retroactively tag earlier enrollments.
 */
export async function staffEnrollStudent(formData: FormData): Promise<StaffEnrollResult> {
  const actor = await requireRole("MANAGER", "ADMIN");
  const limited = await checkCatalogWriteRate(actor.id, "staff-enroll");
  if (!limited.ok) return { ok: false, error: "Too many actions — slow down." };

  const parsed = staffEnrollSchema.safeParse({
    studentId: formData.get("studentId"),
    courseId: formData.get("courseId"),
    cohortId: formData.get("cohortId") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { studentId, courseId, cohortId } = parsed.data;

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

  // The course must exist. Drafts (isPublished=false) are still
  // enrollable by staff — that's how a manager onboards a class to
  // a course that's not yet announced.
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, slug: true, title: true },
  });
  if (!course) return { ok: false, error: "Course not found" };

  // Optional cohort — must exist if provided.
  let resolvedCohortId: string | null = null;
  if (cohortId && cohortId.length > 0) {
    const cohort = await db.cohort.findUnique({ where: { id: cohortId }, select: { id: true } });
    if (!cohort) return { ok: false, error: "Cohort not found" };
    resolvedCohortId = cohort.id;
  }

  // Idempotent. If a row already exists, optionally update its cohort
  // tag so the manager can move a student between cohorts.
  const existing = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: studentId, courseId } },
    select: { id: true, cohortId: true },
  });

  if (existing) {
    if (existing.cohortId !== resolvedCohortId) {
      await db.enrollment.update({
        where: { id: existing.id },
        data: { cohortId: resolvedCohortId },
      });
      await db.auditLog.create({
        data: {
          userId: actor.id,
          action: "STAFF_REASSIGN_COHORT",
          resource: `enrollment:${existing.id}`,
          metadata: {
            student: student.email,
            course: course.title,
            from: existing.cohortId,
            to: resolvedCohortId,
          },
        },
      });
    }
    revalidatePath("/admin/enrollments");
    revalidatePath(`/admin/courses/${course.slug}`);
    return { ok: true, created: false };
  }

  await db.enrollment.create({
    data: {
      userId: studentId,
      courseId,
      cohortId: resolvedCohortId,
      status: "ACTIVE",
      progress: 0,
    },
  });

  await db.auditLog.create({
    data: {
      userId: actor.id,
      action: "STAFF_ENROLL_STUDENT",
      resource: `enrollment:${courseId}:${studentId}`,
      metadata: {
        student: student.email,
        course: course.title,
        cohort: resolvedCohortId,
      },
    },
  });

  revalidatePath("/admin/enrollments");
  revalidatePath(`/admin/courses/${course.slug}`);
  revalidatePath("/instructor/cohorts");
  return { ok: true, created: true };
}
