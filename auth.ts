// Auth.js v5 configuration — credentials + Prisma adapter
// Docs: https://authjs.dev/getting-started

import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

// ---- Module augmentation: add `role` to the session/user ----
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      emailVerified: Date | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: Role;
    emailVerified?: Date | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    uid?: string;
    ev?: number | null; // emailVerified epoch ms
  }
}

const credentialsSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  // 30-minute idle, 7-day absolute. Rotate on privilege change.
  maxAge: 60 * 60 * 24 * 7,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await db.user.findUnique({
          where: { email: email.toLowerCase() },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            hashedPassword: true,
            role: true,
          },
        });

        // Constant-time bcrypt compare; equal time whether or not the
        // user exists (mitigates user-enumeration via timing).
        const dummy =
          "$2a$12$0000000000000000000000.0000000000000000000000000000000000";
        const ok = await bcrypt.compare(
          password,
          user?.hashedPassword ?? dummy,
        );
        if (!user || !user.hashedPassword || !ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as { role?: Role }).role ?? "STUDENT";
        token.ev = (user as { emailVerified?: Date | null }).emailVerified
          ? (user as { emailVerified: Date }).emailVerified.getTime()
          : null;
      }
      // Self-heal: if the token predates an email verification (e.g. the
      // user logged in before being verified, or the seed set the column
      // after login), re-read the DB so the gate sees the fresh state.
      // Cost: one indexed PK lookup, only on the authed code path, only
      // when the token's ev is missing or older than the DB's value.
      if (token.uid && trigger !== "signIn") {
        const { db } = await import("@/lib/db");
        const u = await db.user.findUnique({
          where: { id: token.uid },
          select: { role: true, emailVerified: true },
        });
        if (u) {
          const dbEv = u.emailVerified?.getTime() ?? null;
          // Update if DB has a value and the token has none, or DB is newer.
          if (dbEv !== null && (token.ev == null || dbEv > token.ev)) {
            token.ev = dbEv;
          }
          // Always trust the DB role over the (possibly stale) token role.
          if (u.role) token.role = u.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) session.user.id = token.uid;
      if (token.role) session.user.role = token.role;
      session.user.emailVerified = typeof token.ev === "number" ? new Date(token.ev) : null;
      return session;
    },
    // Reject unverified emails on protected routes when used.
    authorized({ auth: session, request }) {
      const { pathname } = request.nextUrl;
      const isAuthed = !!session?.user;

      // Public routes — always allow.
      const PUBLIC = [
        "/", "/login", "/register", "/forgot-password",
        "/verify-email",        // consumes the link
        "/forbidden",
        "/api/auth",
      ];
      if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
        return true;
      }

      // Everything else requires a session.
      return isAuthed;
    },
  },
  trustHost: true,
});
