import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { SubmitButton } from "@/components/SubmitButton";
import { FilterPanel } from "@/components/FilterPanel";
import { listMaintenances, getMaintenanceStats, listMaintenanceTypes } from "@/lib/maintenance";
import { listComputerAssets } from "@/lib/assets";
import { canActingUserWrite } from "@/lib/authz";
import { logMaintenanceAction, completeMaintenanceAction } from "./actions";

const TYPES = ["repair", "upgrade", "calibration", "inspection", "warranty", "other"];

export default async function MaintenancePage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; type?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const filters = { q: sp.q?.trim() || undefined, type: sp.type || undefined, status: sp.status || undefined };
  const activeCount = [filters.q, filters.type, filters.status].filter(Boolean).length;
  const [records, stats, assets, canWrite, typeOptions] = await Promise.all([
    listMaintenances(filters),
    getMaintenanceStats(),
    listComputerAssets(),
    canActingUserWrite(),
    listMaintenanceTypes()
  ]);

  return (
    <div className="usa-page">
      <div className="usa-page-header">
        <div>
          <h1 className="usa-page-title">Maintenance</h1>
          <p className="usa-page-subtitle">
            Repair, upgrade, and inspection history for asset records.
          </p>
        </div>
      </div>

      <section className="stat-grid" aria-label="Maintenance summary">
        <div className="stat-card">
          <div className="stat-label">Records</div>
          <div className="stat-value">{stats.total.toLocaleString("en-US")}</div>
        </div>
        <div className="stat-card warn">
          <div className="stat-label">Open</div>
          <div className="stat-value warn">{stats.open.toLocaleString("en-US")}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Completed</div>
          <div className="stat-value success">{stats.completed.toLocaleString("en-US")}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total cost</div>
          <div className="stat-value">${Number(stats.totalCost).toLocaleString("en-US")}</div>
        </div>
      </section>

      {canWrite ? (
      <section className="usa-card" id="log-maintenance">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Log maintenance</span>
        </div>
        <div className="usa-card__body">
          <form action={logMaintenanceAction} className="asset-form-grid">
            <div className="usa-form-group">
              <label className="usa-label" htmlFor="m-asset">Asset</label>
              <select id="m-asset" name="assetId" className="usa-select" defaultValue="" required>
                <option value="" disabled>Select asset...</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>{a.assetTag} ({a.model})</option>
                ))}
              </select>
            </div>
            <div className="usa-form-group">
              <label className="usa-label" htmlFor="m-type">Type</label>
              <select id="m-type" name="type" className="usa-select" defaultValue="repair">
                {TYPES.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="usa-form-group">
              <label className="usa-label" htmlFor="m-title">Title</label>
              <input id="m-title" name="title" className="usa-input" type="text" required placeholder="What was done" />
            </div>
            <div className="usa-form-group">
              <label className="usa-label" htmlFor="m-supplier">Supplier</label>
              <input id="m-supplier" name="supplier" className="usa-input" type="text" placeholder="Vendor (optional)" />
            </div>
            <div className="usa-form-group">
              <label className="usa-label" htmlFor="m-cost">Cost (USD)</label>
              <input id="m-cost" name="cost" className="usa-input" type="number" min="0" step="0.01" placeholder="Optional" />
            </div>
            <div className="asset-form-grid__full flex-end gap-2">
              <SubmitButton className="usa-button usa-button--primary" pendingText="Logging...">Log maintenance</SubmitButton>
            </div>
          </form>
        </div>
      </section>
      ) : null}

      <section className="usa-card mt-3">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Maintenance history</span>
        </div>
        <div className="usa-card__body">
          <FilterPanel activeCount={activeCount}>
            <form className="filter-bar" method="get" action="/maintenance">
              <label className="sr-only" htmlFor="m-search">Search maintenance</label>
              <div className="filter-bar__search">
                <input id="m-search" name="q" className="usa-input" type="search" placeholder="Search title or asset" defaultValue={filters.q ?? ""} />
              </div>
              <label className="sr-only" htmlFor="m-type-filter">Type</label>
              <select id="m-type-filter" name="type" className="usa-select" defaultValue={filters.type ?? ""}>
                <option value="">All types</option>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
              <label className="sr-only" htmlFor="m-status-filter">Status</label>
              <select id="m-status-filter" name="status" className="usa-select" defaultValue={filters.status ?? ""}>
                <option value="">Any status</option>
                <option value="open">Open</option>
                <option value="completed">Completed</option>
              </select>
              <button className="usa-button usa-button--primary usa-button--sm" type="submit">Apply</button>
              {activeCount > 0 ? <Link className="usa-button usa-button--outline usa-button--sm" href="/maintenance">Clear</Link> : null}
            </form>
          </FilterPanel>
          <div className="table-wrap">
            <table className="usa-table">
              <thead>
                <tr>
                  <th scope="col">Asset</th>
                  <th scope="col">Type</th>
                  <th scope="col">Title</th>
                  <th scope="col">Started</th>
                  <th scope="col">Cost</th>
                  <th scope="col">Status</th>
                  {canWrite ? <th scope="col">Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={canWrite ? 7 : 6}>No maintenance records yet.</td>
                  </tr>
                ) : (
                  records.map((m) => (
                    <tr key={m.id}>
                      <td className="font-mono">
                        <Link href={`/assets/${m.assetId}`}>{m.assetTag}</Link>
                      </td>
                      <td>
                        <Link href={`/maintenance?type=${encodeURIComponent(m.type)}`}>
                          {m.type.charAt(0).toUpperCase() + m.type.slice(1)}
                        </Link>
                      </td>
                      <td>{m.title}</td>
                      <td className="font-mono">{m.startDate}</td>
                      <td className="font-mono">{m.cost ? `$${Number(m.cost).toLocaleString("en-US")}` : "—"}</td>
                      <td>
                        {m.open ? (
                          <StatusTag tone="yellow">Open</StatusTag>
                        ) : (
                          <StatusTag tone="green">{`Completed ${m.completionDate}`}</StatusTag>
                        )}
                      </td>
                      {canWrite ? (
                      <td>
                        {m.open ? (
                          <form action={completeMaintenanceAction} className="row-actions__form">
                            <input type="hidden" name="id" value={m.id} />
                            <SubmitButton className="usa-button usa-button--outline usa-button--sm" pendingText="Updating...">
                              Mark complete
                            </SubmitButton>
                          </form>
                        ) : (
                          "—"
                        )}
                      </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
