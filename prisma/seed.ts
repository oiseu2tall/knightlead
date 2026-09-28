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

type SeedCohort = {
  slug: string;
  name: string;
  startDate: string;
  endDate: string;
  description: string;
  isOpen: boolean;
  capacity: number | null;
};

type SeedVideo = {
  title: string;
  description?: string;
  url: string;
  durationMin?: number;
};

type SeedLesson = {
  title: string;
  contentType: "VIDEO" | "ARTICLE" | "QUIZ" | "ASSIGNMENT" | "LIVE_SESSION";
  durationMin?: number;
  content?: string;
  videos?: SeedVideo[];
};

type SeedModule = {
  title: string;
  lessons: SeedLesson[];
  assignment?: { title: string; prompt: string; maxScore?: number };
  quiz?: {
    title: string;
    description?: string;
    passingScore?: number;
    timeLimit?: number;
    // Stored as the JSON payload QuizQuestion expects:
    // { choices: [{id,text}], answer: choiceId, explanation? }
    questions: {
      prompt: string;
      choices: string[];
      answer: number;
      explanation?: string;
      points?: number;
    }[];
  };
};

// Two intakes of the SAME course. The point of the cohort-first model is
// that one course can be offered repeatedly, so the seed deliberately
// creates two cohorts under one course rather than two courses.
const COHORTS: SeedCohort[] = [
  {
    slug: "cybersecurity-oct-2026",
    name: "Cybersecurity Oct 2026",
    startDate: "2026-10-05T00:00:00.000Z",
    endDate: "2026-12-18T00:00:00.000Z",
    description: "Foundational security cohort running October to December 2026.",
    isOpen: true,
    capacity: 30,
  },
  {
    slug: "cybersecurity-jan-2027",
    name: "Cybersecurity Jan 2027",
    startDate: "2027-01-11T00:00:00.000Z",
    endDate: "2027-03-26T00:00:00.000Z",
    description: "Second intake of the foundational security course.",
    // Closed so the "cohort not open for self-enrollment" path is easy
    // to exercise without changing data.
    isOpen: false,
    capacity: 25,
  },
];

