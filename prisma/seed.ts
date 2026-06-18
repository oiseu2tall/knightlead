// Dev-only seed: one verified user per role, idempotent.
// Refuses to run when NODE_ENV=production.
//
// Usage:
//   npx prisma db seed
// or
//   npm run db:seed

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

if (process.env.NODE_ENV === "production") {
   
  console.error("❌ Refusing to seed in production. Set NODE_ENV=development.");
  process.exit(1);
}

const db = new PrismaClient();

// All accounts use the same password in dev for convenience. The user is
// expected to change them — these are NOT meant for any deployed env.
const DEV_PASSWORD = "Password123!";

type SeedUser = {
  email: string;
  name: string;
  role: "STUDENT" | "INSTRUCTOR" | "MANAGER" | "ADMIN";
};

const USERS: SeedUser[] = [
  { email: "student@knightlead.dev",   name: "Sam Student",     role: "STUDENT" },
  { email: "instructor@knightlead.dev", name: "Ivy Instructor",  role: "INSTRUCTOR" },
  { email: "manager@knightlead.dev",    name: "Morgan Manager",  role: "MANAGER" },
  { email: "admin@knightlead.dev",      name: "Alex Admin",      role: "ADMIN" },
];

async function main() {
  const hashed = await bcrypt.hash(DEV_PASSWORD, 12);

  for (const u of USERS) {
    const verifiedAt = new Date();
    const user = await db.user.upsert({
      where: { email: u.email },
      update: {
        // Re-seedable: ALWAYS force a verified timestamp so a previous
        // unverified state (from manual testing, a wiped DB column, etc.)
        // is corrected on the next `npm run db:seed`.
        name: u.name,
        role: u.role,
        emailVerified: verifiedAt,
        // Keep the existing password if the user already changed it;
        // only set the dev default on initial create.
      },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        hashedPassword: hashed,
        emailVerified: verifiedAt,
      },
    });

    // If the row existed and had no password (e.g. created via OAuth),
    // make sure a password is set so credentials login works.
    if (!user.hashedPassword) {
      await db.user.update({
        where: { id: user.id },
        data: { hashedPassword: hashed },
      });
    }

     
    console.log(`✓ ${u.role.padEnd(10)} ${u.email}`);
  }

   
  console.log(`\nDev password for all accounts: ${DEV_PASSWORD}`);
}

main()
  .catch((e) => {
     
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
