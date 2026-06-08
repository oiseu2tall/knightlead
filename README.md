# KnightLead — Bootcamp LMS

A full-stack Learning Management System for cohort-based bootcamps. Built on **Next.js 16 (App Router)** with a single Next.js process serving both the UI and the API, **PostgreSQL** for persistence, **Tailwind CSS** for styling, and **Auth.js v5** for authentication.

---

## Features

- 👤 **Auth & roles** — credentials login with bcrypt(12), JWT sessions, role-based access (`STUDENT` / `INSTRUCTOR` / `MANAGER` / `ADMIN`), self-healing JWT that picks up DB-side role/email-verification changes
- 📚 **Courses & lessons** — modules, ordered lessons, per-user completion tracking with auto-recomputed progress (`LessonProgress` model)
- 📝 **Assignments** — text submissions + file attachments, idempotent resubmits, instructor grading with audit log
- 📊 **Instructor grading queue** — filter by status, score cap, optimistic UI, audit trail, scoped to the instructor's own courses
- 🧑‍🤝‍🧑 **Instructor cohorts** — read-only view of cohorts connected to the instructor's courses
- 🛠️ **Catalog management** — MANAGER + ADMIN can create/edit cohorts, courses, and modules; attach PDF/PowerPoint files to modules; instructor and manager pages are role-scoped
- 🔒 **Admin panel** — user search, role filter chips, pagination, inline role change (with audit log), per-user detail with enrollments / submissions / audit timeline. ADMIN only.
- 📎 **Local file storage** — HMAC-signed token URLs, MIME allowlist, 50MB cap, path-traversal guards, S3-shaped interface for easy swap
- ✉️ **Email verification** — single-use tokens (24h TTL), Resend or console transport, auto-redirect to `/verify-email/pending` until verified
- 🛡️ **Security** — proxy-based route gating + server-side re-checks in every layout/action, Zod validation everywhere, per-IP and per-user rate limits (Postgres-backed), `X-Content-Type-Options: nosniff`, HTTP-only cookies
- 🌗 **Theme** — class-based light/dark toggle (no system-preference override), `next/script` no-flash boot, persisted in `localStorage`, default = light
- 📱 **Responsive** — mobile-first, persistent drawer on desktop, temporary drawer on mobile
- 📄 **Branded 404** — friendly not-found page for any dead link

---

## Roles & capabilities

The four roles have **explicit, non-hierarchical** capabilities — ADMIN does *not* automatically inherit the right to enroll or to teach.

| Capability                                  | STUDENT | INSTRUCTOR | MANAGER | ADMIN |
|---------------------------------------------|:-------:|:----------:|:-------:|:-----:|
| Enroll in a course (self)                   |    ✅   |     ❌     |    ❌   |  ❌   |
| Enroll a student in a course / cohort       |    ❌   |     ❌     |    ✅   |  ✅   |
| View "My courses"                           |    ✅   |     —¹     |   —¹    |  —¹   |
| Mark lessons complete / submit assignments  |    ✅   |     ❌     |    ❌   |  ❌   |
| Grade submissions (own courses)             |    ❌   |     ✅     |    ❌   |  ✅²  |
| View cohorts (scoped to courses they teach) |    ❌   |     ✅     |    ❌   |  ✅   |
| Manage cohorts (create / edit / delete)     |    ❌   |     ❌     |    ✅   |  ✅   |
| Manage courses (create / edit / publish)    |    ❌   |     ❌     |    ✅   |  ✅   |
| Manage modules (create / edit / delete)     |    ❌   |     ❌     |    ✅   |  ✅   |
| User management (search, role change)       |    ❌   |     ❌     |    ❌   |  ✅   |
| Promote / demote other users                |    ❌   |     ❌     |    ❌   |  ✅   |
| Self-demote                                 |    —    |     —      |    —    |  ❌   |

¹ Staff accounts don't take courses, so the "My courses" page is empty by design — the catalog at `/dashboard/courses/browse` is shown in read-only mode instead.  
² Admins can grade any submission; instructors are scoped to the courses they teach.

