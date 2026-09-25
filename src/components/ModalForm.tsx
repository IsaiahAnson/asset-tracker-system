"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/lib/use-is-client";
import { useFormStatus } from "react-dom";
import { SubmitButton } from "@/components/SubmitButton";

// Closes the modal once its form action has run (pending goes true -> false).
// Must live inside the <form> so useFormStatus reads that form.
function AutoClose({ onDone }: { onDone: () => void }) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  useEffect(() => {
    if (pending) {
      wasPending.current = true;
    } else if (wasPending.current) {
      wasPending.current = false;
      onDone();
    }
  }, [pending, onDone]);
  return null;
}

// A trigger button that opens a centered modal dialog containing a server-action
// form. Used for admin add/edit so the edit form pops up instead of expanding
// inside a (sometimes narrow) table row. The form fields are passed as children;
// this component supplies the dialog chrome, Cancel, and the Submit button.
export function ModalForm({
  triggerLabel,
  triggerClassName,
  title,
  action,
  submitLabel,
  pendingLabel,
  children
}: {
  triggerLabel: string;
  triggerClassName?: string;
  title: string;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  pendingLabel?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const mounted = useIsClient();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const modal = open ? (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal__header">{title}</div>
        <form action={action} className="modal__form">
          <div className="modal__body">{children}</div>
          <div className="modal__actions">
            <button type="button" className="usa-button usa-button--outline" onClick={close}>
              Cancel
            </button>
            <SubmitButton className="usa-button usa-button--primary" pendingText={pendingLabel ?? "Saving..."}>
              {submitLabel}
            </SubmitButton>
          </div>
          <AutoClose onDone={close} />
        </form>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        className={triggerClassName ?? "usa-button usa-button--outline usa-button--sm"}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </button>
      {mounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
