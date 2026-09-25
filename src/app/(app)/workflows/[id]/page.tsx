import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { WorkflowStepper } from "@/components/WorkflowStepper";
import { getWorkflowDetail } from "@/lib/workflows";

export const dynamic = "force-dynamic";

function statusTone(status: string): string {
  switch (status) {
    case "completed":
      return "green";
    case "ready":
      return "blue";
    case "in_review":
      return "cyan";
    case "at_risk":
      return "yellow";
    case "cancelled":
      return "red";
    default:
      return "gray";
  }
}

function approvalTone(status: string): string {
  switch (status) {
    case "approved":
      return "green";
    case "denied":
      return "red";
    case "escalated":
      return "red";
    case "pending":
      return "yellow";
    default:
      return "gray";
  }
}

export default async function WorkflowDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const wf = await getWorkflowDetail(id);

  if (!wf) {
    return (
      <div className="usa-page">
        <div className="usa-page-header">
          <h1 className="usa-page-title">Workflow not found</h1>
        </div>
        <Link className="usa-button usa-button--outline" href="/workflows">
          Back to workflows
        </Link>
      </div>
    );
  }

  return (
    <div className="usa-page usa-page--wide">
      <div className="usa-page-header">
        <div>
          <Link className="record-id" href="/workflows">
            BACK TO WORKFLOWS
          </Link>
          <h1 className="usa-page-title">{wf.typeLabel} workflow</h1>
          <p className="usa-page-subtitle font-mono">{wf.workflowNumber}</p>
        </div>
        <div className="page-actions">
          <StatusTag tone={statusTone(wf.status)}>{wf.statusLabel}</StatusTag>
        </div>
      </div>

      <section className="usa-card">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Progress</span>
          <span className="record-id">
            {wf.currentStep ? `Current: ${wf.currentStep}` : "All steps complete"}
          </span>
        </div>
        <div className="usa-card__body">
          <WorkflowStepper steps={wf.steps} />
          <p className="mt-3">
            {wf.currentStep ? (
              <>
                This workflow is at <strong>{wf.currentStep}</strong>.{" "}
                {wf.nextStep && wf.nextStep !== "Complete" ? (
                  <>
                    Next up: <strong>{wf.nextStep}</strong>.
                  </>
                ) : (
                  <>One step remains before completion.</>
                )}
              </>
            ) : (
              <>All steps are complete.</>
            )}
          </p>
        </div>
      </section>

      <section className="usa-card mt-3">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Details</span>
        </div>
        <div className="usa-card__body">
          <dl className="detail-grid">
            <div>
              <dt>Workflow</dt>
              <dd className="font-mono">{wf.workflowNumber}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{wf.typeLabel}</dd>
            </div>
            <div>
              <dt>Subject</dt>
              <dd>{wf.subject ?? "—"}</dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>{wf.owner ?? "—"}</dd>
            </div>
            <div>
              <dt>Office</dt>
              <dd>{wf.office ?? "—"}</dd>
            </div>
            <div>
              <dt>Stage</dt>
              <dd>{wf.stage}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{wf.statusLabel}</dd>
            </div>
            <div>
              <dt>Due</dt>
              <dd className="font-mono">{wf.dueOn ?? "—"}</dd>
            </div>
          </dl>
        </div>
      </section>

      {wf.approvals.length > 0 ? (
        <section className="usa-card mt-3">
          <div className="usa-card__header">
            <span className="usa-card__header-title">Approvals</span>
            <Link className="usa-button usa-button--outline usa-button--sm" href="/approvals">
              Approvals queue
            </Link>
          </div>
          <div className="usa-card__body">
            <div className="table-wrap">
              <table className="usa-table">
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
                  {wf.approvals.map((a) => (
                    <tr key={a.approvalNumber}>
                      <td>{a.stageName ?? "—"}</td>
                      <td className="font-mono">{a.approvalNumber}</td>
                      <td>{a.approver ?? "—"}</td>
                      <td>
                        <StatusTag tone={approvalTone(a.status)}>{a.status}</StatusTag>
                      </td>
                      <td className="font-mono">{a.decidedAt ?? "—"}</td>
                      <td>{a.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