**Two different "enroll" rules — not a typo:**
- **`enrollInCourse` (self-enroll):** only `STUDENT` may call it. The catalog at `/dashboard/courses/browse` shows the Enroll button only to students. Enforced by `canEnroll()` in [lib/auth-guard.ts](lib/auth-guard.ts).
- **`staffEnrollStudent` (enroll-on-behalf-of):** `MANAGER` and `ADMIN` can enroll any `STUDENT` in any course, optionally tagged with a cohort. The page at `/admin/enrollments` is the only UI; the server action refuses to enroll non-students, and records an `STAFF_ENROLL_STUDENT` (or `STAFF_REASSIGN_COHORT`) entry in the audit log. Enforced by `canEnrollOthers()` plus a runtime role check on the target user.

**Why the explicit matrix?** Managers and admins curate the catalog. *Self-enrolling* would put them on grading rosters and progress charts, polluting the instructor's view. *Enrolling others* is the legitimate staff workflow that solves the same problem. The split is enforced in the UI (separate buttons / pages) and in the server actions.

---

## Design system

Two brand colors anchor the UI:

| Token        | Hex       | Role                                           |
|--------------|-----------|------------------------------------------------|
| `brand-*`    | `#5e97e0` | Primary blue — buttons, links, focus rings     |
| `accent-*`   | `#fcba03` | Brand yellow — CTAs, highlights, active state  |

Both colors are expanded into 50→900 scales (defined in [app/globals.css](app/globals.css)) so you get the full set of tints/shades for hover, dark-mode, and tinted surfaces. A `--gradient-hero` CSS variable blends the two colors and is exposed as the `bg-hero` Tailwind utility.

Common patterns:

```tsx
<Button variant="primary">Sign in</Button>      {/* blue */}
<Button variant="accent">Create account</Button> {/* yellow */}
<Card tinted>…</Card>                             {/* brand-tinted background */}
<div className="bg-hero">…</div>                  {/* full blue→yellow gradient */}
<StatCard tone="accent" … />                      {/* yellow left border */}
<Badge tone="accent">…</Badge>                    {/* yellow badge */}
```

Dark mode is class-based (`.dark` on `<html>`) — surface/ink/line tokens remap and the shadows strengthen. The OS preference is **not** honored, so the toggle is the only source of truth.

---

## Stack

| Layer       | Choice                                  |
|-------------|-----------------------------------------|
| Framework   | Next.js 16.2.7 (App Router, RSC)        |
| Language    | TypeScript 5                            |
| UI          | React 19 + Tailwind CSS v4              |
| Auth        | Auth.js v5 (`next-auth@5.0.0-beta.31`)  |
| Database    | PostgreSQL 16 via Prisma 6              |
| Validation  | Zod                                      |
| Mailer      | Resend HTTP API (console fallback)      |
| Storage     | Local disk (`./uploads`)                |
| Rate limit  | Postgres sliding window                 |
| Run scripts | `tsx` + `cross-env`                     |

> **Next 16 specifics:**
> - `middleware.ts` is now **`proxy.ts`**. The function is `export function proxy(req)`.
> - In route handlers and pages, **`params` and `searchParams` are `Promise`s** and must be `await`ed.
> - In React Server Components, use **`next/script` with `strategy="beforeInteractive"`** for code that must run before hydration.
> - **Auth/authorization is re-checked inside every Server Action and protected layout** — the proxy is a first line of defense, not the only one.

---

## Quick start

### Prerequisites

- Node.js 20+
- A running PostgreSQL instance

### Setup

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env.local
# Edit .env.local — at minimum set DATABASE_URL, AUTH_SECRET, MAIL_FROM.
# (Prisma CLI reads .env; Next.js reads both .env and .env.local.)

# Generate AUTH_SECRET with:
openssl rand -base64 32

# 3. Database
npx prisma migrate dev --name init

# 4. (Optional) Seed dev accounts — one verified user per role
npm run db:seed

