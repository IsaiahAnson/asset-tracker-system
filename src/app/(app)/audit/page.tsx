import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { FilterPanel } from "@/components/FilterPanel";
import { buildHref } from "@/lib/querystring";
import { roleMatrix } from "@/lib/sample-data";
import { listAuditEntries, listAuditRecordTypes, listAuditActors, listAuditActions } from "@/lib/audit";

export default async function AuditPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; recordType?: string; actor?: string; action?: string }>;
}) {
  const sp = await searchParams;
  const filters = {
    q: sp.q?.trim() || undefined,
    recordType: sp.recordType || undefined,
    actor: sp.actor || undefined,
    action: sp.action || undefined
  };
  const activeCount = [filters.q, filters.recordType, filters.actor, filters.action].filter(Boolean).length;
  const [auditEntries, recordTypes, actors, actions] = await Promise.all([
    listAuditEntries(filters, 200),
    listAuditRecordTypes(),
    listAuditActors(),
    listAuditActions()
  ]);
  return (
    <div className="usa-page usa-page--wide">
      <div className="usa-page-header">
        <div>
          <h1 className="usa-page-title">Audit Log</h1>
          <p className="usa-page-subtitle">
            Queryable custody history and compliance evidence for asset lifecycle actions.
          </p>
        </div>
        <div className="page-actions">
          <a className="usa-button usa-button--outline" href={buildHref("/api/audit/export", {}, { q: filters.q, recordType: filters.recordType, actor: filters.actor, action: filters.action })} download>
            Export CSV{activeCount > 0 ? " (filtered)" : ""}
          </a>
          <button className="usa-button usa-button--primary" type="button">
            Create evidence packet
          </button>
        </div>
      </div>

      <div className="detail-grid audit-grid">
        <section className="detail-card" id="recent-audit-entries">
          <h2 className="section-title">Recent audit entries</h2>
          <FilterPanel activeCount={activeCount}>
            <form className="filter-bar" method="get" action="/audit">
              <label className="sr-only" htmlFor="audit-search">Search audit entries</label>
              <div className="filter-bar__search">
                <input id="audit-search" name="q" className="usa-input" type="search" placeholder="Search action, record, or actor" defaultValue={filters.q ?? ""} />
              </div>
              <label className="sr-only" htmlFor="audit-type">Record type</label>
              <select id="audit-type" name="recordType" className="usa-select" defaultValue={filters.recordType ?? ""}>
                <option value="">All record types</option>
                {recordTypes.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
              <label className="sr-only" htmlFor="audit-actor">Actor</label>
              <select id="audit-actor" name="actor" className="usa-select" defaultValue={filters.actor ?? ""}>
                <option value="">All actors</option>
                {actors.map((a) => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>
              <label className="sr-only" htmlFor="audit-action">Action</label>
              <select id="audit-action" name="action" className="usa-select" defaultValue={filters.action ?? ""}>
                <option value="">All actions</option>
                {actions.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <button className="usa-button usa-button--primary usa-button--sm" type="submit">Apply</button>
              {activeCount > 0 ? <Link className="usa-button usa-button--outline usa-button--sm" href="/audit">Clear</Link> : null}
            </form>
          </FilterPanel>
          <div className="table-wrap mt-2">
            <table className="usa-table">
              <thead>
                <tr>
                  <th scope="col">Entry</th>
                  <th scope="col">Timestamp</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Action</th>
                  <th scope="col">Record</th>
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {auditEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6}>{activeCount > 0 ? "No audit entries match your filters." : "No audit entries recorded yet."}</td>
                  </tr>
                ) : null}
                {auditEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="font-mono">{entry.recordHref ? <Link href={entry.recordHref}>{entry.id}</Link> : entry.id}</td>
                    <td>{entry.timestamp}</td>
                    <td>{entry.actorUserId ? <Link href={`/people/${entry.actorUserId}`}>{entry.actor}</Link> : entry.actor}</td>
                    <td>{entry.action}</td>
                    <td className="font-mono">{entry.recordHref ? <Link href={entry.recordHref}>{entry.record}</Link> : entry.record}</td>
                    <td>
                      <StatusTag tone={entry.result === "Review queue" ? "yellow" : "green"}>
                        {entry.result}
                      </StatusTag>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="detail-card" id="migration-controls">
          <h2 className="section-title">Production gate items</h2>
          <dl className="detail-list audit-gates">
            <dt>ATO path</dt>
            <dd>Inherit an existing authorization boundary where possible</dd>
            <dt>Tamper evidence</dt>
            <dd>Hash chaining or external append-only store is required</dd>
            <dt>Migration cutover</dt>
            <dd>Row counts, field samples, and validation exceptions must reconcile</dd>
            <dt>MuleSoft boundary</dt>
            <dd>Only integration path for HRIS</dd>
          </dl>
        </aside>
      </div>

      <section className="usa-card mt-3" id="role-access-model">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Role and access model</span>
          <StatusTag tone="blue">PostgreSQL enforced</StatusTag>
        </div>
        <div className="usa-card__body">
          <div className="table-wrap">
            <table className="usa-table">
              <thead>
                <tr>
                  <th scope="col">Role</th>
                  <th scope="col">Scope</th>
                  <th scope="col">Firearms records</th>
                </tr>
              </thead>
              <tbody>
                {roleMatrix.map((role) => (
                  <tr key={role.role}>
                    <td>{role.role}</td>
                    <td>{role.scope}</td>
                    <td>{role.firearmAccess}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
