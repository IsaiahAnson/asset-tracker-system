import type { ApprovalStage } from "@/lib/firearms";

// Visual stepper for a multi-stage approval (Requested -> Division Lead ->
// Internal Affairs -> Authorization). Pure
// presentational; takes pre-ordered stages from getFirearmApprovalWorkflow().
//
// Status mapping:
//   approved  -> green dot, checkmark, "Approved by X on Y"
//   denied    -> red dot, X mark, "Denied by X on Y"
//   pending   -> blue ring (current stage); the first 'pending' stage in
//                the array is treated as the active one, later pending
//                stages render as gray (not yet reached).
//   cancelled / escalated -> gray with the status label as caption.
export function ApprovalStepper({ stages }: { stages: ApprovalStage[] }) {
  if (stages.length === 0) {
    return (
      <p className="approval-stepper__empty">
        No multi-stage approval workflow recorded for this asset.
      </p>
    );
  }

  // First pending stage = the "current" one. Anything after the first pending
  // is "future" (gray).
  const firstPendingIndex = stages.findIndex((s) => s.status === "pending");

  return (
    <ol className="approval-stepper" aria-label="Approval workflow progress">
      {stages.map((stage, idx) => {
        const isCurrent = idx === firstPendingIndex;
        const isFuture = firstPendingIndex !== -1 && idx > firstPendingIndex;
        const variant =
          stage.status === "approved"
            ? "done"
            : stage.status === "denied"
              ? "denied"
              : isCurrent
                ? "current"
                : isFuture
                  ? "future"
                  : "pending";

        return (
          <li
            key={stage.id}
            className={`approval-stepper__step approval-stepper__step--${variant}`}
            aria-current={isCurrent ? "step" : undefined}
          >
            <div className="approval-stepper__dot" aria-hidden="true">
              {stage.status === "approved" ? "✓" : stage.status === "denied" ? "✗" : stage.stageIndex || idx + 1}
            </div>
            <div className="approval-stepper__caption">
              <div className="approval-stepper__name">{stage.stageName}</div>
              {stage.approver ? (
                <div className="approval-stepper__approver">
                  {stage.status === "approved"
                    ? `Approved by ${stage.approver}`
                    : stage.status === "denied"
                      ? `Denied by ${stage.approver}`
                      : `Assigned to ${stage.approver}`}
                </div>
              ) : null}
              {stage.decidedAt ? (
                <div className="approval-stepper__when font-mono">{stage.decidedAt}</div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
