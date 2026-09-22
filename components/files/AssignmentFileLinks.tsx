"use client";

// Assignment file links — View / Download for the files attached to an
// assignment (templates, worksheets, etc.). The signed URLs are built
// server-side (signToken needs node:crypto) and passed in as `urls`
// so this component stays browser-safe.

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

export function AssignmentFileLinks({
  files,
}: {
  files: Array<{ key: string; name: string; url: string }>;
}) {
  if (files.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
        Assignment files
      </p>
      <ul className="space-y-1.5">
        {files.map((f) => (
          <li
            key={f.key}
            className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface-dim px-3 py-2 text-xs"
          >
            <Icon.File className="h-4 w-4 shrink-0 text-ink-muted" />
            <span className="truncate text-ink" title={f.name}>
              {f.name}
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <Link
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-brand-500 hover:text-brand-600"
              >
                <Icon.ExternalLink className="h-3.5 w-3.5" />
                View
              </Link>
              <a
                href={f.url}
                download
                className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-ink hover:bg-surface-dim"
              >
                <Icon.File className="h-3.5 w-3.5" />
                Download
              </a>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}