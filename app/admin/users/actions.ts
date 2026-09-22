"use server";

// Admin-only server actions. Every mutation is logged to AuditLog.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

const ROLES = ["STUDENT", "INSTRUCTOR", "MANAGER", "ADMIN"] as const;
const roleSchema = z.enum(ROLES);

const changeRoleSchema = z.object({
  userId: z.string().min(1).max(64),
  role: roleSchema,
});

export type ChangeRoleResult = { ok: true } | { ok: false; error: string };

export type DeleteUserResult = { ok: true } | { ok: false; error: string };
const deleteSchema = z.object({ id: z.string().min(1).max(64) });

export type SuspendUserResult = { ok: true } | { ok: false; error: string };
const suspendSchema = z.object({ id: z.string().min(1).max(64), suspended: z.string() });

/**
 * Suspend or activate a user account. ADMIN only.
 *
 * A suspended user cannot sign in — the Credentials provider rejects
 * them at `authorize()` time (see auth.ts) and existing sessions are
 * invalidated on next JWT refresh. Idempotent: setting the current
 * state is a no-op success.
 *
 * Self-suspension is blocked: an admin who locks themselves out has
 * no way to undo the damage.
 */
export async function setUserSuspended(formData: FormData): Promise<SuspendUserResult> {
  const admin = await requireRole("ADMIN");

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limited = await rateLimit(`admin-suspend:${admin.id}:${ip}`, {
    limit: 20, windowMs: 60_000,
  });
  if (!limited.ok) return { ok: false, error: "Too many changes — slow down." };

  const parsed = suspendSchema.safeParse({
    id: formData.get("id"),
    suspended: formData.get("suspended"),
  });
  if (!parsed.success) return { ok: false, error: "Missing or invalid user id" };
  const { id, suspended: raw } = parsed.data;
  const nextSuspended = raw === "true";

  if (id === admin.id) {
    return { ok: false, error: "You can't suspend your own account." };
  }

  const existing = await db.user.findUnique({ where: { id }, select: { id: true, email: true, name: true, suspended: true } });
  if (!existing) return { ok: false, error: "User not found" };
  if (existing.suspended === nextSuspended) return { ok: true }; // idempotent

  await db.user.update({ where: { id }, data: { suspended: nextSuspended } });
  await db.auditLog.create({
    data: {
      userId: admin.id,
      action: nextSuspended ? "SUSPEND_USER" : "ACTIVATE_USER",
      resource: `user:${id}`,
      metadata: { email: existing.email, name: existing.name, suspended: nextSuspended },
    },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
  return { ok: true };
}

export async function deleteUser(formData: FormData): Promise<DeleteUserResult> {
  const admin = await requireRole("ADMIN");

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limited = await rateLimit(`admin-user-del:${admin.id}:${ip}`, {
    limit: 10, windowMs: 60_000,
  });
  if (!limited.ok) return { ok: false, error: "Too many deletions — slow down." };

  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Missing or invalid user id" };
  const { id } = parsed.data;

  if (id === admin.id) return { ok: false, error: "You can't delete your own account." };

  const existing = await db.user.findUnique({ where: { id }, select: { id: true, email: true, name: true, role: true } });
  if (!existing) return { ok: false, error: "User not found" };

  await db.user.delete({ where: { id } });

  await db.auditLog.create({
    data: {
      userId: admin.id,
      action: "DELETE_USER",
      resource: `user:${id}`,
      metadata: { email: existing.email, name: existing.name, role: existing.role },
    },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
  return { ok: true };
}

export async function changeUserRole(formData: FormData): Promise<ChangeRoleResult> {
  const admin = await requireRole("ADMIN");

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limited = await rateLimit(`admin-role:${admin.id}:${ip}`, {
    limit: 30, windowMs: 60_000,
  });
  if (!limited.ok) return { ok: false, error: "Too many changes — slow down." };

  const parsed = changeRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { userId, role } = parsed.data;

  // Don't let an admin demote themselves (would lock them out).
  if (userId === admin.id && role !== "ADMIN") {
    return { ok: false, error: "You can't change your own role." };
  }

  // Only act on users that exist; capture the previous role for the audit log.
  const prev = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!prev) return { ok: false, error: "User not found" };
  if (prev.role === role) return { ok: true }; // no-op

  await db.user.update({ where: { id: userId }, data: { role } });

  await db.auditLog.create({
    data: {
      userId: admin.id,
      action: "CHANGE_USER_ROLE",
      resource: `user:${userId}`,
      metadata: { from: prev.role, to: role },
    },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}
