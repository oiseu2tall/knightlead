// Single source of truth for role-driven UI affordances.
// All pages, sidebars, and dashboards should consult this rather than
// inlining role checks. Mirrors the capability helpers in
// lib/auth-guard.ts — this file is for presentation, not authorization.

export type Role = "STUDENT" | "INSTRUCTOR" | "MANAGER" | "ADMIN";

export const ROLES: Role[] = ["STUDENT", "INSTRUCTOR", "MANAGER", "ADMIN"];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}

// Brand-aware color tokens per role. The student "learn" group uses
// the brand blue, the "teach" group uses accent yellow, the "manage"
// group uses a deeper brand shade, and admin uses a neutral slate.
export const ROLE_META: Record<Role, {
  label: string;        // human label, "Student", "Manager", …
  plural: string;       // used in nav section headers, "Learn", "Teach", …
  blurb: string;        // short description shown next to the role pill
  tone: "brand" | "accent" | "neutral" | "admin";
  badgeClass: string;   // tailwind class for the role pill
  navAccent: string;    // sidebar section accent color
}> = {
  STUDENT: {
    label: "Student",
    plural: "Learn",
    blurb: "Take courses, submit work, track your progress.",
    tone: "brand",
    badgeClass: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-500/30",
    navAccent: "bg-brand-500",
  },
  INSTRUCTOR: {
    label: "Instructor",
    plural: "Teach",
    blurb: "Grade submissions, support your cohort.",
    tone: "accent",
    badgeClass: "bg-accent-50 text-accent-800 ring-1 ring-inset ring-accent-200 dark:bg-accent-500/10 dark:text-accent-200 dark:ring-accent-500/30",
    navAccent: "bg-accent-500",
  },
  MANAGER: {
    label: "Manager",
    plural: "Manage",
    blurb: "Run the catalog — cohorts, courses, modules, enrollment.",
    tone: "brand",
    badgeClass: "bg-brand-100 text-brand-800 ring-1 ring-inset ring-brand-300 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30",
    navAccent: "bg-brand-600",
  },
  ADMIN: {
    label: "Admin",
    plural: "Administer",
    blurb: "Full access including user management and role changes.",
    tone: "neutral",
    badgeClass: "bg-slate-100 text-slate-800 ring-1 ring-inset ring-slate-300 dark:bg-slate-700/40 dark:text-slate-100 dark:ring-slate-500/30",
    navAccent: "bg-slate-700 dark:bg-slate-300",
  },
};

/** Human label safe to render. Falls back to the raw string. */
export function roleLabel(role: string | null | undefined): string {
  if (isRole(role)) return ROLE_META[role].label;
  return role ?? "Member";
}

/** Section label for the sidebar (e.g. "Learn", "Teach"). */
export function roleSection(role: string | null | undefined): string {
  if (isRole(role)) return ROLE_META[role].plural;
  return "Workspace";
}
