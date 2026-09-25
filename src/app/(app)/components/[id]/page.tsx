import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { SubmitButton } from "@/components/SubmitButton";
import { getComponentDetail, listComponentAssignments } from "@/lib/components";
import { listComputerAssets } from "@/lib/assets";
import { canActingUserWrite } from "@/lib/authz";
import { PurchaseInfo } from "@/components/PurchaseInfo";
import { assignComponentAction, unassignComponentAction } from "../actions";

export default async function ComponentDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const component = await getComponentDetail(id);

  if (!component) {
    return (
      <div className="usa-page">
        <div className="usa-page-header">
          <h1 className="usa-page-title">Component not found</h1>
        </div>
        <Link className="usa-button usa-button--outline" href="/components">
          Back to components
        </Link>
      </div>
    );
  }

  const [assignments, assets, canWrite] = await Promise.all([
    listComponentAssignments(id),
    listComputerAssets(),
    canActingUserWrite()
  ]);

  return (
    <div className="usa-page">
      <div className="usa-page-header">
        <div>
          <Link className="record-id" href="/components">
            BACK TO COMPONENTS
          </Link>
          <h1 className="usa-page-title">{component.name}</h1>
          <p className="usa-page-subtitle">
            {[component.manufacturer, component.category].filter(Boolean).join(" · ") ||
              "Component"}
          </p>
        </div>
        <div className="page-actions">
          {component.available > 0 ? (
            <StatusTag tone="green">{component.available} available</StatusTag>
          ) : (
            <StatusTag tone="red">None available</StatusTag>
          )}
        </div>
      </div>

      <section className="stat-grid" aria-label="Component summary">
        <div className="stat-card">
          <div className="stat-label">Total units</div>
          <div className="stat-value">{component.qty}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Available</div>
          <div className="stat-value success">{component.available}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Installed in assets</div>
          <div className="stat-value">{component.assigned}</div>
        </div>
        <div className={`stat-card ${component.available <= component.minAmt ? "danger" : ""}`}>
          <div className="stat-label">Minimum</div>
          <div className="stat-value">{component.minAmt}</div>
        </div>
      </section>

      <PurchaseInfo supplier={component.supplier} orderNumber={component.orderNumber} purchaseCost={component.purchaseCost} purchaseDate={component.purchaseDate} />

      <section className="usa-card">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Assign to an asset</span>
        </div>
        <div className="usa-card__body">
          {!canWrite ? (
            <p className="text-muted">Your role is Read-Only. Assigning components is disabled.</p>
          ) : component.available <= 0 ? (
            <p className="text-muted">
              No available units to assign. All {component.qty} unit{component.qty === 1 ? "" : "s"} are currently installed.
            </p>
          ) : assets.length === 0 ? (
            <p className="text-muted">
              No computer assets exist yet to assign this component to.{" "}
              <Link href="/assets#asset-create">Create a computer asset</Link> first.
            </p>
          ) : (
            <form action={assignComponentAction} className="filter-bar">
              <input type="hidden" name="componentId" value={component.id} />
              <label className="sr-only" htmlFor="assign-asset">
                Asset
              </label>
              <select
                id="assign-asset"
                name="assetId"
                className="usa-select usa-select--sm"
                defaultValue=""
                required
              >
                <option value="" disabled>
                  Select asset...
                </option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.assetTag} ({asset.model})
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="assign-qty">
                Quantity
              </label>
              <input
                id="assign-qty"
                name="qty"
                type="number"
                min={1}
                max={component.available}
                defaultValue={1}
                className="usa-input usa-input--sm"
              />
              <SubmitButton
                className="usa-button usa-button--primary usa-button--sm"
                pendingText="Assigning..."
              >
                Assign
              </SubmitButton>
            </form>
          )}
        </div>
      </section>

      <section className="usa-card mt-3">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Installed in</span>
        </div>
        <div className="usa-card__body">
          <div className="table-wrap">
            <table className="usa-table">
              <thead>
                <tr>
                  <th scope="col">Asset</th>
                  <th scope="col">Qty</th>
                  <th scope="col">Assigned</th>
                  {canWrite ? <th scope="col">Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {assignments.length === 0 ? (
                  <tr>
                    <td colSpan={canWrite ? 4 : 3}>Not installed in any asset yet.</td>
                  </tr>
                ) : (
                  assignments.map((a) => (
                    <tr key={a.assignmentId}>
                      <td className="font-mono">{a.assetTag}</td>
                      <td className="font-mono">{a.qty}</td>
                      <td className="font-mono">{a.assignedOn}</td>
                      {canWrite ? (
                        <td>
                          <form action={unassignComponentAction} className="row-actions__form">
                            <input type="hidden" name="assignmentId" value={a.assignmentId} />
                            <input type="hidden" name="componentId" value={component.id} />
                            <SubmitButton
                              className="usa-button usa-button--outline usa-button--sm"
                              pendingText="Removing..."
                            >
                              Remove
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
