import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export default function AdminHelpPage() {
  return (
    <div className="usa-page">
      <Breadcrumbs items={[{ href: "/help", label: "Help" }, { label: "Admin and staff guide" }]} />
      <div className="usa-page-header">
        <div>
          <h1 className="usa-page-title">Admin and staff guide</h1>
          <p className="usa-page-subtitle">
            Roles, access behavior, reference data, and the audit trail for administrators and staff.
          </p>
        </div>
      </div>

      <section className="usa-card">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Roles and access</span>
        </div>
        <div className="usa-card__body">
          <ul className="help-list">
            <li><strong>Asset Manager:</strong> creates records and performs custody actions.</li>
            <li><strong>Office-Specific Asset Manager:</strong> the same actions, scoped to their office.</li>
            <li><strong>Approver:</strong> clears or denies requests.</li>
            <li><strong>Admin:</strong> broad access, may also approve.</li>
            <li><strong>Read-only:</strong> can view everything permitted but cannot make changes.</li>
          </ul>
          <p>
            In production, roles and group memberships originate in HRIS (synced through MuleSoft)
            and are enforced at the PostgreSQL query layer.
          </p>
        </div>
      </section>

      <section className="usa-card mt-3">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Dev role switcher and read-only behavior</span>
        </div>
        <div className="usa-card__body">
          <p>
            In development you can switch the acting role from the header to preview each role. When acting
            as a read-only role, write controls are disabled and the server rejects writes, so the
            restriction is enforced beyond the interface.
          </p>
        </div>
      </section>

      <section className="usa-alert usa-alert--warning mt-3">
        <strong>Approval rules are enforced server-side.</strong> Interface visibility does not grant access:
        API handlers and PostgreSQL queries must check role, group membership, and high-sensitivity flags.
      </section>

      <section className="usa-card mt-3">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Reference data and audit</span>
        </div>
        <div className="usa-card__body">
          <ul className="help-list">
            <li>Manage shared lists in <Link href="/reference">Reference data</Link> (manufacturers, locations, suppliers).</li>
            <li>Review every change in the <Link href="/audit">Audit Log</Link>, with filters and CSV export of the filtered view.</li>
            <li>Check connection status and recent pulls on the <Link href="/integrations">Integrations</Link> page.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
