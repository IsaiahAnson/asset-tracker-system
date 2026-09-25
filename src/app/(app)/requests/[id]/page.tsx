import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { SubmitButton } from "@/components/SubmitButton";
import { getRequestDetail, listRequestActivity, requestTone } from "@/lib/requests";
import { canActingUserWrite } from "@/lib/authz";
import { decideRequestAction } from "../actions";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "activity", label: "Activity" }
] as const;

export default async function RequestDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const request = await getRequestDetail(id);

  if (!request) {
    return (
      <div className="usa-page">
        <div className="usa-page-header">
          <h1 className="usa-page-title">Request not found</h1>
        </div>
        <Link className="usa-button usa-button--outline" href="/requests">
          Back to requests
        </Link>
      </div>
    );
  }

  const requestedTab = (await searchParams).tab ?? "overview";
  const tab = TABS.some((t) => t.key === requestedTab) ? requestedTab : "overview";

  const [activity, canWrite] = await Promise.all([
    tab === "activity" ? listRequestActivity(request.requestNumber) : Promise.resolve([]),
    canActingUserWrite()
  ]);

  const statusLabel = request.status.charAt(0).toUpperCase() + request.status.slice(1);

  return (
    <div className="usa-page">
      <div className="usa-page-header">
        <div>
          <Link className="record-id" href="/requests">
            BACK TO REQUESTS
          </Link>
          <h1 className="usa-page-title">{request.requestNumber}</h1>
          <p className="usa-page-subtitle">{request.itemLabel}</p>
        </div>
        <div className="page-actions">
          <StatusTag tone={requestTone(request.status)}>{statusLabel}</StatusTag>
          {canWrite && request.status === "pending" ? (
            <>
              <form action={decideRequestAction} className="row-actions__form">
                <input type="hidden" name="id" value={request.id} />
                <input type="hidden" name="decision" value="approved" />
                <SubmitButton
                  className="usa-button usa-button--primary usa-button--sm"
                  pendingText="Approving..."
                  confirm={`Approve ${request.requestNumber}?`}
                >
                  Approve
                </SubmitButton>
              </form>
              <form action={decideRequestAction} className="row-actions__form">
                <input type="hidden" name="id" value={request.id} />
                <input type="hidden" name="decision" value="denied" />
                <SubmitButton
                  className="usa-button usa-button--outline usa-button--sm"
                  pendingText="Denying..."
                  confirm={`Deny ${request.requestNumber}? This decision is recorded.`}
                >
                  Deny
                </SubmitButton>
              </form>
            </>
          ) : null}
        </div>
      </div>

      <nav className="detail-tabs" aria-label="Request detail sections">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "overview" ? `/requests/${request.id}` : `/requests/${request.id}?tab=${t.key}`}
            className={`detail-tabs__tab${tab === t.key ? " detail-tabs__tab--active" : ""}`}
            aria-current={tab === t.key ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "overview" ? (
        <section className="usa-card">
          <div className="usa-card__header">
            <span className="usa-card__header-title">Overview</span>
          </div>
          <div className="usa-card__body">
            <dl className="detail-grid">
              <div>
                <dt>Request number</dt>
                <dd className="font-mono">{request.requestNumber}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{statusLabel}</dd>
              </div>
              <div>
                <dt>Requested by</dt>
                <dd>
                  {request.requesterId ? (
                    <Link href={`/people/${request.requesterId}`}>{request.requester}</Link>
                  ) : (
                    request.requester
                  )}
                </dd>
              </div>
              <div>
                <dt>Requester email</dt>
                <dd>{request.requesterEmail ?? "—"}</dd>
              </div>
              <div>
                <dt>Item requested</dt>
                <dd>{request.itemLabel}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{request.category ?? "—"}</dd>
              </div>
              <div>
                <dt>Submitted</dt>
                <dd className="font-mono">{request.createdOn}</dd>
              </div>
              <div>
                <dt>Decided</dt>
                <dd className="font-mono">{request.decidedOn ?? "—"}</dd>
              </div>
            </dl>
            {request.notes ? <p className="mt-3">{request.notes}</p> : null}
          </div>
        </section>
      ) : null}

      {tab === "activity" ? (
        <section className="usa-card">
          <div className="usa-card__header">
            <span className="usa-card__header-title">Activity</span>
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
                  {activity.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No recorded activity for this request.</td>
                    </tr>
                  ) : (
                    activity.map((a) => (
                      <tr key={a.id}>
                        <td className="font-mono">{a.id}</td>
                        <td>{a.action}</td>
                        <td>{a.actor}</td>
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
