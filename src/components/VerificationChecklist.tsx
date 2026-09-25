import { StatusTag } from "@/components/StatusTag";
import {
  MANDATORY_CHECKS,
  verificationLabel,
  type FirearmVerification,
  type ClearanceState
} from "@/lib/firearms";

// Mandatory Verification Checklist. Renders one row per mandatory check (NCIC, armor inspection,
// deployment justification) and any additional optional checks the asset
// happens to have. Shows the clearance gate at the top so the demo can call
// out "this firearm is cleared / blocked from issuance" in a single line.

const STATUS_TONES: Record<string, "green" | "yellow" | "red" | "gray"> = {
  passed: "green",
  pending: "yellow",
  failed: "red",
  expired: "red",
  missing: "gray"
};

const STATUS_LABELS: Record<string, string> = {
  passed: "Passed",
  pending: "Pending",
  failed: "Failed",
  expired: "Expired",
  missing: "Not recorded"
};

export function VerificationChecklist({
  verifications,
  clearance
}: {
  verifications: FirearmVerification[];
  clearance: ClearanceState;
}) {
  // Lay out mandatory checks in their canonical order first (filling in
  // missing ones with a "Not recorded" placeholder), then append any
  // additional optional checks the asset has.
  const byType = new Map(verifications.map((v) => [v.checkType, v]));
  const mandatoryRows = MANDATORY_CHECKS.map((c) => {
    const v = byType.get(c.code);
    if (v) return { kind: "real" as const, value: v };
    return {
      kind: "missing" as const,
      label: c.label,
      checkType: c.code
    };
  });
  const optionalRows = verifications.filter(
    (v) => !MANDATORY_CHECKS.some((m) => m.code === v.checkType)
  );

  return (
    <div className="verification-checklist">
      <div
        className={`verification-checklist__banner verification-checklist__banner--${
          clearance.cleared ? "cleared" : "blocked"
        }`}
        role="status"
      >
        <span className="verification-checklist__banner-icon" aria-hidden="true">
          {clearance.cleared ? "✓" : "⚠"}
        </span>
        <span>
          {clearance.cleared
            ? "All mandatory checks passed. Cleared for issuance."
            : "Issuance blocked: one or more mandatory checks are missing, pending, or expired."}
        </span>
      </div>

      <ul className="verification-checklist__list">
        {mandatoryRows.map((row) =>
          row.kind === "real" ? (
            <VerificationRow key={row.value.id} verification={row.value} mandatory />
          ) : (
            <MissingRow key={`missing-${row.checkType}`} label={row.label} />
          )
        )}
        {optionalRows.map((v) => (
          <VerificationRow key={v.id} verification={v} mandatory={false} />
        ))}
      </ul>
    </div>
  );
}

function VerificationRow({
  verification,
  mandatory
}: {
  verification: FirearmVerification;
  mandatory: boolean;
}) {
  return (
    <li className={`verification-checklist__item verification-checklist__item--${verification.status}`}>
      <div className="verification-checklist__row-main">
        <div className="verification-checklist__icon" aria-hidden="true">
          {verification.status === "passed" ? "✓" : verification.status === "pending" ? "⌛" : "✗"}
        </div>
        <div className="verification-checklist__row-text">
          <div className="verification-checklist__label">
            {verification.label}
            {mandatory ? null : (
              <span className="verification-checklist__optional" title="Optional check">
                {" "}
                · optional
              </span>
            )}
          </div>
          <div className="verification-checklist__meta">
            <StatusTag tone={STATUS_TONES[verification.status] ?? "gray"}>
              {STATUS_LABELS[verification.status] ?? verification.status}
            </StatusTag>
            {verification.expiringSoon ? (
              <StatusTag tone="yellow" title="Expires within 90 days">
                Expiring soon
              </StatusTag>
            ) : null}
            {verification.verifiedBy ? (
              <span className="verification-checklist__verified-by">
                Verified by {verification.verifiedBy}
                {verification.verifiedAt ? ` · ${verification.verifiedAt}` : null}
              </span>
            ) : null}
            {verification.expiresOn ? (
              <span className="verification-checklist__expires font-mono">
                Expires {verification.expiresOn}
              </span>
            ) : null}
          </div>
          {verification.notes ? (
            <div className="verification-checklist__notes">{verification.notes}</div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function MissingRow({ label }: { label: string }) {
  return (
    <li className="verification-checklist__item verification-checklist__item--missing">
      <div className="verification-checklist__row-main">
        <div className="verification-checklist__icon" aria-hidden="true">
          ○
        </div>
        <div className="verification-checklist__row-text">
          <div className="verification-checklist__label">{label}</div>
          <div className="verification-checklist__meta">
            <StatusTag tone="gray">{STATUS_LABELS.missing}</StatusTag>
            <span className="verification-checklist__verified-by">
              No verification on file. Mandatory before issuance.
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}

// Convenience re-export so the firearm detail page can import labels from
// a single component module instead of reaching into the lib for them.
export { verificationLabel };
