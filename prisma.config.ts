// Prisma CLI configuration.
//
// Replaces the deprecated `package.json#prisma` block, which Prisma 7
// removes. The CLI loads this file for every command, so `.env` is
// imported here explicitly — the CLI no longer does it implicitly once
// a config file exists.

import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // The seed refuses to run under NODE_ENV=production, so pin the mode
    // rather than inheriting whatever the shell happens to have.
    seed: "cross-env NODE_ENV=development tsx prisma/seed.ts",
  },
  datasource: {
    // Read via process.env rather than the `env()` helper: `env()` throws
    // while the config is being loaded, which would break `prisma generate`
    // on build machines and CI jobs that don't have a database URL set.
    // `migrate deploy` still fails loudly, just with Prisma's own message.
    url: process.env.DATABASE_URL ?? "",
  },
});
