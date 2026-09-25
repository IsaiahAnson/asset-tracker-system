"use client";

import { useEffect, useState } from "react";
import type { Flash } from "@/lib/flash";
import { clearFlashAction } from "@/app/(app)/flash-actions";

export function FlashToast({ flash }: { flash: Flash | null }) {
  const [visible, setVisible] = useState(Boolean(flash));

  useEffect(() => {
    if (!flash) return;
    setVisible(true);
    // Clear the cookie so the toast does not reappear on the next navigation.
    void clearFlashAction();
    const timer = window.setTimeout(() => setVisible(false), 5000);
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
        onClick={() => setVisible(false)}
      >
        &times;
      </button>
    </div>
  );
}
