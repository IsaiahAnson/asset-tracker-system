import Link from "next/link";
import { buildHref } from "@/lib/querystring";

// Previous/next pager that preserves the current query string. Renders nothing
// when everything fits on a single page.
export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  searchParams
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="pagination__status">
        {first}–{last} of {total}
      </span>
      <div className="pagination__controls">
        {page > 1 ? (
          <Link
            className="usa-button usa-button--outline usa-button--sm"
            href={buildHref(basePath, searchParams, { page: String(page - 1) })}
          >
            Previous
          </Link>
        ) : (
          <span className="usa-button usa-button--outline usa-button--sm" aria-disabled="true">
            Previous
          </span>
        )}
        <span className="pagination__page">
          Page {page} of {totalPages}
        </span>
        {page < totalPages ? (
          <Link
            className="usa-button usa-button--outline usa-button--sm"
            href={buildHref(basePath, searchParams, { page: String(page + 1) })}
          >
            Next
          </Link>
        ) : (
          <span className="usa-button usa-button--outline usa-button--sm" aria-disabled="true">
            Next
          </span>
        )}
      </div>
    </nav>
  );
}
