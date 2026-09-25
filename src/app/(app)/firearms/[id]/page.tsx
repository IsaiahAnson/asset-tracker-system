import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusTag } from "@/components/StatusTag";
import { ApprovalStepper } from "@/components/ApprovalStepper";
import { VerificationChecklist } from "@/components/VerificationChecklist";
import { SubmitButton } from "@/components/SubmitButton";
import { PrintRecordButton } from "@/components/PrintRecordButton";
import { statusLabel, statusTone } from "@/lib/assets";
import {
  actingUserHasFirearmAccess,
  actingUserCanCoordinateFirearms
} from "@/lib/authz";
import {
  getFirearmDetail,
  listFirearmVerifications,
  getFirearmApprovalWorkflow,
  listFirearmCustodyEvents,
  listEntities,
  evaluateClearance
} from "@/lib/firearms";
import { listAssetAuditEntries, custodyEventLabel } from "@/lib/asset-detail";
import { surrenderToEntityAction } from "../actions";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "verification", label: "Verification" },
  { key: "approval", label: "Approval workflow" },
  { key: "custody", label: "Custody history" },
  { key: "audit", label: "Audit trail" }
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function FirearmDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const hasAccess = await actingUserHasFirearmAccess();
  if (!hasAccess) {
    return (
      <div className="usa-page firearms-page">
        <div className="usa-page-header firearms-page__header">
          <div>
            <h1 className="usa-page-title">Firearm record</h1>
            <p className="usa-page-subtitle">Access-flag gated.</p>
          </div>
        </div>
        <section className="usa-alert usa-alert--warning">
          <strong>Access required.</strong> Firearms records are gated by the firearms access
          flag on your account. Switch to a user who has the flag (e.g., Casey Morgan) to view
          this record.
        </section>
      </div>
    );
  }

  const { id } = await params;
  const detail = await getFirearmDetail(id);
  if (!detail) {
    notFound();
  }

  const requestedTab = (await searchParams).tab as TabKey | undefined;
  const tab: TabKey = TABS.some((t) => t.key === requestedTab)
    ? (requestedTab as TabKey)
    : "overview";

  const [verifications, approvalWorkflow, custodyEvents, auditEntries, entities, canCoordinate] =
    await Promise.all([
      tab === "overview" || tab === "verification"
        ? listFirearmVerifications(detail.id)
        : Promise.resolve([]),
      tab === "overview" || tab === "approval"
        ? getFirearmApprovalWorkflow(detail.assetTag)
        : Promise.resolve(null),
      tab === "custody" ? listFirearmCustodyEvents(detail.id) : Promise.resolve([]),
      tab === "audit" ? listAssetAuditEntries(detail.assetTag) : Promise.resolve([]),
      listEntities(),
      actingUserCanCoordinateFirearms()
    ]);

  const clearance = evaluateClearance(verifications);
  const isBodyArmor = detail.category === "body_armor";
  const backHref = "/firearms";
  const backLabel = isBodyArmor ? "BACK TO FIREARMS & ARMOR" : "BACK TO FIREARMS";

  // Surrender is only meaningful when the asset is currently assigned to a
  // real person (not already parked at a warehouse, and not retired).
  const canSurrender =
    canCoordinate &&
    detail.status === "assigned" &&
    detail.custodianId !== null &&
    !detail.custodianIsEntity;

  return (
    <div className="usa-page usa-page--wide firearms-page">
      <div className="usa-page-header firearms-page__header">
        <div>
          <Link className="record-id" href={backHref}>
            {backLabel}
          </Link>
          <h1 className="usa-page-title">{detail.assetTag}</h1>
          <p className="usa-page-subtitle">
            {[detail.manufacturer, detail.model].filter(Boolean).join(" ") || detail.categoryLabel}
          </p>
        </div>
        <div className="page-actions">
          <StatusTag tone="red">High sensitivity</StatusTag>
          <StatusTag tone={statusTone(detail.status)}>{statusLabel(detail.status)}</StatusTag>
          <StatusTag tone={clearance.cleared ? "green" : "yellow"}>
            {clearance.cleared ? "Cleared" : "Action required"}
          </StatusTag>
          <PrintRecordButton />
        </div>
      </div>

      <nav className="detail-tabs" aria-label="Firearm detail sections">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "overview" ? `/firearms/${detail.id}` : `/firearms/${detail.id}?tab=${t.key}`}
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
              <span className="usa-card__header-title">Record summary</span>
              <span className="record-id font-mono">
                {isBodyArmor ? "BODY ARMOR" : "FIREARM"}
              </span>
            </div>
            <div className="usa-card__body">
              <dl className="detail-grid">
                <div>
                  <dt>Asset tag</dt>
                  <dd className="font-mono">{detail.assetTag}</dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd>{detail.categoryLabel}</dd>
                </div>
                <div>
                  <dt>Manufacturer</dt>
                  <dd>{detail.manufacturer ?? "—"}</dd>
                </div>
                <div>
                  <dt>Model</dt>
                  <dd>{detail.model ?? "—"}</dd>
                </div>
                <div>
                  <dt>Serial number</dt>
                  <dd className="font-mono">{detail.serial ?? "—"}</dd>
                </div>
                <div>
                  <dt>Custodian</dt>
                  <dd>
                    {detail.custodian && detail.custodianId ? (
                      detail.custodianIsEntity ? (
                        <>
                          {detail.custodian}
                          <span className="entity-badge">Entity</span>
                        </>
                      ) : (
                        <Link href={`/people/${detail.custodianId}`}>{detail.custodian}</Link>
                      )
                    ) : (
                      "Unassigned"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Office</dt>
                  <dd>{detail.office ?? "—"}</dd>
                </div>
                <div>
                  <dt>Group</dt>
                  <dd>{detail.group ?? "—"}</dd>
                </div>
                <div>
                  <dt>Acquired</dt>
                  <dd className="font-mono">{detail.acquiredOn ?? "—"}</dd>
                </div>
              </dl>
              {detail.notes ? <p className="mt-3">{detail.notes}</p> : null}
            </div>
          </section>

          <section className="usa-card mt-3">
            <div className="usa-card__header">
              <span className="usa-card__header-title">Mandatory verification checklist</span>
              <Link
                className="usa-button usa-button--outline usa-button--sm"
                href={`/firearms/${detail.id}?tab=verification`}
              >
                Manage verifications
              </Link>
            </div>
            <div className="usa-card__body">
              <VerificationChecklist verifications={verifications} clearance={clearance} />
            </div>
          </section>

          {approvalWorkflow ? (
            <section className="usa-card mt-3">
              <div className="usa-card__header">
                <span className="usa-card__header-title">Approval workflow</span>
                <span className="record-id font-mono">{approvalWorkflow.workflowNumber}</span>
              </div>
              <div className="usa-card__body">
                <p className="mb-2">
                  {approvalWorkflow.subject ? (
                    <>
                      Issuance request for <strong>{approvalWorkflow.subject}</strong>
                      {approvalWorkflow.owner ? (
                        <>
                          {" · owner "}
                          <strong>{approvalWorkflow.owner}</strong>
                        </>
                      ) : null}
                      {". Current stage: "}
                      <strong>{approvalWorkflow.currentStage}</strong>.
                    </>
                  ) : (
                    <>
                      Current stage: <strong>{approvalWorkflow.currentStage}</strong>.
                    </>
                  )}
                </p>
                <ApprovalStepper stages={approvalWorkflow.stages} />
              </div>
            </section>
          ) : null}

          {canSurrender ? (
            <section className="usa-card mt-3">
              <div className="usa-card__header">
                <span className="usa-card__header-title">Surrender to entity</span>
              </div>
              <div className="usa-card__body">
                <p>
                  Transfer this {isBodyArmor ? "armor" : "firearm"} from{" "}
                  <strong>{detail.custodian}</strong> to a warehouse / armory entity. Custody is
                  recorded as a transfer event with the surrender flag set in audit metadata.
                </p>
                <form action={surrenderToEntityAction} className="surrender-form mt-2">
                  <input type="hidden" name="assetTag" value={detail.assetTag} />
                  <label>
                    Destination entity
                    <select name="toEntityId" required>
                      <option value="">Select…</option>
                      {entities.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Reason (optional)
                    <input
                      type="text"
                      name="reason"
                      maxLength={140}
                      placeholder="e.g. Agent departure, return to vault"
                    />
                  </label>
                  <SubmitButton
                    className="usa-button"
                    pendingText="Surrendering…"
                    confirm={`Surrender ${detail.assetTag} to selected entity? This logs an immutable custody event.`}
                    confirmLabel="Surrender"
                  >
                    Surrender
                  </SubmitButton>
                </form>
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {tab === "verification" ? (
        <section className="usa-card">
          <div className="usa-card__header">
            <span className="usa-card__header-title">Mandatory verification checklist</span>
            <StatusTag tone={clearance.cleared ? "green" : "yellow"}>
              {clearance.cleared ? "Cleared for issuance" : "Issuance blocked"}
            </StatusTag>
          </div>
          <div className="usa-card__body">
            <VerificationChecklist verifications={verifications} clearance={clearance} />
            <p className="mt-3 text-base-dark">
              {canCoordinate
                ? "Inline edit of verification records is a follow-on (target this week). For now, coordinators record verifications through the audit-backed server action."
                : "Only firearms coordinators (national or division) can record verification updates."}
            </p>
          </div>
        </section>
      ) : null}

      {tab === "approval" ? (
        <section className="usa-card">
          <div className="usa-card__header">
            <span className="usa-card__header-title">Approval workflow</span>
            {approvalWorkflow ? (
              <span className="record-id font-mono">{approvalWorkflow.workflowNumber}</span>
            ) : null}
          </div>
          <div className="usa-card__body">
            {approvalWorkflow ? (
              <>
                <dl className="detail-grid">
                  <div>
                    <dt>Workflow</dt>
                    <dd className="font-mono">{approvalWorkflow.workflowNumber}</dd>
                  </div>
                  <div>
                    <dt>Subject</dt>
                    <dd>{approvalWorkflow.subject ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Owner</dt>
                    <dd>{approvalWorkflow.owner ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Current stage</dt>
                    <dd>{approvalWorkflow.currentStage}</dd>
                  </div>
                </dl>
                <div className="mt-3">
                  <ApprovalStepper stages={approvalWorkflow.stages} />
                </div>
                <table className="usa-table mt-3">
                  <thead>
                    <tr>
                      <th scope="col">Stage</th>
                      <th scope="col">Approval</th>
                      <th scope="col">Approver</th>
                      <th scope="col">Status</th>
                      <th scope="col">Decided</th>
                      <th scope="col">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvalWorkflow.stages.map((stage) => (
                      <tr key={stage.id}>
                        <td>
                          <strong>{stage.stageIndex || "—"}.</strong> {stage.stageName}
                        </td>
                        <td className="font-mono">{stage.approvalNumber}</td>
                        <td>{stage.approver ?? "—"}</td>
                        <td>
                          <StatusTag
                            tone={
                              stage.status === "approved"
                                ? "green"
                                : stage.status === "denied"
                                  ? "red"
                                  : stage.status === "pending"
                                    ? "yellow"
                                    : "gray"
                            }
                          >
                            {stage.status}
                          </StatusTag>
                        </td>
                        <td className="font-mono">{stage.decidedAt ?? "—"}</td>
                        <td>{stage.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <p>No multi-stage approval workflow recorded for this record.</p>
            )}
          </div>
        </section>
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
                    <th scope="col">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {custodyEvents.length === 0 ? (
                    <tr>
                      <td colSpan={6}>No custody events recorded.</td>
                    </tr>
                  ) : (
                    custodyEvents.map((e) => (
                      <tr key={e.id}>
                        <td>{custodyEventLabel(e.eventType)}</td>
                        <td>
                          {e.from && e.fromId ? (
                            e.fromIsEntity ? (
                              <>
                                {e.from}
                                <span className="entity-badge">Entity</span>
                              </>
                            ) : (
                              <Link href={`/people/${e.fromId}`}>{e.from}</Link>
                            )
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {e.to && e.toId ? (
                            e.toIsEntity ? (
                              <>
                                {e.to}
                                <span className="entity-badge">Entity</span>
                              </>
                            ) : (
                              <Link href={`/people/${e.toId}`}>{e.to}</Link>
                            )
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {e.performedById ? (
                            <Link href={`/people/${e.performedById}`}>{e.performedBy}</Link>
                          ) : (
                            e.performedBy
                          )}
                        </td>
                        <td>{e.eventAt}</td>
                        <td>{e.notes ?? "—"}</td>
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
                      <td colSpan={5}>No audit entries for this record.</td>
                    </tr>
                  ) : (
                    auditEntries.map((a) => (
                      <tr key={a.id}>
                        <td className="font-mono">{a.id}</td>
                        <td>{a.action}</td>
                        <td>
                          {a.actorUserId ? (
                            <Link href={`/people/${a.actorUserId}`}>{a.actor}</Link>
                          ) : (
                            a.actor
                          )}
                        </td>
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
