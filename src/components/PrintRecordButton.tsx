"use client";

// Triggers the browser's print dialog for the current page. Combined with the
// print stylesheet in App.css, the printed output is the record content only
// (no sidebar, no action toolbar, no tabs). Mirrors the "Print Current Record"
// affordance users know from legacy desktop database tools.
export function PrintRecordButton() {
  return (
    <button
      type="button"
      className="usa-button usa-button--outline"
      onClick={() => window.print()}
    >
      Print record
    </button>
  );
}
