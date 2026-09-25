import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { SubmitButton } from "@/components/SubmitButton";
import {
  getAccessoryDetail,
  listAccessoryHolders
} from "@/lib/accessories";
import { listUsers } from "@/lib/assets";
import { canActingUserWrite } from "@/lib/authz";
import { PurchaseInfo } from "@/components/PurchaseInfo";
import { checkOutAccessoryAction, checkInAccessoryAction } from "../actions";

export default async function AccessoryDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const accessory = await getAccessoryDetail(id);

  if (!accessory) {
    return (
      <div className="usa-page">
        <div className="usa-page-header">
          <h1 className="usa-page-title">Accessory not found</h1>
        </div>
        <Link className="usa-button usa-button--outline" href="/accessories">
          Back to accessories
        </Link>
      </div>
    );
  }

  const [holders, users, canWrite] = await Promise.all([listAccessoryHolders(id), listUsers(), canActingUserWrite()]);

  return (
    <div className="usa-page">
      <div className="usa-page-header">
        <div>
          <Link className="record-id" href="/accessories">
            BACK TO ACCESSORIES
          </Link>
          <h1 className="usa-page-title">{accessory.name}</h1>
          <p className="usa-page-subtitle">
            {[accessory.manufacturer, accessory.modelNumber].filter(Boolean).join(" ") ||
              "Accessory"}
          </p>
        </div>
        <div className="page-actions">
          {accessory.available > 0 ? (
            <StatusTag tone="green">{accessory.available} available</StatusTag>
          ) : (
            <StatusTag tone="red">None available</StatusTag>
          )}
        </div>
      </div>

      <section className="stat-grid" aria-label="Accessory summary">
        <div className="stat-card">
          <div className="stat-label">Total units</div>
          <div className="stat-value">{accessory.qty}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Available</div>
          <div className="stat-value success">{accessory.available}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Checked out</div>
          <div className="stat-value">{accessory.checkedOut}</div>
        </div>
        <div className={`stat-card ${accessory.available <= accessory.minAmt ? "danger" : ""}`}>
          <div className="stat-label">Minimum</div>
          <div className="stat-value">{accessory.minAmt}</div>
        </div>
      </section>

      <PurchaseInfo supplier={accessory.supplier} orderNumber={accessory.orderNumber} purchaseCost={accessory.purchaseCost} purchaseDate={accessory.purchaseDate} />

      <section className="usa-card">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Check out to a user</span>
        </div>
        <div className="usa-card__body">
          {!canWrite ? (
            <p className="text-muted">Your role is Read-Only. Checking out accessories is disabled.</p>
          ) : (
          <form action={checkOutAccessoryAction} className="filter-bar">
            <input type="hidden" name="accessoryId" value={accessory.id} />
            <label className="sr-only" htmlFor="checkout-user">
              User
            </label>
            <select
              id="checkout-user"
              name="toUserId"
              className="usa-select usa-select--sm"
              defaultValue=""
              required
              disabled={accessory.available <= 0}
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
              pendingText="Checking out..."
              disabled={accessory.available <= 0}
            >
              Check out
            </SubmitButton>
          </form>
          )}
        </div>
      </section>

      <section className="usa-card mt-3">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Currently checked out</span>
        </div>
        <div className="usa-card__body">
          <div className="table-wrap">
            <table className="usa-table">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Checked out</th>
                  {canWrite ? <th scope="col">Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {holders.length === 0 ? (
                  <tr>
                    <td colSpan={canWrite ? 3 : 2}>No units currently checked out.</td>
                  </tr>
                ) : (
                  holders.map((holder) => (
                    <tr key={holder.checkoutId}>
                      <td>{holder.userName}</td>
                      <td className="font-mono">{holder.checkedOutOn}</td>
                      {canWrite ? (
                      <td>
                        <form action={checkInAccessoryAction} className="row-actions__form">
                          <input type="hidden" name="checkoutId" value={holder.checkoutId} />
                          <input type="hidden" name="accessoryId" value={accessory.id} />
                          <SubmitButton
                            className="usa-button usa-button--outline usa-button--sm"
                            pendingText="Checking in..."
                          >
                            Check in
                          </SubmitButton>
                        </form>
                      </td>
                      ) : null}
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
