import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { statusLabel, statusTone } from "@/lib/assets";
import { listFirearms, listBodyArmor, type FirearmRow } from "@/lib/firearms";
import {
  actingUserHasFirearmAccess,
  actingUserCanCoordinateFirearms
} from "@/lib/authz";

export default async function FirearmsPage() {
  const hasAccess = await actingUserHasFirearmAccess();

  if (!hasAccess) {
    return (
      <div className="usa-page firearms-page">
        <div className="usa-page-header firearms-page__header">
          <div>
            <h1 className="usa-page-title">Firearms &amp; Armor</h1>
            <p className="usa-page-subtitle">High-sensitivity records, access-flag gated.</p>
          </div>
        </div>
        <section className="usa-alert usa-alert--warning">
          <strong>Access required.</strong> Firearms and body armor records are query-filtered by
          the firearms access flag on your account. Your current account does not carry the
          flag, so this inventory is not visible. Switch to a user who has the flag (e.g.,
          Casey Morgan in the dev login picker) to view the list. In production this gate is
          enforced at the PostgreSQL query layer in addition to the page.
        </section>
      </div>
    );
  }

  const [firearms, armor, canCoordinate] = await Promise.all([
    listFirearms(),
    listBodyArmor(),
    actingUserCanCoordinateFirearms()
  ]);

  return (
    <div className="usa-page usa-page--wide firearms-page">
      <div className="usa-page-header firearms-page__header">
        <div>
          <h1 className="usa-page-title">Firearms &amp; Armor</h1>
          <p className="usa-page-subtitle">
            High-sensitivity inventory, gated by the firearms access flag and the firearms-
            coordinator role (national or division) for mutations.
          </p>
        </div>
        <div className="page-actions">
          <StatusTag tone="red">High sensitivity</StatusTag>
          {canCoordinate ? (
            <StatusTag tone="green">Coordinator</StatusTag>
          ) : (
            <StatusTag tone="gray">Read-only on this page</StatusTag>
          )}
        </div>
      </div>

      <section className="usa-alert usa-alert--info mt-2">
        <strong>Verification gate.</strong> Every firearm record carries a mandatory checklist
        (NCIC background, bi-annual armor inspection, deployment justification). Issuance to
        an agent is blocked until all three are passed. Click into any record to see the
        verification state and approval-workflow journey.
      </section>

      <InventorySection
        id="firearms-inventory"
        title="Firearms inventory"
        emptyMessage="No firearms on inventory."
        rows={firearms}
        showSurrenderHint={true}
      />

      <InventorySection
        id="armor-inventory"
        title="Body armor inventory"
        emptyMessage="No body armor on inventory."
        rows={armor}
        showSurrenderHint={false}
      />
    </div>
  );
}

function InventorySection({
  id,
  title,
  emptyMessage,
  rows,
  showSurrenderHint
}: {
  id: string;
  title: string;
  emptyMessage: string;
  rows: FirearmRow[];
  showSurrenderHint: boolean;
}) {
  return (
    <section className="usa-card mt-3" id={id}>
      <div className="usa-card__header">
        <span className="usa-card__header-title">{title}</span>
        <StatusTag tone="blue">{`${rows.length} on inventory`}</StatusTag>
      </div>
      <div className="usa-card__body">
        {showSurrenderHint ? (
          <p className="text-base-dark mb-2">
            Surrendered firearms return to a warehouse / armory entity (e.g.{" "}
            <em>Operations Division Warehouse</em>) rather than another person. Entity
            assignees are flagged with an <span className="entity-badge">Entity</span> badge.
          </p>
        ) : null}
        <div className="table-wrap">
          <table className="usa-table">
            <thead>
              <tr>
                <th scope="col">Asset ID</th>
                <th scope="col">Make</th>
                <th scope="col">Model</th>
                <th scope="col">Serial</th>
                <th scope="col">Custodian</th>
                <th scope="col">Office</th>
                <th scope="col">Status</th>
                <th scope="col">Verifications</th>
                <th scope="col">Acquired</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9}>{emptyMessage}</td>
                </tr>
              ) : (
                rows.map((f) => (
                  <tr key={f.id}>
                    <td className="font-mono">
                      <Link href={`/firearms/${f.id}`}>{f.assetTag}</Link>
                    </td>
                    <td>{f.make}</td>
                    <td>{f.model}</td>
                    <td className="font-mono">{f.serialNumber ?? "—"}</td>
                    <td>
                      {f.custodian === "Unassigned" ? (
                        f.custodian
                      ) : (
                        <>
                          {f.custodian}
                          {f.custodianIsEntity ? (
                            <span className="entity-badge">Entity</span>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td>{f.office ?? "—"}</td>
                    <td>
                      <StatusTag tone={statusTone(f.status)}>{statusLabel(f.status)}</StatusTag>
                    </td>
                    <td>
                      <VerificationSummary v={f.verifications} />
                    </td>
                    <td className="font-mono">{f.acquiredOn ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function VerificationSummary({
  v
}: {
  v: { passed: number; pending: number; failed: number; expired: number; total: number };
}) {
  if (v.total === 0) {
    return <span className="verification-summary verification-summary--block">0/0</span>;
  }
  const blocked = v.failed + v.expired;
  const tone =
    blocked > 0
      ? "verification-summary--block"
      : v.pending > 0
        ? "verification-summary--warn"
        : "verification-summary--ok";
  const indicator = blocked > 0 ? "✗" : v.pending > 0 ? "⌛" : "✓";
  const detailBits: string[] = [];
  if (v.pending) detailBits.push(`${v.pending} pending`);
  if (v.expired) detailBits.push(`${v.expired} expired`);
  if (v.failed) detailBits.push(`${v.failed} failed`);
  return (
    <span className={`verification-summary ${tone}`} title={detailBits.join(", ") || "All passed"}>
      {indicator} {v.passed}/{v.total}
    </span>
  );
}
