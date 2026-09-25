import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { SortableHeader } from "@/components/SortableHeader";
import { Pagination } from "@/components/Pagination";
import { FilterPanel } from "@/components/FilterPanel";
import { buildHref } from "@/lib/querystring";
import {
  listComponents,
  getComponentStats,
  countFilteredComponents,
  listComponentCategories,
  listComponentManufacturers,
  listComponentLocations,
  COMPONENT_PAGE_SIZE
} from "@/lib/components";

export default async function ComponentsPage({
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

  const [components, stats, totalFiltered, categories, manufacturers, locations] = await Promise.all([
    listComponents(filters, { sort: sp.sort, dir, page, pageSize: COMPONENT_PAGE_SIZE }),
    getComponentStats(),
    countFilteredComponents(filters),
    listComponentCategories(),
    listComponentManufacturers(),
    listComponentLocations()
  ]);

  return (
    <div className="usa-page">
      <div className="usa-page-header">
        <div>
          <h1 className="usa-page-title">Components</h1>
          <p className="usa-page-subtitle">
            Quantity-tracked parts installed into assets (memory, storage, readers).
          </p>
        </div>
      </div>

      <section className="stat-grid" aria-label="Component summary">
        <div className="stat-card">
          <div className="stat-label">Components</div>
          <div className="stat-value">{stats.total.toLocaleString("en-US")}</div>
          <div className="stat-card__detail">Distinct component types</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total units</div>
          <div className="stat-value">{stats.totalUnits.toLocaleString("en-US")}</div>
          <div className="stat-card__detail">Across all components</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Installed in assets</div>
          <div className="stat-value success">{stats.assignedUnits.toLocaleString("en-US")}</div>
          <div className="stat-card__detail">Units assigned to assets</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-label">Low stock</div>
          <div className="stat-value danger">{stats.lowStock.toLocaleString("en-US")}</div>
          <div className="stat-card__detail">At or below minimum quantity</div>
        </div>
      </section>

      <section className="usa-card" id="component-inventory">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Component inventory</span>
          <StatusTag tone="green">Active module</StatusTag>
        </div>
        <div className="usa-card__body">
          <FilterPanel activeCount={activeCount}>
            <form className="filter-bar" method="get" action="/components">
              {sp.sort ? <input type="hidden" name="sort" value={sp.sort} /> : null}
              {sp.sort ? <input type="hidden" name="dir" value={dir} /> : null}
              <label className="sr-only" htmlFor="cmp-search">Search components</label>
              <div className="filter-bar__search">
                <input id="cmp-search" name="q" className="usa-input" type="search" placeholder="Search name, serial, manufacturer" defaultValue={filters.q ?? ""} />
              </div>
              <label className="sr-only" htmlFor="cmp-category">Category</label>
              <select id="cmp-category" name="category" className="usa-select" defaultValue={filters.category ?? ""}>
                <option value="">All categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <label className="sr-only" htmlFor="cmp-manufacturer">Manufacturer</label>
              <select id="cmp-manufacturer" name="manufacturer" className="usa-select" defaultValue={filters.manufacturer ?? ""}>
                <option value="">All manufacturers</option>
                {manufacturers.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <label className="sr-only" htmlFor="cmp-location">Location</label>
              <select id="cmp-location" name="location" className="usa-select" defaultValue={filters.location ?? ""}>
                <option value="">All locations</option>
                {locations.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <label className="sr-only" htmlFor="cmp-status">Stock status</label>
              <select id="cmp-status" name="status" className="usa-select" defaultValue={filters.status ?? ""}>
                <option value="">Any stock level</option>
                <option value="low">Low stock</option>
                <option value="ok">In stock</option>
              </select>
              <button className="usa-button usa-button--primary usa-button--sm" type="submit">Apply</button>
              {activeCount > 0 ? <Link className="usa-button usa-button--outline usa-button--sm" href="/components">Clear</Link> : null}
            </form>
          </FilterPanel>

          <div className="table-wrap">
            <table className="usa-table">
              <thead>
                <tr>
                  <SortableHeader label="Name" column="name" basePath="/components" searchParams={headerParams} />
                  <SortableHeader label="Category" column="category" basePath="/components" searchParams={headerParams} />
                  <SortableHeader label="Manufacturer" column="manufacturer" basePath="/components" searchParams={headerParams} />
                  <SortableHeader label="Available / total" column="available" basePath="/components" searchParams={headerParams} />
                  <SortableHeader label="Location" column="location" basePath="/components" searchParams={headerParams} />
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {components.length === 0 ? (
                  <tr>
                    <td colSpan={6}>{activeCount > 0 ? "No components match your filters." : "No components recorded yet."}</td>
                  </tr>
                ) : (
                  components.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link className="record-title" href={`/components/${item.id}`}>{item.name}</Link>
                      </td>
                      <td>
                        {item.category ? (
                          <Link href={buildHref("/components", {}, { category: item.category })}>{item.category}</Link>
                        ) : "—"}
                      </td>
                      <td>
                        {item.manufacturer ? (
                          <Link href={`/manufacturers/${encodeURIComponent(item.manufacturer)}`}>{item.manufacturer}</Link>
                        ) : "—"}
                      </td>
                      <td className="font-mono">{item.available} / {item.qty}</td>
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
          <Pagination page={page} pageSize={COMPONENT_PAGE_SIZE} total={totalFiltered} basePath="/components" searchParams={headerParams} />
        </div>
      </section>
    </div>
  );
}
