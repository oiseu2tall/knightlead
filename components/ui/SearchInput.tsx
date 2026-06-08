"use client";

// SearchInput — a styled text input with a leading search icon. Used
// in list-page toolbars where the query is reflected in the URL
// (server-filtered). Falls back to a controlled local state if no
// `name` is provided.

import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { Icon } from "./Icon";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Optional label text shown next to the field. */
  label?: string;
  /** Placeholder text. */
  placeholder?: string;
};

export const SearchInput = forwardRef<HTMLInputElement, Props>(function SearchInput(
  { label, placeholder = "Search…", className = "", id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? `search-${autoId}`;
  return (
    <div className={["relative", className].join(" ")}>
      {label && (
        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>
      )}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-muted"
      >
        <Icon.Search className="h-4 w-4" />
      </span>
      <input
        ref={ref}
        id={inputId}
        type="search"
        placeholder={placeholder}
        className="block w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        {...rest}
      />
    </div>
  );
});
