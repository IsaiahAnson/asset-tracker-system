import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import {
  getDashboardStats,
  getCategoryRollup,
  listActiveWorkflows,
  getAssetsByStatus,
  getModuleInventory,
  getAttentionItems,
  type BarDatum
} from "@/lib/dashboard";
import { listAuditEntries } from "@/lib/audit";

function BarChart({ data }: { data: BarDatum[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bar-chart">
      {data.map((d) => (
        <div className="bar-row" key={d.label}>
          <span className="bar-row__label">{d.label}</span>
          <span className="bar-row__track">
            <span
              className={`bar-row__fill ${d.tone ?? ""}`}
              style={{ width: `${Math.round((d.value / max) * 100)}%` }}
            />
          </span>
          <span className="bar-row__value">{d.value.toLocaleString("en-US")}</span>
        </div>
      ))}
    </div>
  );
}

export default async function DashboardPage() {
  const [
    assetStats,
    categoryRollup,
    workflows,
    assetsByStatus,
    moduleInventory,
    attention,
    recentActivity
  ] = await Promise.all([
    getDashboardStats(),
    getCategoryRollup(),
    listActiveWorkflows(),
    getAssetsByStatus(),
    getModuleInventory(),
    getAttentionItems(),
    listAuditEntries({}, 8)
  ]);
  return (
    <div className="usa-page">
      <div className="usa-page-header">
        <div>
          <h1 className="usa-page-title">Asset Management Dashboard</h1>
          <p className="usa-page-subtitle">
            Browser-native operational view for asset custody, approvals, and audit evidence.
          </p>
        </div>
        <div className="page-actions">
          <Link className="usa-button usa-button--outline" href="/audit">
            Export audit packet
          </Link>
          <Link className="usa-button usa-button--primary" href="/assets#asset-create">
            Create asset
          </Link>
        </div>
      </div>


      <section className="usa-card mt-3" aria-label="Needs attention">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Needs attention</span>
          {attention.length === 0 ? (
            <StatusTag tone="green">All clear</StatusTag>
          ) : (
            <StatusTag tone="yellow">{`${attention.length} item${attention.length === 1 ? "" : "s"}`}</StatusTag>
          )}
        </div>
        <div className="usa-card__body">
          {attention.length === 0 ? (
            <p>Nothing needs action right now: no overdue checkouts, low stock, or pending requests.</p>
          ) : (
            <ul className="priority-list">
              {attention.map((item) => (
                <li key={item.label}>
                  <span className={`priority-list__marker priority-list__marker--${item.tone === "danger" ? "danger" : item.tone === "warn" ? "warn" : "success"}`} aria-hidden="true" />
                  <div>
                    <Link href={item.href}>{item.label}</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="stat-grid mt-3" aria-label="Asset summary">
        {assetStats.map((stat) => (
          <div className={`stat-card ${stat.tone ?? ""}`} key={stat.label}>
            <div className="stat-label">{stat.label}</div>
            <div className={`stat-value ${stat.tone ?? ""}`}>{stat.value}</div>
            <div className="stat-card__detail">{stat.detail}</div>
          </div>
        ))}
      </section>

      <div className="dashboard-grid">
        <section className="usa-card">
          <div className="usa-card__header">
            <span className="usa-card__header-title">Asset status distribution</span>
          </div>
          <div className="usa-card__body">
            {assetsByStatus.length === 0 ? (
              <p>No assets recorded yet.</p>
            ) : (
              <BarChart data={assetsByStatus} />
            )}
          </div>
        </section>

        <section className="usa-card">
          <div className="usa-card__header">
            <span className="usa-card__header-title">Inventory across modules</span>
          </div>
          <div className="usa-card__body">
            <BarChart data={moduleInventory} />
          </div>
        </section>
      </div>

      <div className="dashboard-grid mt-3">
        <section className="usa-card">
          <div className="usa-card__header">
            <span className="usa-card__header-title">Asset category rollout</span>
            <Link className="usa-button usa-button--outline usa-button--sm" href="/assets">
              View assets
            </Link>
          </div>
          <div className="usa-card__body">
            <div className="table-wrap">
              <table className="usa-table">
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    <th scope="col">Records</th>
                    <th scope="col">Module status</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryRollup.map((item) => (
                    <tr key={item.category}>
                      <td>{item.category}</td>
                      <td className="font-mono">{item.count}</td>
                      <td>
                        <StatusTag tone={item.tone}>{item.status}</StatusTag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

      </div>

      <section className="usa-card mt-3">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Active workflows</span>
          <Link className="usa-button usa-button--outline usa-button--sm" href="/workflows">
            Review queue
          </Link>
        </div>
        <div className="usa-card__body">
          <div className="table-wrap">
            <table className="usa-table">
              <thead>
                <tr>
                  <th scope="col">Workflow</th>
                  <th scope="col">Person</th>
                  <th scope="col">Stage</th>
                  <th scope="col">Status</th>
                  <th scope="col">Due</th>
                </tr>
              </thead>
              <tbody>
                {workflows.map((workflow) => (
                  <tr key={workflow.id}>
                    <td>
                      <span className="record-title">{workflow.title}</span>
                      <span className="record-id">{workflow.id}</span>
                    </td>
                    <td>{workflow.person}</td>
                    <td>{workflow.stage}</td>
                    <td>
                      <StatusTag tone={workflow.status === "At risk" ? "yellow" : "cyan"}>
                        {workflow.status}
                      </StatusTag>
                    </td>
                    <td>{workflow.due}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="usa-card mt-3">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Recent activity</span>
          <Link className="usa-button usa-button--outline usa-button--sm" href="/audit">
            Full audit trail
          </Link>
        </div>
        <div className="usa-card__body">
          {recentActivity.length === 0 ? (
            <p>No activity recorded yet.</p>
          ) : (
            <ul className="priority-list">
              {recentActivity.map((entry) => (
                <li key={entry.id}>
                  <span className="priority-list__marker priority-list__marker--success" aria-hidden="true" />
                  <div>
                    <strong>{entry.action}</strong>
                    <p>
                      <span className="font-mono">{entry.record.replace(/_/g, "-")}</span> by {entry.actor} · {entry.timestamp}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