# 5. Dev server
npm run dev
```

App runs at <http://localhost:3000>.

### Dev seed accounts

`npm run db:seed` (or `npx prisma db seed`) creates four accounts, all already email-verified. The seed is **idempotent** (re-runs force a fresh `emailVerified` timestamp) and **refuses to run when `NODE_ENV=production`**.

| Role        | Email                          | Password       |
|-------------|--------------------------------|----------------|
| `STUDENT`   | `student@knightlead.dev`       | `Password123!` |
| `INSTRUCTOR`| `instructor@knightlead.dev`    | `Password123!` |
| `MANAGER`   | `manager@knightlead.dev`       | `Password123!` |
| `ADMIN`     | `admin@knightlead.dev`         | `Password123!` |

These accounts are for local development only — never deploy a database seeded with them.

### Environment variables

See [`.env.example`](.env.example) for the full list. Key ones:

| Var                | Purpose                                                |
|--------------------|--------------------------------------------------------|
| `DATABASE_URL`     | Postgres connection string                             |
| `AUTH_SECRET`      | 32+ random bytes; signs session JWTs and file tokens   |
| `AUTH_URL`         | Public base URL (used in verification emails)          |
| `RESEND_API_KEY`   | Email delivery; omit to log to console                 |
| `MAIL_FROM`        | `From:` address for transactional mail                 |
| `UPLOAD_DIR`       | Local file storage path (default `./uploads`)          |

---

## Project structure

```
app/
  (auth)/                       Route group: /login, /register
    signout-action.ts           Server action that calls Auth.js signOut
    actions.ts                  loginAction, registerAction
    login/{page,LoginForm}.tsx
    register/{page,RegisterForm}.tsx
  api/
    auth/[...nextauth]/         Auth.js handlers
    files/upload/               POST: multipart file upload
    files/download/[key]/       GET: signed-URL file fetch
  dashboard/                    Authed area, server-rendered
    layout.tsx                  Auth + emailVerified gate
    page.tsx                    Stats + continue learning
    courses/
      page.tsx                  "My courses" — enrolled only
      browse/{page,EnrollButton}.tsx    Published catalog; enroll CTA is STUDENT-only
      [slug]/page.tsx           Course modules + lesson list
      [slug]/lessons/[lessonId] Lesson view, mark-complete, submission form
      actions.ts                markLessonComplete, enrollInCourse
    assignments/{page,actions}.tsx
  instructor/                   Role-gated (INSTRUCTOR | ADMIN)
    cohorts/page.tsx            Read-only — cohorts the instructor teaches into
    grading/                    Role-scoped queue + optimistic grading
      {page, GradingPanel, actions}.tsx
  admin/                        Role-gated (MANAGER | ADMIN; subroutes re-check)
    page.tsx                    Catalog hub (links to enrollments / cohorts / courses / users)
    layout.tsx                  MANAGER + ADMIN pass; per-page tighter check
    catalog/actions.ts          Shared upsert/delete for cohorts, courses, modules,
                                + staffEnrollStudent (MANAGER + ADMIN)
    enrollments/                MANAGER + ADMIN — enroll a student in a course/cohort
      {page, EnrollStudentForm}.tsx
    cohorts/                    MANAGER + ADMIN — list, create, edit, delete
      {page, CohortForm, CohortRow}.tsx
    courses/                    MANAGER + ADMIN — list, create, edit, delete
      page.tsx
      CourseForm.tsx, CourseRow.tsx
      [slug]/page.tsx           Module list for a course
      [slug]/ModuleForm.tsx     Add / delete modules (supports PDF/PowerPoint upload)
    users/                      ADMIN only
      page.tsx                  Search, role filter, pagination, inline role change
      RoleSelect.tsx            Client component with optimistic role update
      actions.ts                changeUserRole (with audit log + self-demotion guard)
      [id]/page.tsx             Per-user detail with audit timeline
  verify-email/                 Verification flow (/verify-email, /pending, /resend)
  forbidden/                    403 page (proxy target)
  not-found.tsx                 Branded 404
  layout.tsx                    Root layout, theme boot script
  page.tsx                      Marketing landing (hero gradient)
  proxy.ts                      Next 16 proxy — role gates + auth gate

components/
  layout/DashboardShell.tsx     Responsive shell (AppBar + drawer, theme toggle, sign-out)
  ui/                           Tailwind primitives
    Button.tsx                  variants: primary | accent | secondary | ghost | danger
    Field.tsx                   Field + Input + Textarea
    Primitives.tsx              Card, PageHeader, StatCard, ProgressBar, Badge
    Icon.tsx                    Inline SVG icon set

