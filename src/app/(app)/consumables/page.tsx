import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { SortableHeader } from "@/components/SortableHeader";
import { Pagination } from "@/components/Pagination";
import { FilterPanel } from "@/components/FilterPanel";
import { buildHref } from "@/lib/querystring";
import {
  listConsumables,
  getConsumableStats,
  countFilteredConsumables,
  listConsumableCategories,
  listConsumableManufacturers,
  listConsumableLocations,
  CONSUMABLE_PAGE_SIZE
} from "@/lib/consumables";

export default async function ConsumablesPage({
  searchParams
}: {
  searchParams: Promise<{
    q?: string; category?: string; manufacturer?: string; location?: string; status?: string;
    sort?: string; dir?: string; page?: string;
  }>;
}) {
  const sp = await searchParams;
  const filters = {
    q: sp.q?.trim() || undefined,
    category: sp.category || undefined,
    manufacturer: sp.manufacturer || undefined,
    location: sp.location || undefined,
    status: sp.status || undefined
  };
  const activeCount = [filters.q, filters.category, filters.manufacturer, filters.location, filters.status].filter(Boolean).length;
  const dir = sp.dir === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(sp.page) || 1);
  const headerParams: Record<string, string | undefined> = {
    q: filters.q, category: filters.category, manufacturer: filters.manufacturer,
    location: filters.location, status: filters.status, sort: sp.sort, dir: sp.sort ? dir : undefined
  };

  const [consumables, stats, totalFiltered, categories, manufacturers, locations] = await Promise.all([
    listConsumables(filters, { sort: sp.sort, dir, page, pageSize: CONSUMABLE_PAGE_SIZE }),
    getConsumableStats(),
    countFilteredConsumables(filters),
    listConsumableCategories(),
    listConsumableManufacturers(),
    listConsumableLocations()
  ]);

  return (
    <div className="usa-page">
      <div className="usa-page-header">
        <div>
          <h1 className="usa-page-title">Consumables</h1>
          <p className="usa-page-subtitle">
            Quantity-tracked consumables issued to users and drawn down from stock.
          </p>
        </div>
      </div>

      <section className="stat-grid" aria-label="Consumable summary">
        <div className="stat-card">
          <div className="stat-label">Consumables</div>
          <div className="stat-value">{stats.total.toLocaleString("en-US")}</div>
          <div className="stat-card__detail">Distinct consumable types</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Units remaining</div>
          <div className="stat-value">{stats.remainingUnits.toLocaleString("en-US")}</div>
          <div className="stat-card__detail">Across all consumables</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Issued</div>
          <div className="stat-value">{stats.issued.toLocaleString("en-US")}</div>
          <div className="stat-card__detail">Total units consumed</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-label">Low stock</div>
          <div className="stat-value danger">{stats.lowStock.toLocaleString("en-US")}</div>
          <div className="stat-card__detail">At or below minimum quantity</div>
        </div>
      </section>

      <section className="usa-card" id="consumable-inventory">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Consumable inventory</span>
          <StatusTag tone="green">Active module</StatusTag>
        </div>
        <div className="usa-card__body">
          <FilterPanel activeCount={activeCount}>
            <form className="filter-bar" method="get" action="/consumables">
              {sp.sort ? <input type="hidden" name="sort" value={sp.sort} /> : null}
              {sp.sort ? <input type="hidden" name="dir" value={dir} /> : null}
              <label className="sr-only" htmlFor="con-search">Search consumables</label>
              <div className="filter-bar__search">
                <input id="con-search" name="q" className="usa-input" type="search" placeholder="Search name, item no., manufacturer" defaultValue={filters.q ?? ""} />
              </div>
              <label className="sr-only" htmlFor="con-category">Category</label>
              <select id="con-category" name="category" className="usa-select" defaultValue={filters.category ?? ""}>
                <option value="">All categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <label className="sr-only" htmlFor="con-manufacturer">Manufacturer</label>
              <select id="con-manufacturer" name="manufacturer" className="usa-select" defaultValue={filters.manufacturer ?? ""}>
                <option value="">All manufacturers</option>
                {manufacturers.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <label className="sr-only" htmlFor="con-location">Location</label>
              <select id="con-location" name="location" className="usa-select" defaultValue={filters.location ?? ""}>
                <option value="">All locations</option>
                {locations.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <label className="sr-only" htmlFor="con-status">Stock status</label>
              <select id="con-status" name="status" className="usa-select" defaultValue={filters.status ?? ""}>
                <option value="">Any stock level</option>
                <option value="low">Low stock</option>
                <option value="ok">In stock</option>
              </select>
              <button className="usa-button usa-button--primary usa-button--sm" type="submit">Apply</button>
              {activeCount > 0 ? <Link className="usa-button usa-button--outline usa-button--sm" href="/consumables">Clear</Link> : null}
            </form>
          </FilterPanel>

          <div className="table-wrap">
            <table className="usa-table">
              <thead>
                <tr>
                  <SortableHeader label="Name" column="name" basePath="/consumables" searchParams={headerParams} />
                  <SortableHeader label="Category" column="category" basePath="/consumables" searchParams={headerParams} />
                  <SortableHeader label="Item no." column="itemNo" basePath="/consumables" searchParams={headerParams} />
                  <SortableHeader label="Remaining / total" column="remaining" basePath="/consumables" searchParams={headerParams} />
                  <SortableHeader label="Location" column="location" basePath="/consumables" searchParams={headerParams} />
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {consumables.length === 0 ? (
                  <tr>
                    <td colSpan={6}>{activeCount > 0 ? "No consumables match your filters." : "No consumables recorded yet."}</td>
                  </tr>
                ) : (
                  consumables.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link className="record-title" href={`/consumables/${item.id}`}>{item.name}</Link>
                      </td>
                      <td>
                        {item.category ? (
                          <Link href={buildHref("/consumables", {}, { category: item.category })}>{item.category}</Link>
                        ) : "—"}
                      </td>
                      <td className="font-mono">{item.itemNo ?? "—"}</td>
                      <td className="font-mono">{item.remaining} / {item.qty}</td>
                      <td>
                        {item.location ? (
                          <Link href={`/locations/${encodeURIComponent(item.location)}`}>{item.location}</Link>
                        ) : "—"}
                      </td>
                      <td>
                        {item.lowStock ? (
                          <StatusTag tone="red">{`Low stock (min ${item.minAmt})`}</StatusTag>
                        ) : (
                          <StatusTag tone="green">In stock</StatusTag>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={CONSUMABLE_PAGE_SIZE} total={totalFiltered} basePath="/consumables" searchParams={headerParams} />
        </div>
      </section>
    </div>
  );
}
