import type { ReactNode } from "react";

// Collapsible filter panel built on <details>/<summary> so it works without
// client JS and stays keyboard/screen-reader accessible. The summary is the
// "Filters" button; children render the filter form. Opens automatically when
// filters are active so the user can see what is applied.
export function FilterPanel({
  activeCount,
  defaultOpen,
  children
}: {
  activeCount: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="filter-panel" open={defaultOpen || activeCount > 0}>
      <summary className="filter-panel__toggle">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        <span>Filters</span>
        {activeCount > 0 ? <span className="filter-panel__count">{activeCount}</span> : null}
        <svg className="filter-panel__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>
      <div className="filter-panel__body">{children}</div>
    </details>
  );
}