// The course body. Assessments belong to a module, not a lesson, and a
// lesson may carry several videos — both are exercised here so the
// seeded data reflects the real shape rather than the minimum.
const MODULES: SeedModule[] = [
  {
    title: "Social Engineering and Insider Threats",
    lessons: [
      {
        title: "What social engineering actually is",
        contentType: "ARTICLE",
        durationMin: 15,
        content:
          "Social engineering exploits people rather than systems. This lesson covers the core manipulation tactics: pretexting, baiting, and tailgating, and why technical controls alone cannot stop them.",
        videos: [
          {
            title: "Lecture: manipulation tactics",
            url: "https://cdn.example.dev/lectures/social-engineering-intro.mp4",
            durationMin: 12,
          },
          {
            title: "Demo: a pretexting call, annotated",
            url: "https://cdn.example.dev/lectures/social-engineering-demo.mp4",
            durationMin: 8,
          },
        ],
      },
      {
        title: "Recognizing phishing indicators",
        contentType: "VIDEO",
        durationMin: 22,
        content: "A walk through the signals that give away a phishing attempt.",
        videos: [
          {
            title: "Lecture: phishing indicators",
            url: "https://cdn.example.dev/lectures/phishing-indicators.mp4",
            durationMin: 14,
          },
          {
            title: "Worked example: the invoice scam",
            url: "https://cdn.example.dev/lectures/phishing-invoice.mp4",
            durationMin: 6,
          },
          {
            title: "Screening checklist",
            description: "One-page reference for the indicators covered in this module.",
            url: "https://cdn.example.dev/handouts/phishing-checklist.pdf",
            durationMin: 2,
          },
        ],
      },
    ],
    // Module-level assessment: it covers the module, not either lesson.
    assignment: {
      title: "Phishing triage report",
      prompt:
        "Using the two phishing scenarios from this module, write a short triage report (max 500 words) describing the indicators present, how you would verify legitimacy, and who you would escalate to.",
      maxScore: 100,
    },
    quiz: {
      title: "Social engineering check",
      description: "Five questions on the tactics and indicators covered in this module.",
      passingScore: 70,
      questions: [
        {
          prompt: "Which tactic involves an attacker following an employee through a secured door?",
          choices: ["Pretexting", "Baiting", "Tailgating", "Phishing"],
          answer: 2,
          explanation: "Tailgating is following an authorized person into a restricted area.",
        },
        {
          prompt: "A supplier emails changed bank details. What is the safest first step?",
          choices: [
            "Reply asking for confirmation",
            "Update the record with the new details",
            "Verify via a known phone number",
            "Forward it to a colleague for a second opinion",
          ],
          answer: 2,
          explanation:
            "Verify out-of-band using contact details you already trust, never those in the message.",
        },
        {
          prompt: "Why do technical controls fail against social engineering?",
          choices: [
            "They are too slow to update",
            "They target systems, while the target is the person",
            "They only work on encrypted networks",
            "They cannot inspect email headers",
          ],
          answer: 1,
          explanation: "The attack targets human judgement, which technical controls cannot constrain.",
        },
      ],
    },
  },
  {
    title: "Secure Coding Fundamentals",
    lessons: [
      {
        title: "Input validation and injection",
        contentType: "ARTICLE",
        durationMin: 30,
        content:
          "Injection remains among the most exploited vulnerability classes. This lesson covers parameterized queries, output encoding, and why allowlists beat denylists.",
        videos: [
          {
            title: "Lecture: injection and defences",
            url: "https://cdn.example.dev/lectures/injection.mp4",
            durationMin: 20,
          },
        ],
      },
      {
        title: "Authentication and session handling",
        contentType: "VIDEO",
        durationMin: 25,
        content: "Password storage, MFA, and session lifetime.",
        videos: [
          {
            title: "Lecture: sessions",
            url: "https://cdn.example.dev/lectures/sessions.mp4",
            durationMin: 15,
          },
          {
            title: "Demo: session fixation, fixed",
            url: "https://cdn.example.dev/lectures/session-fixation.mp4",
            durationMin: 10,
          },
        ],
      },
    ],
    assignment: {
      title: "Review a vulnerable endpoint",
      prompt:
        "Review the provided handler for injection and session issues. Submit a written review listing each finding, its severity, and the specific fix you would apply.",
      maxScore: 100,
    },
  },
];

// The October intake runs a trimmed plan: it skips the first lesson of
// module 2 and gates the last one until the cohort is underway. The
// January intake is left with no plan, so it teaches the whole course —
// the two cohorts together exercise both curriculum states.
const OCT_PLAN = [
  { moduleIndex: 0, lessonIndex: 0 },
  { moduleIndex: 0, lessonIndex: 1 },
  { moduleIndex: 1, lessonIndex: 1, releaseAt: "2026-11-16T09:00:00.000Z" },
];

