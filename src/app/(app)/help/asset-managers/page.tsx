import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export default function AssetManagerHelpPage() {
  return (
    <div className="usa-page">
      <Breadcrumbs items={[{ href: "/help", label: "Help" }, { label: "Asset manager guide" }]} />
      <div className="usa-page-header">
        <div>
          <h1 className="usa-page-title">Asset manager guide</h1>
          <p className="usa-page-subtitle">
            Day to day tasks for managing computer assets and the records that support them.
          </p>
        </div>
      </div>

      <section className="usa-card">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Create and edit assets</span>
        </div>
        <div className="usa-card__body">
          <ol className="help-steps">
            <li>Open <Link href="/assets">Assets</Link> and select New computer asset. The create form is at the top of the page.</li>
            <li>Enter the asset type, serial number, and office. Initial custodian is optional until assignment.</li>
            <li>To change details later, open the asset record and use Edit. Every change is written to the audit log.</li>
          </ol>
        </div>
      </section>

      <section className="usa-card mt-3">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Assign, transfer, and dispose</span>
        </div>
        <div className="usa-card__body">
          <ul className="help-list">
            <li><strong>Check out:</strong> assign an available asset to a custodian. The status moves to assigned.</li>
            <li><strong>Transfer:</strong> move custody from one holder to another, with a custody event recorded.</li>
            <li><strong>Check in:</strong> return an asset to available stock.</li>
            <li><strong>Dispose:</strong> retire equipment. This is a confirmed action and cannot be undone.</li>
          </ul>
          <p>Each action writes a custody event and an audit entry in a single transaction.</p>
        </div>
      </section>

      <section className="usa-card mt-3">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Requests and approvals</span>
        </div>
        <div className="usa-card__body">
          <ol className="help-steps">
            <li>Equipment needs are captured as <Link href="/requests">Requests</Link> against an onboarding workflow.</li>
            <li>Approvers clear or deny items in <Link href="/approvals">Approvals</Link>. Overdue items escalate.</li>
            <li>Once approved, the custody action issues the asset and notifies the agent.</li>
          </ol>
        </div>
      </section>

      <section className="usa-card mt-3">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Sensitive equipment</span>
        </div>
        <div className="usa-card__body">
          <p>
            High-sensitivity records such as firearms stay hidden unless your account carries the firearms
            access flag, even if you are an asset manager. Access is enforced at the database query layer.
          </p>
        </div>
      </section>
    </div>
  );
}
