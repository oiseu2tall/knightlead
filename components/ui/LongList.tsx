"use client";

// LongList — progressive reveal for long lists/tables.
// Renders the first `pageSize` items, then a "Show more" button
// reveals the rest. Combine with `content-visibility: auto` on the
// rows (via the `.kl-virtualize*` class) to make even 1000-row
// tables render fast.

import { Fragment, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";

type VirtualizeClass = "kl-virtualize" | "kl-virtualize-tight" | "" | "contents";

type Props<T> = {
  items: T[];
  pageSize?: number;
  /** Increment per "Show more" click. Defaults to `pageSize`. */
  stepSize?: number;
  /** Tailwind class to apply to the container for CSS virtualization.
   *  Pass `""` or `"contents"` to skip the wrapper entirely (e.g. when
   *  rendering table rows that must live directly inside a <tbody>). */
  virtualizeClass?: VirtualizeClass;
  renderItem: (item: T, index: number) => ReactNode;
  /** Render a row key extractor. */
  getKey: (item: T, index: number) => string;
  emptyState?: ReactNode;
};

export function LongList<T>({
  items,
  pageSize = 50,
  stepSize,
  virtualizeClass = "kl-virtualize",
  renderItem,
  getKey,
  emptyState,
}: Props<T>) {
  const [shown, setShown] = useState(pageSize);
  const step = stepSize ?? pageSize;
  const visible = items.slice(0, shown);
  const hasMore = shown < items.length;

  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  // When the caller asked for `""` or `"contents"`, do NOT render a
  // wrapper element. Some parents (notably <tbody>) reject non-table
  // children even when the wrapper has `display: contents` — React's
  // HTML validator still flags <div> as a parent of <tr>.
  const useWrapper = virtualizeClass !== "" && virtualizeClass !== "contents";
  const wrapperClass = useWrapper ? virtualizeClass : undefined;

  return (
    <>
      {useWrapper ? (
        <div className={wrapperClass}>
          {visible.map((item, i) => (
            <div key={getKey(item, i)}>{renderItem(item, i)}</div>
          ))}
        </div>
      ) : (
        <Fragment>
          {visible.map((item, i) => (
            <Fragment key={getKey(item, i)}>{renderItem(item, i)}</Fragment>
          ))}
        </Fragment>
      )}
      {hasMore && (
        <div className="mt-4 flex items-center justify-center">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShown((n) => Math.min(n + step, items.length))}
          >
            <Icon.ChevronDown className="h-4 w-4" />
            Show {Math.min(step, items.length - shown)} more
            <span className="ml-1 text-ink-muted">
              ({items.length - shown} remaining)
            </span>
          </Button>
        </div>
      )}
    </>
  );
}
