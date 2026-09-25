import Link from "next/link";
import { buildHref } from "@/lib/querystring";

// A clickable table column header that toggles ?sort=<column>&dir=<asc|desc>
// while preserving the rest of the current query string. Resets to page 1 on
// any sort change so the user lands on the first page of the new ordering.
export function SortableHeader({
  label,
  column,
  basePath,
  searchParams
}: {
  label: string;
  column: string;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}) {
  const active = searchParams.sort === column;
  const currentDir = searchParams.dir === "asc" ? "asc" : "desc";
  const nextDir = active && currentDir === "asc" ? "desc" : "asc";
  const indicator = active ? (currentDir === "asc" ? "↑" : "↓") : "";

  const href = buildHref(basePath, searchParams, {
    sort: column,
    dir: nextDir,
    page: undefined
  });

  return (
    <th scope="col" aria-sort={active ? (currentDir === "asc" ? "ascending" : "descending") : "none"}>
      <Link className={`table-sort${active ? " table-sort--active" : ""}`} href={href}>
        {label}
        {indicator ? <span className="table-sort__indicator" aria-hidden="true">{indicator}</span> : null}
      </Link>
    </th>
  );
}
