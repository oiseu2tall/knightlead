import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="bg-hero grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-xl text-center text-white">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
          Now enrolling
        </span>
        <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
          Knightlead LMS
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base text-white/85 sm:text-lg">
          Cohorts, courses, assignments, and progress — all in one place.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-accent-500 px-6 py-3 text-sm font-semibold text-ink shadow-[var(--shadow-pop)] transition-colors hover:bg-accent-600 hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-xl border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
          >
            Create account
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-3 gap-4 text-left text-white/90">
          <FeatureCell color="accent" title="Cohort-based" body="Run multi-week cohorts with shared pacing." />
          <FeatureCell color="brand"  title="Lessons"     body="Video, text, quizzes, assignments." />
          <FeatureCell color="accent" title="Grading"     body="Optimistic queue, audit log, feedback." />
        </div>
      </div>
    </main>
  );
}

function FeatureCell({
  color,
  title,
  body,
}: {
  color: "brand" | "accent";
  title: string;
  body: string;
}) {
  const dot = color === "accent" ? "bg-accent-500" : "bg-white";
  return (
    <div className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur">
      <div className={`mb-2 h-2 w-2 rounded-full ${dot}`} />
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs text-white/80">{body}</p>
    </div>
  );
}
