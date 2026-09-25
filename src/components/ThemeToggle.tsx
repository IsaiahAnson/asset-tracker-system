"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // The blocking script in the document head has already applied the
    // persisted theme to <html data-theme>; mirror it into control state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  function toggleTheme() {
    const nextDark = !dark;
    document.documentElement.dataset.theme = nextDark ? "dark" : "light";
    window.localStorage.setItem("ats-theme", nextDark ? "dark" : "light");
    setDark(nextDark);
  }

  return (
    <button
      className="usa-theme-toggle"
      type="button"
      aria-pressed={dark}
      onClick={toggleTheme}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      <svg className="usa-theme-toggle__icon usa-theme-toggle__icon--moon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
      <svg className="usa-theme-toggle__icon usa-theme-toggle__icon--sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
      <span>{dark ? "Light" : "Dark"}</span>
    </button>
  );
}
