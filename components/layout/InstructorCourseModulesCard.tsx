import Link from "next/link";

import { Card } from "@/components/ui/Primitives";

export function InstructorCourseModulesCard() {
  return (
    <Card>
      <Link
        href="/instructor/course-modules"
        className="block p-5"
        aria-label="View course modules"
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Course modules
        </div>
        <div className="mt-2 text-lg font-semibold text-ink">Download your teaching materials</div>
        <div className="mt-2 text-sm text-ink-muted">Browse all module attachments across your courses.</div>
      </Link>
    </Card>
  );
}

