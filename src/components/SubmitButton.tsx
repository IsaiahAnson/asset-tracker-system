"use client";

import { useFormStatus } from "react-dom";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/lib/use-is-client";

// Reusable submit button for server-action forms.
//   - Shows a pending label while the action runs (prevents double-submits).
//   - Optionally requires confirmation via an in-app modal before submitting
//     (for destructive actions like Retire/Deny). The modal is portaled to
//     <body> so it sits above the rest of the UI regardless of where the
//     button lives in the layout.
export function SubmitButton({
  children,
  className,
  pendingText,
  confirm,
  confirmLabel,
  disabled
}: {
  children: ReactNode;
  className?: string;
  pendingText?: string;
  confirm?: string;
  confirmLabel?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const [open, setOpen] = useState(false);
  const mounted = useIsClient();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus the Confirm button when the modal opens, restore focus to the
  // triggering button when it closes. Restore ONLY on a true close (open
  // true -> false): focusing on initial mount would scroll the page to the
  // last-rendered SubmitButton on every load.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      const t = window.setTimeout(() => confirmRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      buttonRef.current?.focus();
    }
  }, [open]);

  // Esc dismisses; trap inside modal isn't critical for this minimal dialog.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!confirm) return;
      event.preventDefault();
      setOpen(true);
    },
    [confirm]
  );

  const handleConfirm = useCallback(() => {
    setOpen(false);
    // Submit the parent form programmatically. This bypasses the click
    // intercept above so the action actually runs.
    buttonRef.current?.form?.requestSubmit();
  }, []);

  const handleCancel = useCallback(() => setOpen(false), []);

  const modal = open && confirm ? (
    <div
      className="confirm-modal__backdrop"
      role="presentation"
      onMouseDown={(e) => {
        // Only treat clicks on the backdrop itself (not bubbled from the dialog) as cancel.
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div
        className="confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="submit-confirm-message"
      >
        <p id="submit-confirm-message" className="confirm-modal__message">{confirm}</p>
        <div className="confirm-modal__actions">
          <button
            type="button"
            className="usa-button usa-button--outline"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="usa-button usa-button--primary"
            onClick={handleConfirm}
          >
            {confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="submit"
        className={className}
        disabled={pending || disabled}
        aria-busy={pending}
        onClick={handleClick}
      >
        {pending ? (pendingText ?? "Working...") : children}
      </button>
      {mounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
