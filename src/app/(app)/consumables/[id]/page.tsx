import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { SubmitButton } from "@/components/SubmitButton";
import { getConsumableDetail, listConsumableIssues } from "@/lib/consumables";
import { listUsers } from "@/lib/assets";
import { canActingUserWrite } from "@/lib/authz";
import { PurchaseInfo } from "@/components/PurchaseInfo";
import { issueConsumableAction } from "../actions";

export default async function ConsumableDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const consumable = await getConsumableDetail(id);

  if (!consumable) {
    return (
      <div className="usa-page">
        <div className="usa-page-header">
          <h1 className="usa-page-title">Consumable not found</h1>
        </div>
        <Link className="usa-button usa-button--outline" href="/consumables">
          Back to consumables
        </Link>
      </div>
    );
  }

  const [issues, users, canWrite] = await Promise.all([listConsumableIssues(id), listUsers(), canActingUserWrite()]);

  return (
    <div className="usa-page">
      <div className="usa-page-header">
        <div>
          <Link className="record-id" href="/consumables">
            BACK TO CONSUMABLES
          </Link>
          <h1 className="usa-page-title">{consumable.name}</h1>
          <p className="usa-page-subtitle">
            {[consumable.manufacturer, consumable.itemNo].filter(Boolean).join(" ") ||
              "Consumable"}
          </p>
        </div>
        <div className="page-actions">
          {consumable.remaining > 0 ? (
            <StatusTag tone="green">{consumable.remaining} remaining</StatusTag>
          ) : (
            <StatusTag tone="red">Out of stock</StatusTag>
          )}
        </div>
      </div>

      <section className="stat-grid" aria-label="Consumable summary">
        <div className="stat-card">
          <div className="stat-label">Total units</div>
          <div className="stat-value">{consumable.qty}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Remaining</div>
          <div className="stat-value success">{consumable.remaining}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Issued</div>
          <div className="stat-value">{consumable.issued}</div>
        </div>
        <div className={`stat-card ${consumable.remaining <= consumable.minAmt ? "danger" : ""}`}>
          <div className="stat-label">Minimum</div>
          <div className="stat-value">{consumable.minAmt}</div>
        </div>
      </section>

      <PurchaseInfo supplier={consumable.supplier} orderNumber={consumable.orderNumber} purchaseCost={consumable.purchaseCost} purchaseDate={consumable.purchaseDate} />

      <section className="usa-card">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Issue to a user</span>
        </div>
        <div className="usa-card__body">
          {!canWrite ? (
            <p className="text-muted">Your role is Read-Only. Issuing consumables is disabled.</p>
          ) : (
          <form action={issueConsumableAction} className="filter-bar">
            <input type="hidden" name="consumableId" value={consumable.id} />
            <label className="sr-only" htmlFor="issue-user">
              User
            </label>
            <select
              id="issue-user"
              name="toUserId"
              className="usa-select usa-select--sm"
              defaultValue=""
              required
              disabled={consumable.remaining <= 0}
            >
              <option value="" disabled>
                Select user...
              </option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName}
                </option>
              ))}
            </select>
            <SubmitButton
              className="usa-button usa-button--primary usa-button--sm"
              pendingText="Issuing..."
              disabled={consumable.remaining <= 0}
            >
              Issue unit
            </SubmitButton>
          </form>
          )}
        </div>
      </section>

      <section className="usa-card mt-3">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Issuance history</span>
        </div>
        <div className="usa-card__body">
          <div className="table-wrap">
            <table className="usa-table">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Issued</th>
                </tr>
              </thead>
              <tbody>
                {issues.length === 0 ? (
                  <tr>
                    <td colSpan={2}>No units issued yet.</td>
                  </tr>
                ) : (
                  issues.map((issue, idx) => (
                    <tr key={`${issue.userName}-${idx}`}>
                      <td>{issue.userName}</td>
                      <td className="font-mono">{issue.issuedOn}</td>
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
