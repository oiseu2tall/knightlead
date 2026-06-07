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
