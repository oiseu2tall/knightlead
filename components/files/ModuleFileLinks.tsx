"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

export function ModuleFileLinks({
  fileUrl,
  fileName,
}: {
  fileUrl: string;
  fileName: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href={fileUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-500 hover:text-brand-600"
      >
        <Icon.ExternalLink className="h-3.5 w-3.5" />
        View
      </Link>

      <a
        href={fileUrl}
        download
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1 text-xs font-medium text-ink hover:bg-surface-dim"
      >
        <Icon.File className="h-3.5 w-3.5" />
        Download
      </a>

      <span className="max-w-[190px] truncate text-xs text-ink-muted" title={fileName}>
        {fileName}
      </span>
    </div>
  );
}

