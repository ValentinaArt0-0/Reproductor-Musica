import { motion } from "framer-motion";
import { useEffect, useId, useRef, type ReactNode } from "react";

interface ModalProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

export const modalButtonBase =
  "rounded-full px-5 py-2.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lavender-500 disabled:cursor-wait disabled:opacity-60";
export const modalSecondaryButton = `${modalButtonBase} border border-sage-300 bg-sand-50 text-sage-800 hover:bg-sage-100`;
export const modalPrimaryButton = `${modalButtonBase} bg-sage-700 text-sand-50 shadow-lift hover:bg-sage-800`;
export const modalDangerButton = `${modalButtonBase} bg-clay-700 text-sand-50 shadow-lift hover:bg-ink-800`;

const FOCUSABLE =
  'input, button:not([disabled]), [href], select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: focus moves into it and stays inside (Tab is trapped), Esc or a click on
 * the backdrop closes it, and focus returns to where it came from.
 */
export function Modal({ title, description, onClose, children }: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    (dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]") ?? focusable()[0])?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Safari and Firefox on macOS do not focus a button when it is clicked, so the previous
      // focus can be <body> (or an element that no longer exists): use the fallback target then.
      const canRestore =
        previouslyFocused && previouslyFocused !== document.body && previouslyFocused.isConnected;
      if (canRestore) previouslyFocused.focus();
      else document.querySelector<HTMLElement>("[data-focus-fallback]")?.focus();
    };
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-900/35 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
        className="w-full max-w-md rounded-3xl border border-sand-200 bg-sand-50 p-6 shadow-soft"
      >
        <h2 id={titleId} className="font-display text-2xl font-semibold text-ink-900">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="mt-2 text-sm text-ink-500">
            {description}
          </p>
        )}
        <div className="mt-5">{children}</div>
      </motion.div>
    </motion.div>
  );
}
