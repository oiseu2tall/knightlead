# KnightLead — Bootcamp LMS

A full-stack Learning Management System for cohort-based bootcamps. Built on **Next.js 16 (App Router)** with a single Next.js process serving both the UI and the API, **PostgreSQL** for persistence, **Tailwind CSS v4** for styling, and **Auth.js v5** for authentication.

---

## Features

- 👤 **Auth & roles** — credentials login with bcrypt(12), JWT sessions, role-based access (`STUDENT` / `INSTRUCTOR` / `MANAGER` / `ADMIN`), self-healing JWT that picks up DB-side role/email-verification changes
- 🔒 **Account suspension** — ADMIN can suspend any user account (except their own). A suspended user is rejected at login and, if already logged in, is redirected to `/suspended` on the next request. The JWT self-heal callback reflects DB-side suspension so no session-expiry wait is needed.
- 🧭 **Global sidebar on every authed page** — a single `<AuthedShell>` wrapper renders the role-aware drawer + sticky app bar on every page under `/dashboard/**`, `/admin/**`, and `/instructor/**`
- 📚 **Courses & lessons** — modules, ordered lessons, per-user completion tracking with auto-recomputed progress (`LessonProgress` model)
- 🗺️ **Cohort lesson plans** — each cohort optionally gets its own ordered `CohortLesson` plan with per-lesson `releaseAt` gates. A cohort with no plan teaches the whole course. Lessons omitted from a plan are unreachable (404) and can't be ticked complete, so an intake can be paced independently of the master curriculum.
- 🎥 **Multi-video lessons** — a lesson owns one-to-many `LessonVideo` rows (URL or upload, never both), replacing the old single `Lesson.videoUrl`
- 🧩 **Module-scoped assessments** — assignments and quizzes belong to a *module*, not a lesson. Grading one completes every lesson in that module and recomputes progress for every live seat the student holds.
- 📝 **Polished assignment-submission flow** — pre-fills from existing submissions, shows grade + feedback inline, character counter, Cmd/Ctrl+Enter shortcut, drag-and-drop multi-file upload, 5-file cap
- 🔗 **Assignment deep links** — `/dashboard/assignments` links to `/dashboard/courses/<slug>?module=<id>#assignment-<id>`; the course page expands only modules the seat's cohort actually teaches
- 📊 **Instructor grading queue** — filter by status, score cap, optimistic UI, audit trail, scoped to the instructor's own courses, with **view / download of every file a student attached**
- 🧑‍🤝‍🧑 **Instructor cohorts** — read-only view of the cohorts belonging to the instructor's courses, grouped by course
- 🛠️ **Catalog management** — MANAGER + ADMIN can create/edit cohorts, courses, and modules via modal-driven forms; attach PDF/PowerPoint files to modules
- 🏷️ **Role filter chips + live search** — every list page (cohorts, courses, enrollments, users) has a debounced search input and status filter chips
- 🎓 **Cohort-first enrollment** — students enroll into a *cohort* (a dated intake of one course), never into a course directly. One course can have many cohorts, so the same student can hold a seat in several intakes of the same course. Each cohort has an optional seat cap and an open/closed switch for self-enrollment.
- 🔐 **Enrollment approval** — a self-enrollment starts in `PENDING` and unlocks nothing until a manager or admin approves it; the approver and timestamp are recorded. Students can cancel their own pending request; managers can approve, decline, or move a seat to another cohort. Staff-placed students are created `ACTIVE` immediately.
- 🔒 **Admin panel** — user search, role filter chips, pagination, inline role change (with audit log), per-user detail with enrollments / submissions / audit timeline, suspend/activate toggle. ADMIN only.
- 📎 **Local file storage** — HMAC-signed token URLs, MIME allowlist, 50MB cap, path-traversal guards, S3-shaped interface for easy swap
- ✉️ **Email verification** — OTP-style (8-char code, no prefix), Nodemailer via Gmail SMTP, fallback chain (Gmail → Ethereal → console), auto-redirect to `/verify-email/pending` until verified
- 🛡️ **Security** — proxy-based route gating + server-side re-checks in every layout/action, Zod validation everywhere, per-IP and per-user rate limits (Postgres-backed), `X-Content-Type-Options: nosniff`, HTTP-only cookies
- 🚀 **CSS-only long-list virtualization** — `content-visibility: auto` on card grids and table rows; "Show more" pagination via the `<LongList>` component
- 🌗 **Theme** — class-based light/dark toggle (no system-preference override), `next/script` no-flash boot, persisted in `localStorage`, default = light
- 📱 **Responsive** — mobile-first, persistent drawer on desktop, temporary drawer on mobile
- 📄 **Branded 404 & 403** — friendly not-found and forbidden pages for any dead link / wrong role
- 🚪 **Build-time admin bootstrap** — `prebuild` guarantees a verified, active ADMIN exists so a fresh deployment is never locked out (see [Admin bootstrap](#admin-bootstrap))

---

## Roles & capabilities

The four roles have **explicit, non-hierarchical** capabilities — ADMIN does *not* automatically inherit the right to enroll or to teach.

| Capability                                  | STUDENT | INSTRUCTOR | MANAGER | ADMIN |
|---------------------------------------------|:-------:|:----------:|:-------:|:-----:|
| Request a seat in an open cohort (self)     |    ✅   |     ❌     |    ❌   |  ❌   |
| Cancel own **pending** seat request         |    ✅   |     ❌     |    ❌   |  ❌   |
| Place a student in a cohort                 |    ❌   |     ❌     |    ✅   |  ✅   |
| Move a seat to another cohort               |    ❌   |     ❌     |    ✅   |  ✅   |
| View "My courses"                           |    ✅   |     —¹     |   —¹    |  —¹   |
| Mark lessons complete / submit assignments  |    ✅   |     ❌     |    ❌   |  ❌   |
| Grade submissions (own courses)             |    ❌   |     ✅     |    ❌   |  ✅²   |
| View cohorts (scoped to courses they teach) |    ❌   |     ✅     |    ❌   |  ✅   |
| Manage cohorts (create / edit / delete)     |    ❌   |     ❌     |    ✅   |  ✅   |
| Manage courses (create / edit / publish)    |    ❌   |     ❌     |    ✅   |  ✅   |
| Manage modules (create / edit / delete)     |    ❌   |     ❌     |    ✅   |  ✅   |
| Approve / decline pending enrollments       |    ❌   |     ❌     |    ✅   |  ✅   |
| User management (search, role change)       |    ❌   |     ❌     |    ❌   |  ✅   |
| Suspend / activate user accounts            |    ❌   |     ❌     |    ❌   |  ✅   |
| Promote / demote other users                |    ❌   |     ❌     |    ❌   |  ✅   |
| Self-demote                                 |    —    |     —      |    —    |  ❌   |

¹ Staff accounts don't take courses, so the "My courses" page is empty by design — the catalog at `/dashboard/courses/browse` is shown in read-only mode instead.
² Admins can grade any submission; instructors are scoped to the courses they teach.

**Two different "enroll" rules — not a typo:**
- **`enrollInCohort` (self-enroll):** only `STUDENT` may call it. The catalog at `/dashboard/courses/browse` shows the cohort picker only to students. The request is refused if the course is unpublished, the cohort is `isOpen: false`, or the cohort is at `capacity`. Enforced by `canEnroll()` in [lib/auth-guard.ts](lib/auth-guard.ts).
- **`staffEnrollStudent` (enroll-on-behalf-of):** `MANAGER` and `ADMIN` place any `STUDENT` into any cohort. They pick **only a cohort** — the course is derived from it, so the two can never disagree. The action refuses to enroll non-students, honours `capacity`, ignores `isOpen` (staff explicitly override the intake window), creates the seat `ACTIVE`, and records `approvedById`. `/admin/enrollments` is the only UI. Enforced by `canEnrollOthers()` plus a runtime role check on the target user.

**Sidebar sections by role** (rendered automatically by the global `<DashboardShell>`):

| Role           | Sidebar sections                                                                 |
|----------------|-----------------------------------------------------------------------------------|
| `STUDENT`      | Learn (Dashboard, My courses, Browse)                                             |
| `INSTRUCTOR`   | Learn + Teach (Cohorts, Grading)                                                  |
| `MANAGER`      | Learn + Manage (Catalog, Cohorts, Courses, Enrollments)                          |
| `ADMIN`        | Learn + Teach + Manage + Administer (Users)                                      |

**Why the explicit matrix?** Managers and admins curate the catalog. *Self-enrolling* would put them on grading rosters and progress charts, polluting the instructor's view. *Enrolling others* is the legitimate staff workflow that solves the same problem. The split is enforced in the UI (separate buttons / pages) and in the server actions.

---

## The catalog model: courses → cohorts → enrollments

Enrollment is cohort-first. The chain is:

```
Course  ──has many──▶  Cohort  ──has many──▶  Enrollment  ──▶  Student
(intake)              (a seat)                (one per student per cohort)
```

- A **Cohort is an intake of exactly one course** and is *required* to have a `courseId`. It carries the dates, an optional `capacity`, and an `isOpen` flag that gates self-enrollment.
- An **Enrollment is a seat in exactly one cohort** and is *required* to have a `cohortId`. Uniqueness is `@@unique([userId, cohortId])` — **not** `[userId, courseId]`. This is the change that lets one student take the same course twice, in two different intakes.
- `Enrollment.courseId` is a **denormalized copy** of `cohort.courseId`. It exists so course-level queries ("which courses is this student active in?") stay one indexed read instead of a join through `Cohort`. Every server action writes it from the cohort rather than trusting the form, and the migration reconciles any drift.
- **Course access is derived from an approved seat**, never from a course-level row. `getCourseAccess()` in [lib/auth-guard.ts](lib/auth-guard.ts) is the single source of truth for that decision, and resolves to one of three states the UI renders differently:
  - `live` — an `ACTIVE`/`COMPLETED` seat; content is unlocked
  - `pending` — a self-enrollment awaiting approval
  - `none` — no seat in any cohort of the course

  A live seat **wins over** a pending one, so a student approved into one intake can start working even while a second request sits in the queue.

### Guard rules

| Rule | Enforced in |
|---|---|
| A cohort always belongs to one course | `Cohort.courseId` `NOT NULL` + FK `ON DELETE CASCADE` |
| A seat always belongs to one cohort | `Enrollment.cohortId` `NOT NULL` + FK `ON DELETE CASCADE` |
| One seat per student per cohort | `@@unique([userId, cohortId])` |
| Moving a **populated** cohort to another course | Refused — it would silently change which course every enrolled student can reach |
| Lowering `capacity` below occupied seats | Refused — it would put the cohort permanently over its own limit |
| Deleting a cohort with seats | Refused (the FK would cascade, orphaning students) |
| Deleting a course that still has cohorts | Refused (cohorts and their seats would cascade away) |
| Self-enrolling in a closed or full cohort | Refused in `enrollInCohort` |
| Staff enrolling into a closed cohort | Allowed — staff override `isOpen`; `capacity` still applies |
| Withdrawing a seat that is already `ACTIVE` | Refused — that relationship ends via a manager or by completing the course |

### Migrating from the old model

`prisma/migrations/20260928120000_cohort_course_rekey/` is written to be **non-destructive** — it backfills rather than drops, and it refuses to guess:

1. Adds `cohorts.courseId` as nullable, then backfills it from the enrollments already pointing at each cohort. If a cohort's enrollments span more than one course, the migration **raises and stops** rather than picking a winner.
2. For cohorts with no enrollments to infer from, it auto-assigns the sole course only when the catalog holds exactly one; otherwise it **stops** and asks for a human.
3. Makes `cohorts.courseId` `NOT NULL` and re-points the FK to `ON DELETE CASCADE`.
4. Creates a closed "(Legacy Intake)" cohort for any course that still has course-level enrollments, so nothing has to be invented or dropped.
5. **Deduplicates** before adding the new unique key, keeping the most advanced row per `(userId, cohortId)` so a `COMPLETED` student is never silently downgraded or resurrected from `DROPPED`.
6. Makes `enrollments.cohortId` `NOT NULL` and switches that FK to `ON DELETE CASCADE`.
7. Adds `approvedAt` / `approvedById`, backfilling `approvedAt = enrolledAt` for rows that were already `ACTIVE`/`COMPLETED` (those seats predate approval tracking); `PENDING` rows deliberately stay unapproved.
8. Re-aligns every `enrollments.courseId` with its cohort, swaps the unique index, and adds the cohort/status indexes.

**Verify the result:** `npx prisma migrate status` should report no pending migrations.

---

## The curriculum model: course body vs. cohort plan

A course defines the **body of content**; a cohort defines **what that intake delivers**. Those are deliberately separate concerns, because the same course is taught repeatedly and each run differs.

```
Course ──▶ Module ──▶ Lesson ──▶ LessonVideo (many, ordered)
             │
             ├──▶ Assignment (module-level, graded evidence)
             └──▶ Quiz       (module-level, questions + attempts)

Cohort ──▶ CohortModule (ordered — which modules this intake delivers)
       └──▶ CohortLesson (ordered — which lessons, and when they release)
```

- **Assessments belong to a module, not a lesson.** A module is the unit of work; its lessons are the material, and the assignment/quiz is the evidence that it was covered. `Assignment.moduleId` and `Quiz.moduleId` are required, so the owning course is two hops away (`assignment.module.course`) instead of three. Grading a module's assignment marks that module's lessons complete.
- **A lesson carries many videos** (`LessonVideo`, ordered by `@@unique([lessonId, order])`). Each video is sourced from *either* an external URL *or* an uploaded file, never both, so the player never has to guess. The old single `Lesson.videoUrl` was migrated into `LessonVideo` before being dropped.
- **A cohort's plan is additive and optional.** With no `CohortLesson` rows the cohort teaches the whole course in course order; once any row exists the plan becomes authoritative, so a lesson it leaves out is genuinely not taught.
- **A plan entry can be gated.** `releaseAt` holds a lesson back until a given moment; the lesson is listed to students as locked and its content is not served until then. Free preview lessons ignore the gate.

`getCohortCurriculum()`, `getInPlanModuleIds()`, `findSeatTeachingLesson()`, and `findSeatTeachingModule()` in [lib/curriculum.ts](lib/curriculum.ts) are the single source of truth for "what does this seat teach". The course page, the lesson page, submission, and lesson completion all route through them, so the rules can't drift between call sites.

### Ordering under a unique index

`Lesson`, `LessonVideo`, `CohortLesson`, and `CohortModule` all carry an `order` guarded by a composite unique key. Writing a row into the middle of a run cannot be done with a bare increment — Postgres checks uniqueness per row as it writes, so `updateMany({ increment: 1 })` raises a duplicate-key error mid-statement. Every insert and reposition therefore parks the conflicting block above the valid range (orders are capped at 999), then relocates rows one at a time in ascending order so each slot is vacated before it is filled. Curriculum reordering uses a neighbour **swap** instead, which touches only two rows.

### Guard rules

| Rule | Enforced in |
|---|---|
| A cohort's plan only references its own course's lessons | Refused in `addCohortLesson` — a cross-course row would corrupt the curriculum |
| A video has a source, and only one kind | Refused in `upsertLessonVideo` when neither or both of URL/file are given |
| A lesson is never credited against a cohort that doesn't teach it | `findSeatTeachingLesson` — a cohort *with* a plan is authoritative |
| Progress is written only to a live seat | `recomputeProgress` returns `null` for `PENDING` seats |
| A locked lesson's content is not served | `isLessonReleased` gate on both the course and lesson pages |
| Video uploads | MIME allowlist (mp4/webm/ogg/quicktime) and a 500 MB cap, versus 50 MB for documents |

### Migrating from the old model

`prisma/migrations/20260928150000_module_assessments_videos_cohort_curriculum/` preserves every existing row and refuses to guess:

1. Creates `lesson_videos` and copies each non-empty `Lesson.videoUrl` across as an order-0 `LessonVideo` **before** dropping the column, so no lesson silently loses its video.
2. Creates `cohort_lessons` and `cohort_modules`, then seeds every cohort with its course's lessons and modules in course order — paired through the cohort's own `courseId`, so a cross-course link is impossible by construction. A cohort can then be reordered, trimmed, or cleared.
3. Adds a nullable `moduleId` to `assignments` and `quizzes`, and **raises and stops** if any assessment's lesson has no owning module, rather than orphaning it.
4. Backfills `moduleId` from the lesson's module, sets both `NOT NULL`, and swaps the foreign keys and indexes from lesson to module.

`prisma/migrations/20260928133541_module_assessments_videos_cohort_curriculum/` is a separate one-line fix (`enrollments.status` default) for pre-existing drift left by the cohort migration above.

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

### Sub-navigation pattern

Every list page under `/admin/**` gets a sticky horizontal `<SubNav>` with the catalog's sibling pages (Overview · Cohorts · Courses · Enrollments · Users-for-ADMIN-only) and a trailing "+ New" button. Student-facing pages under `/dashboard/**` get a similar `<SubNav>` / `<LearnTabs>` showing Dashboard · My courses · Browse. The sub-nav underlines the active tab and stays pinned to the top under the app bar.

### Modal pattern

The `<Modal>` component is a thin wrapper over the native `<dialog>` element. Every create/edit form (cohort, course, module, enrollment) is wrapped in a `<Modal>`, which means we get keyboard handling (Esc to close), focus trapping, and a backdrop for free. The form is the same for create and edit-in-place.

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
| Mailer      | Nodemailer (Gmail SMTP) with fallback chain     |
| Storage     | Local disk (`./uploads`)                |
| Rate limit  | Postgres sliding window                 |
| Run scripts | `tsx` + `cross-env`                     |

> **Next 16 specifics (all used in this codebase):**
> - `middleware.ts` is now **`proxy.ts`**. The function is `export default auth((req) => …)` so the `authorized` callback gates every request.
> - In route handlers and pages, **`params` and `searchParams` are `Promise`s** and must be `await`ed.
> - In React Server Components, use **`next/script` with `strategy="beforeInteractive"`** for code that must run before hydration (theme boot).
> - **Auth/authorization is re-checked inside every Server Action and protected layout** — the proxy is a first line of defense, not the only one. Layouts don't always re-render on every navigation, so per-page `requireRole(...)` calls remain mandatory.

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
# (Prisma CLI reads .env via prisma.config.ts; Next.js reads both .env and .env.local.)

# Generate AUTH_SECRET with:
openssl rand -base64 32

# 3. Database
npx prisma migrate dev

# 4. (Optional) Seed dev accounts — one verified user per role
npm run db:seed

# 5. Dev server
npm run dev
```

App runs at <http://localhost:3000>.

> `npm run build` runs a `prebuild` hook that creates the admin account in **whatever database `DATABASE_URL` points at** — so step 3 must have run first, or the build fails.

### Running in production mode locally

```bash
npx prisma migrate deploy   # apply existing migrations (never `migrate dev` in prod)
npm run build               # includes the prebuild admin bootstrap
npm run start               # next start
```

Differences from `npm run dev` worth knowing: no hot reload (rebuild to see changes), Prisma query logging is off (`lib/db.ts` only logs when `NODE_ENV === "development"`), and the dev seed refuses to run. Stop any running `next dev` first — two processes writing the same `.next/` corrupt the route tree and produce phantom 404s.

### Admin bootstrap

There is no in-app way to create the first admin, and that is deliberate:

- `app/(auth)/actions.ts` hard-codes `role: "STUDENT"` on registration
- `app/admin/users/actions.ts` gates `changeUserRole` behind `requireRole("ADMIN")`
- `prisma/seed.ts` aborts under `NODE_ENV=production`

Without a bootstrap path, a fresh production database would have no ADMIN and `/admin/users` would return 403 for everyone. `prisma/ensure-admin.ts` closes that gap. It runs from the `prebuild` hook and enforces five invariants on `admin@knightleadsolutions.com.ng`:

| Invariant         | Behaviour when violated                                  |
|-------------------|----------------------------------------------------------|
| Account exists    | Created verified and active, with a bcrypt(12) hash       |
| `role = ADMIN`    | Repaired                                                 |
| `suspended = false` | Repaired                                               |
| `emailVerified` set | Repaired                                              |
| Password hash present | Repaired (covers OAuth-only accounts)                 |

Design choices worth knowing:

- **The password is only ever *set*, never re-set.** An account that already has a hash is left alone, so a redeploy can't silently undo a password change you made after the first deploy.
- **An already-correct admin is silent**, so it doesn't spam build logs on every deploy.
- **No `DATABASE_URL` → skip, build continues.** Typecheck-only CI isn't blocked.
- **`DATABASE_URL` set but unreachable → build fails.** A silently admin-less release is worse than a blocked deploy.
- Credentials are overridable with `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`. Set those in Vercel rather than relying on the committed defaults, which stay readable in git history.

To run it without a full build:

```bash
npm run db:ensure-admin
```

To grant a role to any other account (out-of-band, writes a `PROMOTE_USER` audit row):

```bash
vercel env pull .env.production.local
# dotenv only reads `.env`, so export the pulled URL explicitly or you'll
# silently operate on your local database instead.
# PowerShell:
$env:DATABASE_URL = (Get-Content .env.production.local | Select-String '^DATABASE_URL').Line.Split('=',2)[1].Trim('"')
# bash:
export DATABASE_URL="$(grep '^DATABASE_URL=' .env.production.local | cut -d= -f2- | tr -d '\"')"

npm run db:promote -- someone@example.com MANAGER
```

Both scripts print the target `host/database` before touching anything — read that line before pressing on. `db:promote` additionally refuses to run under `NODE_ENV=production` unless you pass `--yes`.

After either path, **sign out and back in** so the new role reaches the session token — `auth.ts` re-reads the role from the DB on each request, but the cookie has to be re-issued.

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
| `EMAIL_ADDRESS`    | Gmail address for Nodemailer SMTP                      |
| `EMAIL_APP_PASSWORD` | Gmail app-specific password for Nodemailer           |
| `MAIL_FROM`        | `From:` address for transactional mail                 |
| `UPLOAD_DIR`       | Local file storage path (default `./uploads`)          |
| `BOOTSTRAP_ADMIN_EMAIL` | Admin created by the `prebuild` hook (optional override) |
| `BOOTSTRAP_ADMIN_PASSWORD` | Its initial password (optional override)        |

`.env.example` is the full list. Note that `.env*` is gitignored, so **nothing from your local `.env` reaches Vercel** — every var above must be set in the Vercel project settings or production will 500. `AUTH_SECRET` in particular has no safe default: `lib/storage.ts` falls back to a hardcoded dev string, which would let anyone forge file URLs.---

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
  dashboard/                    Authed area for STUDENTS — uses <AuthedShell>
    layout.tsx                 <AuthedShell> (no role gate)
    page.tsx                    Stats + continue-learning hero
    assignments/{page,actions}.tsx
    courses/
      page.tsx                  "My courses" — one card per seat, labelled with its cohort
      browse/{page,EnrollButton}.tsx  Catalog; cohort picker is STUDENT-only
      [slug]/page.tsx           The seat's cohort curriculum: modules, lessons, module work
      [slug]/lessons/[lessonId] Lesson view — all its videos, the module's assignments, mark-complete
    CoursesTabsClient.tsx       Shared learn tabs + search
  instructor/                   Role-gated (INSTRUCTOR | ADMIN) — uses <AuthedShell>
    layout.tsx                 <AuthedShell allowedRoles={["INSTRUCTOR","ADMIN"]}>
    cohorts/page.tsx            Read-only — cohorts of the instructor's courses, grouped by course
    grading/                    Role-scoped queue + optimistic grading
      {page, GradingPanel, actions}.tsx  (panel lists each submission's
                                         files with view / download)
  admin/                        Role-gated (MANAGER | ADMIN) — uses <AuthedShell>
    layout.tsx                 <AuthedShell allowedRoles={["MANAGER","ADMIN"]}>
    page.tsx                    Catalog hub (links to enrollments / cohorts / courses / users)
    catalog/actions.ts          Shared upsert/delete + staffEnrollStudent + approve/reject/move
                               + lesson/video CRUD + cohort curriculum (seed/add/remove/move)
    enrollments/                MANAGER + ADMIN — place a student in a cohort
    cohorts/                    MANAGER + ADMIN — list, create, edit, delete
      [cohortId]/page.tsx       Curriculum editor — this intake's ordered lesson plan
      [cohortId]/CohortCurriculumClient.tsx
    courses/                    MANAGER + ADMIN — list, create, edit, delete
      [slug]/page.tsx           Module list + this course's cohorts
      [slug]/ModuleForm.tsx     Add / delete modules (supports PDF/PowerPoint upload)
      [slug]/modules/[moduleId] Module detail: lessons, per-lesson videos, assessments
        LessonVideoForm.tsx      Add / edit one video (URL or upload — never both)
    users/                      ADMIN only
      page.tsx                  Search, role filter, pagination, inline role change
      RoleSelect.tsx            Client component with optimistic role update
      actions.ts                changeUserRole (with audit log + self-demotion guard)
      [id]/page.tsx             Per-user detail with audit timeline
  verify-email/                 OTP verification flow (/verify-email, /pending, /resend)
  forbidden/                    403 page (proxy target)
  not-found.tsx                 Branded 404
  layout.tsx                    Root layout, theme boot script
  page.tsx                      Marketing landing (hero gradient)
  proxy.ts                      Next 16 proxy — role gates + auth gate

components/
  assignments/
    ModuleAssignmentsPanel.tsx A module's assignments + live submission forms.
                                Shared by the lesson page and the course page's
                                deep-linked module so the two cannot drift
    SubmissionForm.tsx         Pre-fill, grade display, drag-and-drop upload
  files/
    AssignmentFileLinks.tsx     View / Download links for assignment files
    ModuleFileLinks.tsx         Same, for module attachments
  layout/
    AuthedShell.tsx             Shared auth + verification + role gate + DashboardShell
    DashboardShell.tsx          Responsive shell (AppBar + drawer, theme toggle, sign-out)
    SubNav.tsx                  Sticky horizontal sub-navigation
    Breadcrumb.tsx              Semantic breadcrumb trail
  ui/
    Button.tsx                  variants: primary | accent | secondary | ghost | danger
    Field.tsx                   Field + Input + Textarea
    Primitives.tsx              Card, PageHeader, StatCard, ProgressBar, Badge, RoleBadge
    Icon.tsx                    Inline SVG icon set (~25 icons)
    Modal.tsx                   Native <dialog> wrapper with backdrop + animation
    EmptyState.tsx              Centered empty-state card
    DropdownMenu.tsx            Popover menu for row actions
    SearchInput.tsx             Styled search input with leading icon
    LongList.tsx                Progressive-reveal list with "Show more"

lib/
  auth-guard.ts                 requireUser / requireRole / requireRoleOrRedirect / withAuth
                                 + canEnroll / canEnrollOthers / canManageCatalog / canManageUsers / canGrade
                                 + getCourseAccess / findLiveEnrollment / cohortAvailability
                                 (cohort-aware course access — the single source of truth)
  curriculum.ts                  getCohortCurriculum / getInPlanModuleIds
                                 + findSeatTeachingLesson / findSeatTeachingModule
                                 + isLessonReleased / recomputeProgress
                                 (what a seat is taught — the single source of truth)
  db.ts                         Prisma singleton (hot-reload safe)
  storage.ts                    Local-disk file store + HMAC-signed tokens
                                 (50MB documents, 500MB video)
  rate-limit.ts                 Postgres sliding-window rate limiter
  email-verification.ts         OTP code issue/consume (single-use, 15-min TTL)
  mailer.ts                     Pluggable transport (Gmail SMTP → Ethereal → console)
  role.ts                       ROLE_META + roleLabel/roleSection helpers (UI-only)
  use-upload.ts                 Client upload hook (React state machine)

prisma/
  schema.prisma                 22 models (User, Account, Session, EmailVerification,
                                Cohort, Course, Module, Lesson, LessonVideo,
                                CohortLesson, CohortModule, Enrollment,
                                LessonProgress, Assignment, Submission, Quiz,
                                QuizQuestion, QuizAttempt, Announcement, Certificate,
                                AuditLog, RateLimitEvent)
  seed.ts                       Dev seed — one verified user per role, plus one course
                                 with two cohorts and a student holding a seat in each
                                 (idempotent, refuses NODE_ENV=production)
  ensure-admin.ts               Build-time admin bootstrap (runs from `prebuild`)
  promote-admin.ts              Out-of-band role grant by email, with audit row
  migrations/                   SQL migrations (incl. add_manager_role for MANAGER
                                 enum + cohort/course managerId FKs, cohort_course_rekey
                                 for the cohort-first model, and
                                 module_assessments_videos_cohort_curriculum for
                                 module-scoped assessments + lesson videos +
                                 per-cohort lesson plans)
prisma.config.ts                Prisma CLI config — replaces the deprecated
                                 `package.json#prisma` block (removed in Prisma 7)
.env.example                    Full env-var reference
```

---

## Authed-shell pattern

Every page a logged-in user can see is wrapped in a single shared `<AuthedShell>` (`components/layout/AuthedShell.tsx`). The shell:

1. Calls `auth()` and redirects to `/login` if there's no session.
2. Redirects to `/verify-email/pending` if the email isn't verified (configurable with `requireVerifiedEmail`).
3. Optionally checks role(s) with `allowedRoles` and redirects to `/forbidden` on mismatch.
4. Renders the global `<DashboardShell>` — a role-aware drawer with sectioned navigation, a sticky app bar with the role badge, quick actions, theme toggle, and a user menu.

Layouts that use it:

```tsx
// app/dashboard/layout.tsx
export default function DashboardLayout({ children }) {
  return <AuthedShell>{children}</AuthedShell>;
}

// app/admin/layout.tsx
export default function AdminLayout({ children }) {
  return <AuthedShell allowedRoles={["MANAGER", "ADMIN"]}>{children}</AuthedShell>;
}

// app/instructor/layout.tsx
export default function InstructorLayout({ children }) {
  return <AuthedShell allowedRoles={["INSTRUCTOR", "ADMIN"]}>{children}</AuthedShell>;
}
```

Per-page role checks are still required as the authoritative authorization gate (Next 16 layouts don't always re-render on every navigation).

---

## Long-list virtualization

Lists that can grow arbitrarily (recent enrollments, all cohorts, all courses, all modules) use the `<LongList>` component together with a CSS-only virtualization trick:

```css
/* app/globals.css */
.kl-virtualize > *      { content-visibility: auto; contain-intrinsic-size: auto 80px; }
.kl-virtualize-tight > * { content-visibility: auto; contain-intrinsic-size: auto 56px; }
```

`<LongList>` renders the first `pageSize` items, then a "Show more" button reveals the rest. The browser skips layout/paint for off-screen rows, so a 1000-row list renders as fast as a 20-row one — no JavaScript virtualization library required.

---

## Security checklist

- **Passwords** — bcrypt cost 12
- **Sessions** — HTTP-only JWT, 7-day max age, role + emailVerified on the token
- **Authorization** — re-checked inside every Server Action (`requireRole`) and in `/admin`, `/instructor`, and `/dashboard` layouts
- **Capability checks** — every privileged operation goes through an explicit `can…()` helper in [lib/auth-guard.ts](lib/auth-guard.ts). The role matrix is the source of truth, not the role hierarchy: e.g. ADMIN does NOT inherit the right to enroll or teach.
- **Input** — Zod at every boundary (forms, route handlers, server actions)
- **Uploads** — MIME allowlist, 50MB cap for documents/images and 500MB for video, HMAC-signed token URLs, files live outside `/public`
- **Headers** — `X-Content-Type-Options: nosniff`
- **Rate limits** — per-IP and per-user buckets for login, register, upload, grading, verification resend, role changes, catalog edits, enrollment
- **Audit log** — grade actions, role changes, cohort/course/module edits, seat moves, and **both** self-enrollments and staff-initiated enrollments are recorded with actor and target. Approvals additionally record `approvedAt` / `approvedById` on the enrollment itself.
- **Self-demotion guard** — admins cannot demote themselves
- **CSRF** — server actions use Auth.js's built-in action signature; sign-out goes through a server action

---

## Scripts

```bash
npm run dev        # Dev server
npm run build      # Production build (runs `prebuild` → admin bootstrap first)
npm run start      # Run built app
npm run lint       # ESLint

npm run db:seed           # Seed dev accounts (refuses in production)
npm run db:ensure-admin   # Assert the bootstrap admin exists (no build needed)
npm run db:promote -- <email> [ROLE]   # Grant a role out-of-band, with audit row

npx prisma studio          # Browse the DB
npx prisma migrate dev     # Apply / create a migration (development)
npx prisma migrate deploy  # Apply existing migrations only (production/CI)
npx prisma generate        # Regenerate the Prisma client
npx prisma db seed         # Same as npm run db:seed
```

> `npx prisma` auto-discovers `prisma.config.ts` only from the project root. From a subdirectory, pass `--config ../prisma.config.ts`.

### Deployment

Vercel build command:

```bash
npx prisma migrate deploy && npm run build
```

Migrations land first, then `prebuild` asserts the admin, then Next builds. A Vercel "This page couldn't load" 500 is almost always a missing env var (see [Environment variables](#environment-variables)) or an unmigrated database — check the deployment's **Runtime Logs**, not the build log.

---

## Production checklist

Before going live:

- [ ] Set a strong `AUTH_SECRET` (32+ random bytes)
- [ ] Set `DATABASE_URL`, `AUTH_URL` and `BOOTSTRAP_ADMIN_*` in the Vercel project — `.env*` is gitignored, so nothing reaches production automatically
- [ ] Use the **pooler** URL for `DATABASE_URL` (Supabase: `?pgbouncer=true&connection_limit=1&sslmode=require`); the direct connection exhausts itself from serverless
- [ ] Build command is `npx prisma migrate deploy && npm run build` so the schema and the admin bootstrap are applied before the deploy goes live
- [ ] Configure `EMAIL_ADDRESS` + `EMAIL_APP_PASSWORD` for Gmail SMTP, or a custom `NODEMAILER_URL`
- [ ] Run behind HTTPS (sets the `Secure` cookie flag)
- [ ] Add CSP, HSTS, `X-Frame-Options: DENY` via `next.config.ts` `headers()`
- [ ] **Replace local-disk storage with S3/R2** — `lib/storage.ts` writes to `process.cwd()/uploads`, which is read-only in a serverless function, so uploads throw `EROFS`. The S3-shaped interface is already in place; `S3_*` vars are stubbed in `.env.example`
- [ ] Move rate-limiter pruning to a Vercel Cron — the `setInterval` in `instrumentation.ts` never fires because functions freeze between invocations
- [ ] Wire lesson content through a Markdown renderer with `rehype-sanitize` (currently escaped as plain text)
- [ ] Add tests: Vitest for `lib/storage.ts` token logic + grading action; Playwright for the login → enroll → submit → grade flow
- [ ] Remove the committed `BOOTSTRAP_ADMIN_PASSWORD` default once the env-var override is in place, and rotate the password
- [ ] Delete the dev seed npm script — it already self-aborts on `NODE_ENV=production`, but removing it removes the temptation

---

## License

UNLICENSED — internal use only.
