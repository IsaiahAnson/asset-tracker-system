import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { PrintRecordButton } from "@/components/PrintRecordButton";
import { statusLabel, statusTone } from "@/lib/assets";
import { canActingUserWrite } from "@/lib/authz";
import {
  getAssetDetail,
  listAssetCustodyEvents,
  listAssetComponents,
  listAssetAuditEntries,
  custodyEventLabel
} from "@/lib/asset-detail";
import { getAssetCustomValuesForDisplay, formatCustomValue, groupBySection } from "@/lib/custom-fields";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "custody", label: "Custody history" },
  { key: "components", label: "Components" },
  { key: "audit", label: "Audit trail" }
] as const;

export default async function AssetDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const asset = await getAssetDetail(id);

  if (!asset) {
    return (
      <div className="usa-page">
        <div className="usa-page-header">
          <h1 className="usa-page-title">Asset not found</h1>
        </div>
        <Link className="usa-button usa-button--outline" href="/assets">
          Back to assets
        </Link>
      </div>
    );
  }

  const requestedTab = (await searchParams).tab ?? "overview";
  const tab = TABS.some((t) => t.key === requestedTab) ? requestedTab : "overview";

  const [custodyEvents, components, auditEntries, canWrite, customValues] = await Promise.all([
    tab === "custody" ? listAssetCustodyEvents(id) : Promise.resolve([]),
    tab === "components" || tab === "overview" ? listAssetComponents(id) : Promise.resolve([]),
    tab === "audit" ? listAssetAuditEntries(asset.assetTag) : Promise.resolve([]),
    canActingUserWrite(),
    tab === "overview" ? getAssetCustomValuesForDisplay(id) : Promise.resolve([])
  ]);

  return (
    <div className="usa-page">
      <div className="usa-page-header">
        <div>
          <Link className="record-id" href="/assets">
            BACK TO ASSETS
          </Link>
          <h1 className="usa-page-title">{asset.assetTag}</h1>
          <p className="usa-page-subtitle">{asset.model}</p>
        </div>
        <div className="page-actions">
          <StatusTag tone={statusTone(asset.status)}>{statusLabel(asset.status)}</StatusTag>
          {asset.highSensitivity ? <StatusTag tone="red">High sensitivity</StatusTag> : null}
          <PrintRecordButton />
          {canWrite ? (
            <Link className="usa-button usa-button--outline" href={`/assets/${asset.id}/edit`}>
              Edit
            </Link>
          ) : null}
        </div>
      </div>

      <nav className="detail-tabs" aria-label="Asset detail sections">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "overview" ? `/assets/${asset.id}` : `/assets/${asset.id}?tab=${t.key}`}
            className={`detail-tabs__tab${tab === t.key ? " detail-tabs__tab--active" : ""}`}
            aria-current={tab === t.key ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "overview" ? (
        <>
        <section className="usa-card">
          <div className="usa-card__header">
            <span className="usa-card__header-title">Overview</span>
          </div>
          <div className="usa-card__body">
            <dl className="detail-grid">
              <div>
                <dt>Asset tag</dt>
                <dd className="font-mono">{asset.assetTag}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{asset.category ?? "—"}</dd>
              </div>
              <div>
                <dt>Manufacturer</dt>
                <dd>{asset.manufacturer ?? "—"}</dd>
              </div>
              <div>
                <dt>Serial number</dt>
                <dd className="font-mono">{asset.serial ?? "—"}</dd>
              </div>
              <div>
                <dt>Custodian</dt>
                <dd>
                  {asset.custodian && asset.custodianId ? (
                    <Link href={`/people/${asset.custodianId}`}>{asset.custodian}</Link>
                  ) : (
                    "Unassigned"
                  )}
                </dd>
              </div>
              <div>
                <dt>Office</dt>
                <dd>
                  {asset.office ? (
                    <Link href={`/assets?office=${encodeURIComponent(asset.office)}`}>{asset.office}</Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt>Group</dt>
                <dd>{asset.group ?? "—"}</dd>
              </div>
              <div>
                <dt>Expected return</dt>
                <dd className="font-mono">{asset.expectedReturn ?? "—"}</dd>
              </div>
              <div>
                <dt>Acquired</dt>
                <dd className="font-mono">{asset.acquiredOn ?? "—"}</dd>
              </div>
              <div>
                <dt>Recorded</dt>
                <dd className="font-mono">{asset.createdAt}</dd>
              </div>
              {asset.disposedOn ? (
                <div>
                  <dt>Disposed</dt>
                  <dd className="font-mono">{asset.disposedOn}</dd>
                </div>
              ) : null}
              <div>
                <dt>Components installed</dt>
                <dd>{components.length}</dd>
              </div>
            </dl>
            {asset.notes ? <p className="mt-3">{asset.notes}</p> : null}
          </div>
        </section>

        {customValues.length > 0 ? (
          <section className="usa-card mt-3">
            <div className="usa-card__header">
              <span className="usa-card__header-title">Custom fields</span>
              <span className="record-id">ADMIN DEFINED</span>
            </div>
            <div className="usa-card__body">
              {groupBySection(customValues).map((group) => (
                <div className="custom-fields-group" key={group.section}>
                  <p className="custom-fields-group__heading">{group.section}</p>
                  <dl className="detail-grid">
                    {group.items.map(({ definition, value }) => (
                      <div key={definition.id}>
                        <dt>{definition.label}</dt>
                        <dd>{formatCustomValue(definition, value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        </>
      ) : null}

      {tab === "custody" ? (
        <section className="usa-card">
          <div className="usa-card__header">
            <span className="usa-card__header-title">Custody history</span>
          </div>
          <div className="usa-card__body">
            <div className="table-wrap">
              <table className="usa-table">
                <thead>
                  <tr>
                    <th scope="col">Event</th>
                    <th scope="col">From</th>
                    <th scope="col">To</th>
                    <th scope="col">Performed by</th>
                    <th scope="col">When</th>
                  </tr>
                </thead>
                <tbody>
                  {custodyEvents.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No custody events recorded.</td>
                    </tr>
                  ) : (
                    custodyEvents.map((e) => (
                      <tr key={e.id}>
                        <td>{custodyEventLabel(e.eventType)}</td>
                        <td>{e.fromUser && e.fromUserId ? <Link href={`/people/${e.fromUserId}`}>{e.fromUser}</Link> : (e.fromUser ?? "—")}</td>
                        <td>{e.toUser && e.toUserId ? <Link href={`/people/${e.toUserId}`}>{e.toUser}</Link> : (e.toUser ?? "—")}</td>
                        <td>{e.performedById ? <Link href={`/people/${e.performedById}`}>{e.performedBy}</Link> : e.performedBy}</td>
                        <td>{e.eventAt}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "components" ? (
        <section className="usa-card">
          <div className="usa-card__header">
            <span className="usa-card__header-title">Installed components</span>
          </div>
          <div className="usa-card__body">
            <div className="table-wrap">
              <table className="usa-table">
                <thead>
                  <tr>
                    <th scope="col">Component</th>
                    <th scope="col">Qty</th>
                    <th scope="col">Installed</th>
                  </tr>
                </thead>
                <tbody>
                  {components.length === 0 ? (
                    <tr>
                      <td colSpan={3}>No components installed in this asset.</td>
                    </tr>
                  ) : (
                    components.map((c) => (
                      <tr key={c.assignmentId}>
                        <td>
                          <Link href={`/components/${c.componentId}`}>{c.name}</Link>
                        </td>
                        <td className="font-mono">{c.qty}</td>
                        <td className="font-mono">{c.assignedOn}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "audit" ? (
        <section className="usa-card">
          <div className="usa-card__header">
            <span className="usa-card__header-title">Audit trail</span>
            <Link className="usa-button usa-button--outline usa-button--sm" href="/audit">
              Full audit log
            </Link>
          </div>
          <div className="usa-card__body">
            <div className="table-wrap">
              <table className="usa-table">
                <thead>
                  <tr>
                    <th scope="col">Entry</th>
                    <th scope="col">Action</th>
                    <th scope="col">Actor</th>
                    <th scope="col">When</th>
                    <th scope="col">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEntries.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No audit entries for this asset.</td>
                    </tr>
                  ) : (
                    auditEntries.map((a) => (
                      <tr key={a.id}>
                        <td className="font-mono">{a.id}</td>
                        <td>{a.action}</td>
                        <td>{a.actorUserId ? <Link href={`/people/${a.actorUserId}`}>{a.actor}</Link> : a.actor}</td>
                        <td>{a.timestamp}</td>
                        <td>
                          <StatusTag tone="green">{a.result}</StatusTag>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
