import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { Breadcrumbs } from "@/components/Breadcrumbs";

type Step = {
  title: string;
  data: string;
  fields: string;
  purpose: string;
  roles: string;
};

const workflowSteps: Step[] = [
  {
    title: "HRIS onboarding trigger",
    data: "New-hire personnel event received at the HR inbound endpoint (POST /api/integrations/hr/intake).",
    fields: "employee name, HR/employee ID, personal email, bureau/group, office, position, start date, idempotency_key (with X-Webhook-Signature).",
    purpose: "Open an onboarding workflow automatically, so asset issuance no longer depends on manual email.",
    roles: "System (automated intake). Asset Manager and Office-Specific Asset Manager monitor the queue."
  },
  {
    title: "Requirement capture",
    data: "Equipment needs recorded against the onboarding workflow.",
    fields: "asset categories required (computer, cell phone, firearm, etc.), high-sensitivity needs, assigned office.",
    purpose: "Capture what the agent needs inside the system of record rather than over email.",
    roles: "Asset Manager or Office-Specific Asset Manager (scoped to their bureau/office)."
  },
  {
    title: "Supervisor approval",
    data: "Request routed to an approver with an SLA timer.",
    fields: "request summary, approver, submitted_at, SLA deadline (48 hours by default), decision.",
    purpose: "Authorize issuance, transfer, or disposition before any custody change.",
    roles: "Approver (Admin may also approve). Overdue items escalate to the Office-Specific Asset Manager."
  },
  {
    title: "Custody action (issue / transfer / dispose)",
    data: "Asset assignment plus a custody event and an audit-log entry, written in one transaction.",
    fields: "asset_tag, custodian, status, expected_return_on, custody_events (event_type, performed_by), audit_log.",
    purpose: "Issue, transfer, or recover physical property and create the queryable system of record.",
    roles: "Asset Manager or Office-Specific Asset Manager. Firearms records require the firearms access flag."
  },
  {
    title: "Notification",
    data: "Pickup, transfer, or return instructions sent to the personal email retrieved from HRIS.",
    fields: "personal_email, instruction type, asset reference.",
    purpose: "Reach the agent outside the agency network, since new and departing agents often cannot establish a VDI or AVD session.",
    roles: "System (automated)."
  },
  {
    title: "Offboarding return",
    data: "HRIS separation event opens a return workflow for the agent's assigned assets.",
    fields: "employee ID, separation date, assigned assets, return confirmation.",
    purpose: "Recover property before access loss and close out custody with full audit evidence.",
    roles: "Asset Manager initiates and records the return. Approver confirms disposition where required."
  }
];

export default function MuleSoftFlowHelpPage() {
  return (
    <div className="usa-page">
      <Breadcrumbs items={[{ href: "/help", label: "Help" }, { label: "MuleSoft data integration flow" }]} />
      <div className="usa-page-header">
        <div>
          <h1 className="usa-page-title">MuleSoft data integration flow</h1>
          <p className="usa-page-subtitle">
            How personnel data moves from HRIS through custody to return, and which role acts at each step.
          </p>
        </div>
        <div className="page-actions">
          <StatusTag tone="blue">HRIS to custody to return</StatusTag>
        </div>
      </div>

      <section className="usa-card">
        <div className="usa-card__body">
          <p className="mb-2">
            The personnel data MuleSoft delivers (HRIS events and roles) moves through the asset
            workflow below. Steps 1 and 6 are MuleSoft integration touchpoints; steps 2 to 4 are in-app
            actions on that data; step 5 is the outbound notification. For live connection status and the
            sync feed, see the <Link href="/integrations">Integrations</Link> page.
          </p>
          <ol className="workflow-steps">
            {workflowSteps.map((step, idx) => (
              <li className="workflow-step" key={step.title}>
                <span className="workflow-step__num" aria-hidden="true">
                  {idx + 1}
                </span>
                <div className="workflow-step__body">
                  <h3 className="workflow-step__title">{step.title}</h3>
                  <dl className="workflow-step__meta">
                    <dt>Data pulled</dt>
                    <dd>{step.data}</dd>
                    <dt>Fields</dt>
                    <dd>{step.fields}</dd>
                    <dt>Purpose</dt>
                    <dd>{step.purpose}</dd>
                    <dt>Responsible roles</dt>
                    <dd>{step.roles}</dd>
                  </dl>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="lifecycle-panel mt-3" id="notification-path">
        <div>
          <h2 className="section-title">Notification path</h2>
          <p className="text-muted">
            Personal email addresses from HRIS are used for pickup, transfer, and offboarding instructions
            when agency email access is unavailable.
          </p>
        </div>
        <div className="lifecycle-steps" aria-label="Notification lifecycle">
          <div className="lifecycle-step">HRIS event</div>
          <div className="lifecycle-step">HRIS group sync</div>
          <div className="lifecycle-step">Approval routing</div>
          <div className="lifecycle-step">Personal email notice</div>
          <div className="lifecycle-step">Audit entry</div>
        </div>
      </section>
    </div>
  );
}
