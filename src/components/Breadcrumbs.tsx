import Link from "next/link";

export type Crumb = { label: string; href?: string };

// Simple breadcrumb trail for detail/edit pages. The last crumb is the current
// page (no link).
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, idx) => {
        const last = idx === items.length - 1;
        return (
          <span className="breadcrumbs__item" key={`${item.label}-${idx}`}>
            {item.href && !last ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span aria-current={last ? "page" : undefined}>{item.label}</span>
            )}
            {last ? null : <span className="breadcrumbs__sep" aria-hidden="true">/</span>}
          </span>
        );
      })}
    </nav>
  );
}
