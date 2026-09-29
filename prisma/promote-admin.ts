// Ops tool: grant a role to an existing user by email.
//
// Why this exists: there is no way to create the first ADMIN through the
// app. Registration hard-codes STUDENT (app/(auth)/actions.ts), changing a
// role requires being ADMIN already (app/admin/users/actions.ts), and the
// seed refuses to run under NODE_ENV=production. So on a fresh production
// database the first real admin has to be promoted out-of-band — this is
// that path, rather than hand-writing SQL in a dashboard.
//
// Usage:
//   npm run db:promote -- you@example.com            # → ADMIN
//   npm run db:promote -- you@example.com MANAGER
//
// Targets whichever DATABASE_URL is in the environment, so point at
// production with `vercel env pull .env.production.local` first, or run it
// as a one-off Vercel command.

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const ROLES = ["STUDENT", "INSTRUCTOR", "MANAGER", "ADMIN"] as const;
type Role = (typeof ROLES)[number];

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
  // Flags are stripped before positional parsing so `--yes` in any
  // position can't be mistaken for a role.
  const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const [emailArg, roleArg] = positional;

  if (!emailArg) {
    console.error(
      "Usage: npm run db:promote -- <email> [STUDENT|INSTRUCTOR|MANAGER|ADMIN] [--yes]",
    );
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();
  const role = (roleArg ?? "ADMIN") as Role;
  if (!ROLES.includes(role)) {
    console.error(`Invalid role "${roleArg}". Expected one of: ${ROLES.join(", ")}`);
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set — this would promote nobody.");
    process.exit(1);
  }
  // Always name the target host. `dotenv/config` loads only `.env`, so a
  // `vercel env pull` into some other filename silently leaves you pointed
  // at the local database — promoting the wrong one is the easy mistake
  // here, and a wrong-but-plausible result is worse than a refusal.
  console.log(`[promote] target host: ${hostOf(process.env.DATABASE_URL)}`);

  const confirm = process.argv.includes("--yes");
  if (!confirm && process.env.NODE_ENV === "production") {
    console.error(
      "Refusing to run non-interactively in production without --yes.\n" +
        "Re-run with --yes once the host above is correct.",
    );
    process.exit(1);
  }

  const db = new PrismaClient();
  try {
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, name: true },
    });

    if (!user) {
      console.error(`No user with email ${email}. Register the account first, then re-run.`);
      process.exit(1);
    }

    if (user.role === role) {
      console.log(`${user.email} is already ${role} — nothing to do.`);
      return;
    }

    const from = user.role;
    await db.user.update({ where: { id: user.id }, data: { role } });
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "PROMOTE_USER",
        resource: `user:${user.id}`,
        metadata: { from, to: role, via: "cli:prisma/promote-admin" },
      },
    });

    console.log(`✓ ${user.email} (${user.name ?? "unnamed"}): ${from} → ${role}`);
    console.log("  Sign out and back in so the new role lands in the session token.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
