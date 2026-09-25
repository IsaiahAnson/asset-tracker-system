import type { WorkflowStep } from "@/lib/workflows";

// Step-by-step path for a workflow, rendered as points on a line that react to
// each stage completing (done = filled check, current = highlighted, pending =
// hollow, denied = red). Reuses the .approval-stepper styles so it matches the
// sensitive-asset approval stepper used on the firearm detail page.
export function WorkflowStepper({ steps }: { steps: WorkflowStep[] }) {
  if (steps.length === 0) {
    return <p className="approval-stepper__empty">No steps recorded for this workflow.</p>;
  }
  return (
    <ol className="approval-stepper" aria-label="Workflow progress">
      {steps.map((step, idx) => (
        <li
          key={`${step.label}-${idx}`}
          className={`approval-stepper__step approval-stepper__step--${step.state}`}
          aria-current={step.state === "current" ? "step" : undefined}
        >
          <div className="approval-stepper__dot" aria-hidden="true">
            {step.state === "done" ? "✓" : step.state === "denied" ? "✗" : idx + 1}
          </div>
          <div className="approval-stepper__caption">
            <div className="approval-stepper__name">{step.label}</div>
            {step.caption ? <div className="approval-stepper__approver">{step.caption}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
