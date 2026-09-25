"use client";

import { useRef, useState } from "react";

// Return-date field that supports both free typing (YYYY-MM-DD) and a native
// calendar picker. The text input is the one that submits (name=expectedReturn);
// the calendar button drives a hidden native date input that mirrors its value
// back into the text field.
export function ReturnDateField({ id, assetTag }: { id: string; assetTag: string }) {
  const [value, setValue] = useState("");
  const nativeRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const el = nativeRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        // showPicker can throw if not allowed; fall back to focus/click below.
      }
    }
    el.focus();
    el.click();
  }

  return (
    <span className="date-combo">
      <input
        id={id}
        name="expectedReturn"
        type="text"
        inputMode="numeric"
        placeholder="YYYY-MM-DD"
        pattern="\d{4}-\d{2}-\d{2}"
        maxLength={10}
        autoComplete="off"
        className="usa-input usa-input--sm date-combo__text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={`Expected return date for ${assetTag}, format YYYY-MM-DD (optional)`}
        title="Type the date as YYYY-MM-DD, or use the calendar button. Optional, leave blank for no return deadline."
      />
      <button
        type="button"
        className="date-combo__btn"
        onClick={openPicker}
        aria-label={`Open calendar to pick the return date for ${assetTag}`}
        title="Pick from calendar"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>
      <input
        ref={nativeRef}
        type="date"
        className="date-combo__native"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </span>
  );
}