async function main() {
  const hashed = await bcrypt.hash(DEV_PASSWORD, 12);
  const byEmail: Record<string, { id: string; role: string }> = {};

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

    byEmail[u.email] = { id: user.id, role: user.role };
    console.log(`✓ ${u.role.padEnd(10)} ${u.email}`);
  }

  const instructor = byEmail["instructor@knightlead.dev"];
  const manager = byEmail["manager@knightlead.dev"];
  const student = byEmail["student@knightlead.dev"];

  // The catalog: one course, many cohorts. A cohort cannot exist without a
  // course, so the course is upserted first and the cohorts reference it.
  const course = await db.course.upsert({
    where: { slug: "cybersecurity" },
    update: {},
    create: {
      title: "Cybersecurity",
      slug: "cybersecurity",
      description:
        "A foundational look at threat modelling, secure coding, and incident response.",
      instructorId: instructor.id,
      managerId: manager.id,
      isPublished: true,
    },
  });
  console.log(`✓ COURSE     ${course.title} (${course.slug})`);

  const cohortBySlug: Record<string, string> = {};
  for (const c of COHORTS) {
    const cohort = await db.cohort.upsert({
      where: { slug: c.slug },
      // Apply the declared values so re-seeding converges on the intended
      // state. With an empty update, a cohort created by an earlier seed (or
      // by hand) would keep drifting from what the seed says it should be.
      update: {
        name: c.name,
        courseId: course.id,
        startDate: new Date(c.startDate),
        endDate: new Date(c.endDate),
        description: c.description,
        managerId: manager.id,
        isOpen: c.isOpen,
        capacity: c.capacity,
      },
      create: {
        courseId: course.id,
        name: c.name,
        slug: c.slug,
        startDate: new Date(c.startDate),
        endDate: new Date(c.endDate),
        description: c.description,
        managerId: manager.id,
        isOpen: c.isOpen,
        capacity: c.capacity,
      },
    });
    cohortBySlug[c.slug] = cohort.id;
    console.log(`✓ COHORT     ${cohort.name} (open=${cohort.isOpen}, capacity=${cohort.capacity})`);
  }

  // Enrollments always point at a cohort, and `courseId` is copied from
  // that cohort. Two cohorts of one course means the student can hold two
  // seats in the same course — one approved, one still pending — which
  // exercises the manager approval queue out of the box.
  const SEAT = { userId: student.id, courseId: course.id };
  const activeCohort = cohortBySlug["cybersecurity-oct-2026"];
  const pendingCohort = cohortBySlug["cybersecurity-jan-2027"];

  await db.enrollment.upsert({
    where: { userId_cohortId: { userId: SEAT.userId, cohortId: activeCohort } },
    update: {},
    create: {
      ...SEAT,
      cohortId: activeCohort,
      status: "ACTIVE",
      // Pre-approved: staff-created seats skip the queue, so record who
      // approved it and when.
      approvedAt: new Date(),
      approvedById: manager.id,
    },
  });
  console.log("✓ SEAT       student → Cybersecurity Oct 2026 (ACTIVE, approved)");

  await db.enrollment.upsert({
    where: { userId_cohortId: { userId: SEAT.userId, cohortId: pendingCohort } },
    update: {},
    create: {
      ...SEAT,
      cohortId: pendingCohort,
      status: "PENDING",
      // No approvedAt/approvedById: this is the self-enrollment waiting in
      // the manager's approval queue.
    },
  });
  console.log("✓ SEAT       student → Cybersecurity Jan 2027 (PENDING, awaiting approval)");

  // ---- Curriculum ---------------------------------------------------------
  // Modules, their lessons, and each lesson's videos. Keyed on the
  // composite uniqueness the schema enforces so re-seeding is idempotent
  // rather than duplicating the course body.
  const lessonIdsByIndex: string[][] = [];
  const moduleIdByIndex: string[] = [];

  for (const [moduleIndex, mod] of MODULES.entries()) {
    const moduleRow = await db.module.upsert({
      where: { courseId_order: { courseId: course.id, order: moduleIndex + 1 } },
      update: { title: mod.title },
      create: { courseId: course.id, title: mod.title, order: moduleIndex + 1 },
    });
    console.log(`✓ MODULE     ${moduleRow.title}`);
    moduleIdByIndex.push(moduleRow.id);

    const lessonIds: string[] = [];
    for (const [lessonIndex, lesson] of mod.lessons.entries()) {
      const lessonRow = await db.lesson.upsert({
        where: { moduleId_order: { moduleId: moduleRow.id, order: lessonIndex + 1 } },
        update: { title: lesson.title, contentType: lesson.contentType, durationMin: lesson.durationMin ?? null },
        create: {
          moduleId: moduleRow.id,
          title: lesson.title,
          contentType: lesson.contentType,
          content: lesson.content ?? null,
          durationMin: lesson.durationMin ?? null,
          order: lessonIndex + 1,
        },
      });
      lessonIds.push(lessonRow.id);

      // A lesson carries several videos, ordered. Upserting per position
      // keeps re-seeds from stacking duplicates.
      for (const [videoIndex, video] of (lesson.videos ?? []).entries()) {
        await db.lessonVideo.upsert({
          where: { lessonId_order: { lessonId: lessonRow.id, order: videoIndex } },
          update: { title: video.title, url: video.url, durationMin: video.durationMin ?? null },
          create: {
            lessonId: lessonRow.id,
            title: video.title,
            description: video.description ?? null,
            url: video.url,
            durationMin: video.durationMin ?? null,
            order: videoIndex,
          },
        });
      }
      if (lesson.videos && lesson.videos.length > 0) {
        console.log(`    └─ ${lesson.title} (${lesson.videos.length} videos)`);
      }
    }
    lessonIdsByIndex.push(lessonIds);

    // Assessments hang off the module, covering it as a whole.
    if (mod.assignment) {
      await db.assignment.upsert({
        where: { id: `seed-assignment-${moduleIndex}` },
        update: { title: mod.assignment.title, prompt: mod.assignment.prompt },
        create: {
          id: `seed-assignment-${moduleIndex}`,
          moduleId: moduleRow.id,
          title: mod.assignment.title,
          prompt: mod.assignment.prompt,
          maxScore: mod.assignment.maxScore ?? 100,
        },
      });
      console.log(`    └─ assignment: ${mod.assignment.title}`);
    }

    if (mod.quiz) {
      const quiz = await db.quiz.upsert({
        where: { id: `seed-quiz-${moduleIndex}` },
        update: { title: mod.quiz.title, passingScore: mod.quiz.passingScore ?? 70 },
        create: {
          id: `seed-quiz-${moduleIndex}`,
          moduleId: moduleRow.id,
          title: mod.quiz.title,
          description: mod.quiz.description ?? null,
          passingScore: mod.quiz.passingScore ?? 70,
          timeLimit: mod.quiz.timeLimit ?? null,
        },
      });
      for (const [qIndex, q] of mod.quiz.questions.entries()) {
        const choices = q.choices.map((text, i) => ({ id: `c${i}`, text }));
        await db.quizQuestion.upsert({
          where: { quizId_order: { quizId: quiz.id, order: qIndex } },
          update: { prompt: q.prompt, payload: { choices, answer: choices[q.answer].id } },
          create: {
            quizId: quiz.id,
            prompt: q.prompt,
            payload: { choices, answer: choices[q.answer].id },
            points: q.points ?? 1,
            order: qIndex,
          },
        });
      }
      console.log(`    └─ quiz: ${mod.quiz.title} (${mod.quiz.questions.length} questions)`);
    }
  }

  // The October intake gets an explicit, trimmed plan; January is left
  // unplanned so it inherits the whole course. Both states are worth
  // having in dev data.
  //
  // The plan is rewritten rather than only created when empty: a previous
  // seed run — or the curriculum migration, which backfilled every cohort
  // with the course as it stood at the time — would otherwise leave a
  // stale plan that this seed can never correct.
  const octCohortId = activeCohort;
  await db.$transaction([
    db.cohortLesson.deleteMany({ where: { cohortId: octCohortId } }),
    db.cohortModule.deleteMany({ where: { cohortId: octCohortId } }),
  ]);
  for (const [order, entry] of OCT_PLAN.entries()) {
    const lessonId = lessonIdsByIndex[entry.moduleIndex]?.[entry.lessonIndex];
    if (!lessonId) continue;
    await db.cohortLesson.create({
      data: {
        cohortId: octCohortId,
        lessonId,
        order,
        releaseAt: entry.releaseAt ? new Date(entry.releaseAt) : null,
      },
    });
  }
  await db.cohortModule.createMany({
    data: MODULES.map((_, i) => ({ cohortId: octCohortId, moduleId: moduleIdByIndex[i], order: i })),
  });
  console.log(`✓ CURRICULUM Cybersecurity Oct 2026 (${OCT_PLAN.length} of ${lessonIdsByIndex.flat().length} lessons, ${MODULES.length} modules)`);

  // The January intake deliberately has no plan, so it teaches the whole
  // course. Clear any plan left by a previous run to keep that true.
  const janCohortId = pendingCohort;
  await db.$transaction([
    db.cohortLesson.deleteMany({ where: { cohortId: janCohortId } }),
    db.cohortModule.deleteMany({ where: { cohortId: janCohortId } }),
  ]);
  console.log("✓ CURRICULUM Cybersecurity Jan 2027 (no plan — teaches the whole course)");

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
