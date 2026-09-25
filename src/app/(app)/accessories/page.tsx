import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { SortableHeader } from "@/components/SortableHeader";
import { Pagination } from "@/components/Pagination";
import { FilterPanel } from "@/components/FilterPanel";
import { buildHref } from "@/lib/querystring";
import {
  listAccessories,
  getAccessoryStats,
  countFilteredAccessories,
  listAccessoryCategories,
  listAccessoryManufacturers,
  listAccessoryLocations,
  ACCESSORY_PAGE_SIZE
} from "@/lib/accessories";

export default async function AccessoriesPage({
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

  const [accessories, stats, totalFiltered, categories, manufacturers, locations] = await Promise.all([
    listAccessories(filters, { sort: sp.sort, dir, page, pageSize: ACCESSORY_PAGE_SIZE }),
    getAccessoryStats(),
    countFilteredAccessories(filters),
    listAccessoryCategories(),
    listAccessoryManufacturers(),
    listAccessoryLocations()
  ]);

  return (
    <div className="usa-page">
      <div className="usa-page-header">
        <div>
          <h1 className="usa-page-title">Accessories</h1>
          <p className="usa-page-subtitle">
            Quantity-tracked accessories checked out to users and returned to stock.
          </p>
        </div>
      </div>

      <section className="stat-grid" aria-label="Accessory summary">
        <div className="stat-card">
          <div className="stat-label">Accessories</div>
          <div className="stat-value">{stats.total.toLocaleString("en-US")}</div>
          <div className="stat-card__detail">Distinct accessory types</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total units</div>
          <div className="stat-value">{stats.totalUnits.toLocaleString("en-US")}</div>
          <div className="stat-card__detail">Across all accessories</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Checked out</div>
          <div className="stat-value success">{stats.checkedOut.toLocaleString("en-US")}</div>
          <div className="stat-card__detail">Currently with users</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-label">Low stock</div>
          <div className="stat-value danger">{stats.lowStock.toLocaleString("en-US")}</div>
          <div className="stat-card__detail">At or below minimum quantity</div>
        </div>
      </section>

      <section className="usa-card" id="accessory-inventory">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Accessory inventory</span>
          <StatusTag tone="green">Active module</StatusTag>
        </div>
        <div className="usa-card__body">
          <FilterPanel activeCount={activeCount}>
            <form className="filter-bar" method="get" action="/accessories">
              {sp.sort ? <input type="hidden" name="sort" value={sp.sort} /> : null}
              {sp.sort ? <input type="hidden" name="dir" value={dir} /> : null}
              <label className="sr-only" htmlFor="acc-search">Search accessories</label>
              <div className="filter-bar__search">
                <input id="acc-search" name="q" className="usa-input" type="search" placeholder="Search name or manufacturer" defaultValue={filters.q ?? ""} />
              </div>
              <label className="sr-only" htmlFor="acc-category">Category</label>
              <select id="acc-category" name="category" className="usa-select" defaultValue={filters.category ?? ""}>
                <option value="">All categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <label className="sr-only" htmlFor="acc-manufacturer">Manufacturer</label>
              <select id="acc-manufacturer" name="manufacturer" className="usa-select" defaultValue={filters.manufacturer ?? ""}>
                <option value="">All manufacturers</option>
                {manufacturers.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <label className="sr-only" htmlFor="acc-location">Location</label>
              <select id="acc-location" name="location" className="usa-select" defaultValue={filters.location ?? ""}>
                <option value="">All locations</option>
                {locations.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <label className="sr-only" htmlFor="acc-status">Stock status</label>
              <select id="acc-status" name="status" className="usa-select" defaultValue={filters.status ?? ""}>
                <option value="">Any stock level</option>
                <option value="low">Low stock</option>
                <option value="ok">In stock</option>
              </select>
              <button className="usa-button usa-button--primary usa-button--sm" type="submit">Apply</button>
              {activeCount > 0 ? <Link className="usa-button usa-button--outline usa-button--sm" href="/accessories">Clear</Link> : null}
            </form>
          </FilterPanel>

          <div className="table-wrap">
            <table className="usa-table">
              <thead>
                <tr>
                  <SortableHeader label="Name" column="name" basePath="/accessories" searchParams={headerParams} />
                  <SortableHeader label="Category" column="category" basePath="/accessories" searchParams={headerParams} />
                  <SortableHeader label="Manufacturer" column="manufacturer" basePath="/accessories" searchParams={headerParams} />
                  <SortableHeader label="Available / total" column="available" basePath="/accessories" searchParams={headerParams} />
                  <SortableHeader label="Location" column="location" basePath="/accessories" searchParams={headerParams} />
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {accessories.length === 0 ? (
                  <tr>
                    <td colSpan={6}>{activeCount > 0 ? "No accessories match your filters." : "No accessories recorded yet."}</td>
                  </tr>
                ) : (
                  accessories.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link className="record-title" href={`/accessories/${item.id}`}>{item.name}</Link>
                      </td>
                      <td>
                        {item.category ? (
                          <Link href={buildHref("/accessories", {}, { category: item.category })}>{item.category}</Link>
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
          <Pagination page={page} pageSize={ACCESSORY_PAGE_SIZE} total={totalFiltered} basePath="/accessories" searchParams={headerParams} />
        </div>
      </section>
    </div>
  );
}
