import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { SubmitButton } from "@/components/SubmitButton";
import {
  listApprovals,
  getApprovalStats,
  approvalTone,
  approvalStatusLabel,
  isActionable
} from "@/lib/approvals";
import { actingUserCanApprove } from "@/lib/authz";
import { decideApprovalAction } from "./actions";

export default async function ApprovalsPage() {
  const [approvals, stats, canDecide] = await Promise.all([
    listApprovals(),
    getApprovalStats(),
    actingUserCanApprove()
  ]);

  return (
    <div className="usa-page">
      <div className="usa-page-header">
        <div>
          <h1 className="usa-page-title">Approvals</h1>
          <p className="usa-page-subtitle">
            Supervisor and delegated approver queue for access requests, transfers, and dispositions.
          </p>
        </div>
        <div className="page-actions">
          <Link className="usa-button usa-button--primary" href="/workflows#workflow-queue">
            Route request
          </Link>
        </div>
      </div>

      <section className="mini-stat-row approval-summary" aria-label="Approval summary">
        <div className="mini-stat-card warn">
          <div className="stat-label">Pending</div>
          <div className="mini-stat-value">{stats.pending}</div>
          <div className="mini-stat-sublabel">Awaiting approver review</div>
        </div>
        <div className="mini-stat-card danger">
          <div className="stat-label">Escalated</div>
          <div className="mini-stat-value">{stats.escalated}</div>
          <div className="mini-stat-sublabel">Past policy threshold</div>
        </div>
        <div className="mini-stat-card success">
          <div className="stat-label">Decided today</div>
          <div className="mini-stat-value">{stats.decidedToday}</div>
          <div className="mini-stat-sublabel">All audit logged</div>
        </div>
      </section>

      <section className="usa-card" id="approval-queue">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Approval queue</span>
          <StatusTag tone="yellow">Action required</StatusTag>
        </div>
        <div className="usa-card__body">
          <div className="table-wrap">
            <table className="usa-table">
              <thead>
                <tr>
                  <th scope="col">Approval ID</th>
                  <th scope="col">Request</th>
                  <th scope="col">Approver</th>
                  <th scope="col">Office</th>
                  <th scope="col">Type</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Status</th>
                  <th scope="col">Decision</th>
                </tr>
              </thead>
              <tbody>
                {approvals.length === 0 ? (
                  <tr>
                    <td colSpan={8}>No approvals in the queue.</td>
                  </tr>
                ) : (
                  approvals.map((approval) => (
                    <tr key={approval.id}>
                      <td className="font-mono">{approval.approvalNumber}</td>
                      <td>{approval.request}</td>
                      <td>{approval.approver}</td>
                      <td>{approval.office}</td>
                      <td>{approval.type}</td>
                      <td>{approval.submitted}</td>
                      <td>
                        <StatusTag tone={approvalTone(approval.status)}>
                          {approvalStatusLabel(approval.status)}
                        </StatusTag>
                      </td>
                      <td>
                        {isActionable(approval.status) ? (
                          canDecide ? (
                            <div className="decision-actions">
                              <form action={decideApprovalAction} className="row-actions__form">
                                <input type="hidden" name="id" value={approval.id} />
                                <input type="hidden" name="decision" value="approved" />
                                <SubmitButton
                                  className="usa-button usa-button--success usa-button--sm"
                                  pendingText="Approving..."
                                  confirm={`Approve ${approval.approvalNumber}? This is recorded in the audit log.`}
                                >
                                  Approve
                                </SubmitButton>
                              </form>
                              <form action={decideApprovalAction} className="row-actions__form">
                                <input type="hidden" name="id" value={approval.id} />
                                <input type="hidden" name="decision" value="denied" />
                                <SubmitButton
                                  className="usa-button usa-button--danger usa-button--sm"
                                  pendingText="Denying..."
                                  confirm={`Deny ${approval.approvalNumber}? This is recorded in the audit log.`}
                                >
                                  Deny
                                </SubmitButton>
                              </form>
                            </div>
                          ) : (
                            <span className="text-muted" title="Approving is limited to the Approver and Admin roles.">
                              Approver only
                            </span>
                          )
                        ) : (
                          <span className="text-muted">Decided</span>
                        )}
                      </td>
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
