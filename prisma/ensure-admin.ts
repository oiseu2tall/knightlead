// Build-time bootstrap admin.
//
// Guarantees one usable ADMIN exists so a fresh deployment is never
// locked out. The app has no in-app path to create the first admin —
// registration hard-codes STUDENT and `changeUserRole` requires ADMIN —
// and prisma/seed.ts refuses to run under NODE_ENV=production. This runs
// from the `prebuild` hook so every deploy re-asserts the invariant.
//
// Invariants enforced on every run:
//   - the account exists
//   - role = ADMIN
//   - suspended = false
//   - emailVerified is set
//   - a usable password hash exists
//
// The password is only ever *set*, never re-set, on an existing account
// that already has one, so a later password change isn't silently undone
// by a redeploy.
//
// Credentials default to the owner's known values but are overridable
// with BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD.

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const EMAIL = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? "admin@knightleadsolutions.com.ng").toLowerCase();
const PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "Kn1ghtL3@d";
const NAME = "Knightlead Admin";

/** Host + database name only — never the credentials. */
function hostOf(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}/${u.pathname.replace(/^\//, "")}`;
  } catch {
    return "<unparseable DATABASE_URL>";
  }
}

async function main() {
  // No DATABASE_URL means this build isn't wired to a database at all
  // (typecheck-only CI, a docs build). Skipping is correct; failing would
  // block deploys for no reason.
  if (!process.env.DATABASE_URL) {
    console.log("[bootstrap-admin] skipped — DATABASE_URL is not set.");
    return;
  }

  const db = new PrismaClient();
  try {
    await db.$connect();
  } catch (e) {
    // A reachable-but-unreachable database is a real deployment problem,
    // so fail the build rather than shipping an admin-less release.
    console.error(
      "[bootstrap-admin] could not reach the database:\n" +
        `${e instanceof Error ? e.message : String(e)}\n` +
        "Apply migrations first: npx prisma migrate deploy",
    );
    process.exit(1);
  }

  try {
    // Name the target whenever this does something. `dotenv/config` loads
    // only `.env`, so a `vercel env pull` into a different filename leaves
    // you silently pointed at another database.
    const act = async (fn: () => Promise<string>) => {
      console.log(`[bootstrap-admin] target: ${hostOf(process.env.DATABASE_URL!)}`);
      const msg = await fn();
      if (msg) console.log(msg);
    };

    const existing = await db.user.findUnique({
      where: { email: EMAIL },
      select: { id: true, role: true, suspended: true, emailVerified: true, hashedPassword: true },
    });

    if (!existing) {
      await act(async () => {
        await db.user.create({
          data: {
            email: EMAIL,
            name: NAME,
            role: "ADMIN",
            suspended: false,
            emailVerified: new Date(),
            hashedPassword: await bcrypt.hash(PASSWORD, 12),
          },
        });
        return `[bootstrap-admin] created ADMIN ${EMAIL}`;
      });
      return;
    }

    // Already an active, verified admin with a password — nothing to do.
    // This is the common case, so it stays quiet to avoid build-log noise.
    if (
      existing.role === "ADMIN" &&
      !existing.suspended &&
      existing.emailVerified &&
      existing.hashedPassword
    ) {
      return;
    }

    // Repair whatever drifted. An account with no password (OAuth-only)
    // gets one, otherwise the owner would have no way to sign in.
    const data: Record<string, unknown> = {};
    if (existing.role !== "ADMIN") data.role = "ADMIN";
    if (existing.suspended) data.suspended = false;
    if (!existing.emailVerified) data.emailVerified = new Date();
    if (!existing.hashedPassword) data.hashedPassword = await bcrypt.hash(PASSWORD, 12);

    await act(async () => {
      await db.user.update({ where: { id: existing.id }, data });
      const repaired = Object.keys(data)
        .map((k) => (k === "hashedPassword" ? "password set" : k))
        .join(", ");
      return `[bootstrap-admin] repaired ${EMAIL}: ${repaired}`;
    });
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error("[bootstrap-admin] failed:", e);
  process.exit(1);
});