lib/
  auth-guard.ts                 requireUser / requireRole / requireRoleOrRedirect / withAuth
                                + canEnroll / canManageCatalog / canManageUsers / canGrade
  db.ts                         Prisma singleton (hot-reload safe)
  storage.ts                    Local-disk file store + HMAC-signed tokens
  rate-limit.ts                 Postgres sliding-window rate limiter
  email-verification.ts         Verification token issue/consume (single-use)
  mailer.ts                     Pluggable transport (Resend / console)
  use-upload.ts                 Client upload hook (React state machine)

prisma/
  schema.prisma                 19 models (User, Account, Session, VerificationToken,
                                Cohort, Course, Module, Lesson, Enrollment,
                                LessonProgress, Assignment, Submission, Quiz,
                                QuizQuestion, QuizAttempt, Announcement, Certificate,
                                AuditLog, RateLimitEvent)
  seed.ts                       Dev seed — one verified user per role (now 4)
  migrations/                   SQL migrations (incl. add_manager_role for MANAGER
                                enum + cohort/course managerId FKs)
proxy.ts                        Next 16 edge proxy (auth + role gates)
instrumentation.ts              Server boot hook — prunes rate-limit events
.env.example                    Full env-var reference
```

---

## Security checklist

- **Passwords** — bcrypt cost 12
- **Sessions** — HTTP-only JWT, 7-day max age, role + emailVerified on the token
- **Authorization** — re-checked inside every Server Action (`requireRole`) and in `/admin`, `/instructor`, and `/dashboard` layouts
- **Capability checks** — every privileged operation goes through an explicit `can…()` helper in [lib/auth-guard.ts](lib/auth-guard.ts). The role matrix is the source of truth, not the role hierarchy: e.g. ADMIN does NOT inherit the right to enroll or teach.
- **Input** — Zod at every boundary (forms, route handlers, server actions)
- **Uploads** — MIME allowlist, 50MB cap, HMAC-signed token URLs, files live outside `/public`
- **Headers** — `X-Content-Type-Options: nosniff`
- **Rate limits** — per-IP and per-user buckets for login, register, upload, grading, verification resend, role changes, catalog edits, enrollment
- **Audit log** — grade actions, role changes, cohort/course/module edits, and **both** self-enrollments and staff-initiated enrollments are recorded with actor and target
- **Self-demotion guard** — admins cannot demote themselves
- **CSRF** — server actions use Auth.js's built-in action signature; sign-out goes through a server action

---

## Scripts

```bash
npm run dev        # Dev server (Turbopack)
npm run build      # Production build
npm run start      # Run built app
npm run lint       # ESLint
npm run db:seed    # Seed dev accounts (refuses in production)

npx prisma studio          # Browse the DB
npx prisma migrate dev     # Apply / create a migration
npx prisma generate        # Regenerate the Prisma client
npx prisma db seed         # Same as npm run db:seed
```

---

## Production checklist

Before going live:

- [ ] Set a strong `AUTH_SECRET` (32+ random bytes)
- [ ] Configure `RESEND_API_KEY` and a verified `MAIL_FROM` domain
- [ ] Run behind HTTPS (sets the `Secure` cookie flag)
- [ ] Add CSP, HSTS, `X-Frame-Options: DENY` via `next.config.ts` `headers()`
- [ ] Replace local-disk storage with S3/R2 (swap the body of `lib/storage.ts` — the S3-shaped interface is already in place)
- [ ] Move rate-limiter pruning to a cron job (the in-process `setInterval` is for long-running nodes)
- [ ] Wire lesson content through a Markdown renderer with `rehype-sanitize` (currently escaped as plain text)
- [ ] Add tests: Vitest for `lib/storage.ts` token logic + grading action; Playwright for the login → enroll → submit → grade flow
- [ ] Disable the dev seed by deleting the npm script and the `prisma.seed` field in `package.json` (or simply don't run it in prod — it already self-aborts on `NODE_ENV=production`)

---

## License

UNLICENSED — internal use only.
