"use client";

import { useEffect, useState } from "react";
import type { Flash } from "@/lib/flash";
import { clearFlashAction } from "@/app/(app)/flash-actions";

export function FlashToast({ flash }: { flash: Flash | null }) {
  // The flash that was dismissed (by timeout or the close button). A new flash
  // object from the server is visible again without resetting state in an effect.
  const [dismissed, setDismissed] = useState<Flash | null>(null);
  const visible = flash !== null && flash !== dismissed;

  useEffect(() => {
    if (!flash) return;
    // Clear the cookie so the toast does not reappear on the next navigation.
    void clearFlashAction();
    const timer = window.setTimeout(() => setDismissed(flash), 5000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  if (!flash || !visible) return null;

  return (
    <div className={`toast toast--${flash.type}`} role="status" aria-live="polite">
      <span>{flash.message}</span>
      <button
        type="button"
        className="toast__dismiss"
        aria-label="Dismiss notification"
        onClick={() => setDismissed(flash)}
      >
        &times;
      </button>
    </div>
  );
}
