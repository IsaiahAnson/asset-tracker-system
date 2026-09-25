import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { SubmitButton } from "@/components/SubmitButton";
import { listRequests, getRequestStats, requestTone } from "@/lib/requests";
import { canActingUserWrite } from "@/lib/authz";
import { decideRequestAction } from "./actions";

export default async function RequestsPage() {
  const [requests, stats, canWrite] = await Promise.all([
    listRequests(),
    getRequestStats(),
    canActingUserWrite()
  ]);

  return (
    <div className="usa-page">
      <div className="usa-page-header">
        <div>
          <h1 className="usa-page-title">Asset requests</h1>
          <p className="usa-page-subtitle">
            Queue of personnel requests for assets and equipment, with decisions.
          </p>
        </div>
      </div>

      <section className="stat-grid" aria-label="Request summary">
        <div className="stat-card">
          <div className="stat-label">Requests</div>
          <div className="stat-value">{stats.total.toLocaleString("en-US")}</div>
        </div>
        <div className="stat-card warn">
          <div className="stat-label">Pending</div>
          <div className="stat-value warn">{stats.pending.toLocaleString("en-US")}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Approved</div>
          <div className="stat-value success">{stats.approved.toLocaleString("en-US")}</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-label">Denied</div>
          <div className="stat-value danger">{stats.denied.toLocaleString("en-US")}</div>
        </div>
      </section>

      <section className="usa-card">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Request queue</span>
        </div>
        <div className="usa-card__body">
          <div className="table-wrap">
            <table className="usa-table">
              <thead>
                <tr>
                  <th scope="col">Request</th>
                  <th scope="col">Requester</th>
                  <th scope="col">Item</th>
                  <th scope="col">Category</th>
                  <th scope="col">Status</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No requests yet.</td>
                  </tr>
                ) : (
                  requests.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link className="record-title" href={`/requests/${r.id}`}>{r.requestNumber}</Link>
                        <span className="record-id">{r.createdOn}</span>
                      </td>
                      <td>{r.requester}</td>
                      <td>{r.itemLabel}</td>
                      <td>{r.category ?? "—"}</td>
                      <td>
                        <StatusTag tone={requestTone(r.status)}>
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </StatusTag>
                      </td>
                      <td>
                        {canWrite && r.status === "pending" ? (
                          <div className="row-actions">
                            <form action={decideRequestAction} className="row-actions__form">
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="decision" value="approved" />
                              <SubmitButton
                                className="usa-button usa-button--primary usa-button--sm"
                                pendingText="Approving..."
                                confirm={`Approve ${r.requestNumber}?`}
                              >
                                Approve
                              </SubmitButton>
                            </form>
                            <form action={decideRequestAction} className="row-actions__form">
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="decision" value="denied" />
                              <SubmitButton
                                className="usa-button usa-button--outline usa-button--sm"
                                pendingText="Denying..."
                                confirm={`Deny ${r.requestNumber}? This decision is recorded.`}
                              >
                                Deny
                              </SubmitButton>
                            </form>
                          </div>
                        ) : (
                          "—"
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
