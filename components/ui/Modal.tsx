"use client";

// Modal — a thin wrapper over the native <dialog> element.
// Why native: keyboard handling (Esc to close), focus trap, and the
// backdrop come for free. The `showModal()` / `close()` methods are
// imperative, so we expose a ref-based imperative API and a small
// open/onClose prop pair for the common case.

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type ReactNode,
} from "react";
import { Icon } from "./Icon";

export type ModalHandle = {
  open: () => void;
  close: () => void;
};

type ModalProps = {
  /** Controlled open state. If provided, the modal is fully controlled. */
  open?: boolean;
  /** Called when the user dismisses the modal (backdrop click, Esc, or close button). */
  onClose?: () => void;
  /** Title shown in the header. */
  title?: ReactNode;
  /** Optional subtitle / description shown under the title. */
  description?: ReactNode;
  /** Body content. */
  children: ReactNode;
  /** Optional footer (typically Cancel + Submit buttons). */
  footer?: ReactNode;
  /** Hide the top-right close (X) button. */
  hideClose?: boolean;
  /** Tailwind class for the panel width. Defaults to `max-w-lg`. */
  widthClass?: string;
};

export const Modal = forwardRef<ModalHandle, ModalProps>(function Modal(
  { open, onClose, title, description, children, footer, hideClose, widthClass = "max-w-lg" },
  ref,
) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const show = useCallback(() => {
    dialogRef.current?.showModal();
  }, []);

  useImperativeHandle(ref, () => ({ open: show, close }), [show, close]);

  // Sync controlled `open` prop with the dialog element.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  // The native `close` event fires on Esc and on `dialog.close()`. We
  // forward it to the parent so it can run its cleanup.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    const handler = () => onClose?.();
    dlg.addEventListener("close", handler);
    return () => dlg.removeEventListener("close", handler);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      // Tailwind via the `@layer` is not available here, so we use a
      // small inline-friendly class set. Backdrop is styled with
      // `::backdrop` pseudo via the global stylesheet.
      className={[
        "w-full rounded-2xl border border-line bg-surface p-0 shadow-[var(--shadow-pop)] backdrop:bg-black/50",
        widthClass,
      ].join(" ")}
    >
      <div className="flex max-h-[85vh] flex-col">
        {(title || !hideClose) && (
          <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
              {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
            </div>
            {!hideClose && (
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="rounded-md p-1.5 text-ink-muted hover:bg-surface-dim hover:text-ink"
              >
                <Icon.Close className="h-5 w-5" />
              </button>
            )}
          </header>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-muted px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
});
