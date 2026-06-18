// /instructor/courses — instructor “My courses” list.
// Scoped to courses an instructor teaches (or all courses for ADMIN).

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge } from "@/components/ui/Primitives";
import { ROLE_META } from "@/lib/role";
import { ProgressBar } from "@/components/ui/Primitives";

export const metadata = { title: "Courses · Instructor" };

export default async function InstructorCoursesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
    redirect("/forbidden");
  }

  const isAdmin = session.user.role === "ADMIN";

  const courses = await db.course.findMany({
    where: isAdmin ? {} : { instructorId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { modules: true, enrollments: true } },
    },
    take: 50,
  });

  return (
    <>
      <PageHeader
        eyebrow={<>{ROLE_META.INSTRUCTOR.plural} workspace</>}

        title="My courses"
        description={isAdmin ? "All courses in the catalog (admin view)." : "Courses you teach."}
        accent="accent"
      />

      {courses.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-muted">
            {isAdmin ? "No courses found." : "You aren't teaching any courses yet."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {courses.map((c) => (
            <Card key={c.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={c.isPublished ? "success" : "neutral"}>
                      {c.isPublished ? "published" : "draft"}
                    </Badge>
                    <p className="truncate text-sm font-semibold text-ink">{c.title}</p>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {c._count.enrollments} students · {c._count.modules} modules
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:block">
                    <ProgressBar value={c._count.modules ? Math.min(100, c._count.modules * 10) : 0} />
                  </div>
                  <Link
                    href={`/instructor/courses/${c.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-dim"
                  >
                    Manage
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

