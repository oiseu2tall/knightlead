"use client";

// Responsive dashboard shell. Two visual surfaces:
//   1. A role-aware sidebar (drawer) — sectioned by capability, with
//      a brand-tinted role pill, an identity block, and a contextual
//      "primary action" pinned to the bottom.
//   2. A top bar (AppBar) with a role context chip, contextual
//      quick-actions, a search affordance for staff, theme toggle,
//      and the user menu.
//
// The shell itself is purely presentational — the role/section logic
// lives in lib/role.ts and the route gates in proxy.ts + layouts.
import { useEffect, useMemo, useState, type ReactNode, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { signOutAction } from "@/app/(auth)/signout-action";
import { RoleBadge } from "@/components/ui/Primitives";
import { isRole, ROLE_META, type Role } from "@/lib/role";

// ---------------------------------------------------------------------------
// Nav model — sectioned by capability, role-filtered.
// ---------------------------------------------------------------------------

type IconName = keyof typeof Icon;
type NavItem = {
  label: string;
  href: string;
  icon: IconName;
  roles: Role[]; // explicit allow-list; no implicit inheritance
  description?: string; // tooltip / sub-label
};

type NavSection = {
  /** Section title shown above the items. */
  title: string;
  /** Tailwind class for the small accent dot. */
  accent: string;
  items: NavItem[];
};

const STUDENT_ITEMS: NavItem[] = [
  { label: "Dashboard",   href: "/dashboard",             icon: "Dashboard",   roles: ["STUDENT"] },
  { label: "My courses",  href: "/dashboard/courses",     icon: "School",      roles: ["STUDENT"], description: "Enrolled courses" },
  { label: "Assignments", href: "/dashboard/assignments", icon: "Assignment",  roles: ["STUDENT"] },
  { label: "Browse",      href: "/dashboard/courses/browse", icon: "Group",    roles: ["STUDENT"], description: "Find new courses" },
];

const INSTRUCTOR_ITEMS: NavItem[] = [
  { label: "Cohorts",     href: "/instructor/cohorts",   icon: "Group",       roles: ["INSTRUCTOR", "ADMIN"], description: "Students you teach" },
  { label: "Grading",     href: "/instructor/grading",   icon: "Assignment",  roles: ["INSTRUCTOR", "ADMIN"], description: "Queue of submissions" },
];

const CATALOG_ITEMS: NavItem[] = [
  { label: "Catalog",     href: "/admin",                icon: "Settings",    roles: ["MANAGER", "ADMIN"] },
  { label: "Cohorts",     href: "/admin/cohorts",        icon: "Group",       roles: ["MANAGER", "ADMIN"] },
  { label: "Courses",     href: "/admin/courses",        icon: "School",      roles: ["MANAGER", "ADMIN"] },
  { label: "Enrollments", href: "/admin/enrollments",    icon: "Assignment",  roles: ["MANAGER", "ADMIN"], description: "Enroll students" },
];

const ADMIN_ITEMS: NavItem[] = [
  { label: "Users",       href: "/admin/users",          icon: "Settings",    roles: ["ADMIN"], description: "Roles & access" },
];

function buildSections(role: Role): NavSection[] {
  const sections: NavSection[] = [];

  // Every role has a "Learn" landing (their own dashboard) but the
  // supporting items only show for students.
  const learnItems: NavItem[] = [
    { label: "Dashboard",   href: "/dashboard",             icon: "Dashboard",  roles: ["STUDENT", "INSTRUCTOR", "MANAGER", "ADMIN"] },
  ];
  if (role === "STUDENT") learnItems.push(...STUDENT_ITEMS.slice(1));
  sections.push({
    title: "Learn",
    accent: "bg-brand-500",
    items: learnItems.filter((i) => i.roles.includes(role)),
  });

  if (role === "INSTRUCTOR" || role === "ADMIN") {
    sections.push({
      title: "Teach",
      accent: "bg-accent-500",
      items: INSTRUCTOR_ITEMS.filter((i) => i.roles.includes(role)),
    });
  }

  if (role === "MANAGER" || role === "ADMIN") {
    sections.push({
      title: "Manage",
      accent: "bg-brand-600",
      items: CATALOG_ITEMS.filter((i) => i.roles.includes(role)),
    });
  }

  if (role === "ADMIN") {
    sections.push({
      title: "Administer",
      accent: "bg-slate-500",
      items: ADMIN_ITEMS.filter((i) => i.roles.includes(role)),
    });
  }

  return sections;
}

// Primary action pinned to the bottom of the sidebar — a "first thing
// you probably came here to do" affordance, role-specific.
function primaryAction(role: Role): { label: string; href: string; icon: IconName } | null {
  switch (role) {
    case "STUDENT":    return { label: "Browse catalog", href: "/dashboard/courses/browse", icon: "Group" };
    case "INSTRUCTOR": return { label: "Open grading",    href: "/instructor/grading",        icon: "Assignment" };
    case "MANAGER":    return { label: "Enroll a student", href: "/admin/enrollments",        icon: "Assignment" };
    case "ADMIN":      return { label: "Manage users",    href: "/admin/users",               icon: "Settings" };
  }
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

const DRAWER_WIDTH = 280;

export function DashboardShell({
  user,
  children,
}: {
  user: { id: string; name?: string | null; email?: string | null; image?: string | null; role: string };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // Initialize from DOM, but avoid setState-in-effect cascading.
    const initialDark = document.documentElement.classList.contains("dark");
    setDark(initialDark);
  }, []);


  const toggleDark = () => {
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
      return next;
    });
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);


  const role: Role = isRole(user.role) ? user.role : "STUDENT";
  const sections = useMemo(() => buildSections(role), [role]);
  const action = primaryAction(role);

  return (
    <div className="flex min-h-dvh bg-surface-muted">
      <div
        className="hidden md:block shrink-0"
        style={{ width: DRAWER_WIDTH }}
        aria-label="Primary navigation"
      >
        <Drawer
          user={user}
          role={role}
          sections={sections}
          pathname={pathname}
          primaryAction={action}
        />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute inset-y-0 left-0"
            style={{ width: DRAWER_WIDTH }}
          >
            <Drawer
              user={user}
              role={role}
              sections={sections}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
              primaryAction={action}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <AppBar
          user={user}
          role={role}
          dark={dark}
          onToggleDark={toggleDark}
          onOpenNav={() => setMobileOpen(true)}
        />

        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawer
// ---------------------------------------------------------------------------

function Drawer({
  user,
  role,
  sections,
  pathname,
  primaryAction,
  onNavigate,
}: {
  user: { id: string; name?: string | null; email?: string | null; role: string };
  role: Role;
  sections: NavSection[];
  pathname: string;
  primaryAction: { label: string; href: string; icon: IconName } | null;
  onNavigate?: () => void;
}) {
  const meta = ROLE_META[role];

  return (
    <aside className="flex h-full flex-col bg-surface border-r border-line">
      {/* Brand mark */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-line">
        <span className="h-8 w-8 rounded-lg bg-hero ring-1 ring-inset ring-line" aria-hidden="true" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight text-ink">Knightlead LMS</p>
          <p className="truncate text-[11px] text-ink-muted">Cohort-based learning</p>
        </div>
      </div>

      {/* Identity block with role pill */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-muted p-3">
          <div
            className={[
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
              role === "INSTRUCTOR" ? "bg-accent-600" :
              role === "MANAGER"    ? "bg-brand-700" :
              role === "ADMIN"      ? "bg-slate-800 dark:bg-slate-200 dark:text-slate-900" :
                                       "bg-brand-500",
            ].join(" ")}
            aria-hidden="true"
          >
            {(user.name?.[0] ?? user.email?.[0] ?? "?").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{user.name ?? "Learner"}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.navAccent}`} aria-hidden="true" />
              <span className="truncate text-[11px] font-medium uppercase tracking-wider text-ink-muted">
                {meta.plural} workspace
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sectioned nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        {sections.map((section, sIdx) => (
          <div key={section.title} className={sIdx === 0 ? "" : "mt-5"}>
            <div className="mb-1.5 flex items-center gap-2 px-2">
              <span className={`h-1.5 w-1.5 rounded-full ${section.accent}`} aria-hidden="true" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                {section.title}
              </p>
            </div>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const I = Icon[item.icon];
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={[
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-200"
                          : "text-ink-muted hover:bg-surface-dim hover:text-ink",
                      ].join(" ")}
                    >
                      {active && (
                        <span
                          aria-hidden="true"
                          className={`absolute inset-y-1 left-0 w-0.5 rounded-r-full ${section.accent}`}
                        />
                      )}
                      <I className="h-5 w-5 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Primary action pinned to the bottom — the "first thing you'd come here to do". */}
      {primaryAction && (
        <div className="border-t border-line p-3">
          <Link
            href={primaryAction.href}
            onClick={onNavigate}
            className="group flex w-full items-center gap-3 rounded-lg bg-hero px-3 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-pop)] transition-opacity hover:opacity-95"
          >
            {(() => {
              const I = Icon[primaryAction.icon];
              return <I className="h-5 w-5 shrink-0" />;
            })()}
            <span className="truncate">{primaryAction.label}</span>
            <span className="ml-auto text-white/80 transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
      )}

      <div className="border-t border-line p-2">
        <SignOutButton />
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// AppBar
// ---------------------------------------------------------------------------

function AppBar({
  user,
  role,
  dark,
  onToggleDark,
  onOpenNav,
}: {
  user: { id: string; name?: string | null; email?: string | null; role: string };
  role: Role;
  dark: boolean;
  onToggleDark: () => void;
  onOpenNav: () => void;
}) {
  const pathname = usePathname();
  const meta = ROLE_META[role];

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-surface/85 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onOpenNav}
        className="rounded-md p-2 text-ink hover:bg-surface-dim md:hidden"
        aria-label="Open navigation"
      >
        <Icon.Menu />
      </button>
      <h1 className="flex items-center gap-2 text-base font-bold tracking-tight text-ink sm:text-lg">
        <span className="h-5 w-5 rounded-md bg-hero md:hidden" aria-hidden="true" />
        <span className="hidden md:inline">Knightlead LMS</span>
        <span className="ml-1 hidden text-ink-muted sm:inline">/</span>
        <Breadcrumb pathname={pathname} role={role} />
      </h1>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <RoleBadge role={role} size="sm" className="hidden sm:inline-flex" />

        {role === "INSTRUCTOR" && <QuickAction href="/instructor/grading" label="Grading" icon="Assignment" />}
        {role === "MANAGER"    && <QuickAction href="/admin/enrollments" label="Enroll" icon="Group" />}
        {role === "ADMIN"      && <QuickAction href="/admin/users" label="Users" icon="Settings" />}
        {role === "STUDENT"    && pathname !== "/dashboard/courses/browse" && (
          <QuickAction href="/dashboard/courses/browse" label="Browse" icon="Group" />
        )}

        <button
          type="button"
          onClick={onToggleDark}
          className="rounded-md p-2 text-ink hover:bg-surface-dim"
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? <Icon.Sun /> : <Icon.Moon />}
        </button>
        <UserMenu user={user} roleLabel={meta.label} rolePlural={meta.plural} />
      </div>
    </header>
  );
}

function QuickAction({
  href,
  label,
  icon,
}: { href: string; label: string; icon: IconName }) {
  const I = Icon[icon];
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:bg-surface-dim hover:text-ink"
    >
      <I className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

function Breadcrumb({ pathname, role }: { pathname: string; role: Role }) {
  // The current section (e.g. "Catalog", "Teach", "Manage") shown
  // next to the brand mark. Helps the user orient as they navigate.
  const map: Array<[RegExp, string]> = [
    [/^\/dashboard(\/|$)/,                "Learn"],
    [/^\/instructor\/cohorts(\/|$)/,      "Teach · Cohorts"],
    [/^\/instructor\/grading(\/|$)/,      "Teach · Grading"],
    [/^\/admin\/cohorts(\/|$)/,           "Manage · Cohorts"],
    [/^\/admin\/courses(\/|$)/,           "Manage · Courses"],
    [/^\/admin\/enrollments(\/|$)/,       "Manage · Enrollments"],
    [/^\/admin\/users(\/|$)/,             "Administer · Users"],
    [/^\/admin(\/|$)/,                    "Manage · Catalog"],
  ];
  let label = "Learn";
  for (const [re, txt] of map) {
    if (re.test(pathname)) { label = txt; break; }
  }
  // role echo: "Learn" is the right label for student; for staff, the
  // section comes from the map.
  if (role !== "STUDENT" && (pathname === "/dashboard" || pathname === "/dashboard/")) {
    label = ROLE_META[role].plural + " · Home";
  }
  return <span className="ml-1 truncate text-sm font-medium text-ink-muted">{label}</span>;
}

// ---------------------------------------------------------------------------
// Sign-out + User menu
// ---------------------------------------------------------------------------

function SignOutButton({ className = "" }: { className?: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => signOutAction())}
      disabled={pending}
      className={[
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-dim hover:text-ink disabled:opacity-60",
        className,
      ].join(" ")}
    >
      {pending ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <Icon.Logout className="h-4 w-4" />
      )}
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

function UserMenu({
  user,
  roleLabel,
  rolePlural,
}: {
  user: { name?: string | null; email?: string | null; role: string };
  roleLabel: string;
  rolePlural: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-line bg-surface p-1 hover:bg-surface-dim"
        aria-label="Open account menu"
        aria-expanded={open}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
          {(user.name?.[0] ?? user.email?.[0] ?? "?").toUpperCase()}
        </div>
        <span className="hidden pr-2 text-xs font-semibold text-ink sm:inline">{user.name?.split(" ")[0] ?? "Account"}</span>
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-pop)]"
          >
            <div className="border-b border-line bg-surface-muted px-4 py-3">
              <p className="truncate text-sm font-semibold text-ink">{user.name ?? "Learner"}</p>
              <p className="truncate text-xs text-ink-muted">{user.email}</p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden="true" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  {roleLabel} · {rolePlural} workspace
                </span>
              </div>
            </div>

            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-ink-muted hover:bg-surface-dim"
            >
              <Icon.Dashboard className="h-4 w-4" />
              Your dashboard
            </Link>

            <div className="border-t border-line">
              <SignOutButton className="rounded-none" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
