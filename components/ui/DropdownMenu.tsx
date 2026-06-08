"use client";

// DropdownMenu — a tiny popover menu for action affordances like
// "Edit / Delete" on a row. Closes on outside click, on Esc, and
// after an item is selected.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

export type DropdownItem =
  | { kind?: "item"; label: string; onClick: () => void; danger?: boolean; icon?: ReactNode; disabled?: boolean }
  | { kind: "separator" }
  | { kind: "label"; label: string };

type DropdownProps = {
  trigger?: ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
  ariaLabel?: string;
};

export function DropdownMenu({ trigger, items, align = "right", ariaLabel = "Actions" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-dim hover:text-ink"
      >
        {trigger ?? <Icon.More className="h-5 w-5" />}
      </button>
      {open && (
        <div
          role="menu"
          className={[
            "absolute z-50 mt-1 min-w-[12rem] overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-pop)]",
            align === "right" ? "right-0" : "left-0",
          ].join(" ")}
        >
          {items.map((item, idx) => {
            if (item.kind === "separator") {
              return <div key={idx} className="my-1 h-px bg-line" />;
            }
            if (item.kind === "label") {
              return (
                <div key={idx} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  {item.label}
                </div>
              );
            }
            return (
              <button
                key={idx}
                role="menuitem"
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={[
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                  item.danger
                    ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                    : "text-ink hover:bg-surface-dim",
                  item.disabled ? "cursor-not-allowed opacity-50" : "",
                ].join(" ")}
              >
                {item.icon}
                <span className="flex-1 truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
