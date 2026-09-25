import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { IntegrationSyncPanel } from "@/components/IntegrationSyncPanel";

type Service = {
  name: string;
  via: string;
  purpose: string;
  status: "Planned" | "Stubbed" | "Migration only";
  tone: "yellow" | "cyan" | "gray";
};

const otherConnections: Service[] = [
  {
    name: "Legacy system",
    via: "One-time migration utility",
    purpose: "Source for the 2012 asset records during cutover, then retired.",
    status: "Migration only",
    tone: "gray"
  },
  {
    name: "Amazon S3 (Attachments)",
    via: "approved storage bucket",
    purpose: "Planned store for file attachments and evidence packets.",
    status: "Planned",
    tone: "yellow"
  }
];

export default function IntegrationsPage() {
  return (
    <div className="usa-page">
      <div className="usa-page-header">
        <div>
          <h1 className="usa-page-title">Data Integrations</h1>
          <p className="usa-page-subtitle">
            API endpoints, plugins, and external connections. MuleSoft is the single
            integration boundary; HRIS personnel data flows through it.
          </p>
        </div>
        <div className="page-actions">
          <StatusTag tone="yellow">Integration layer in progress</StatusTag>
        </div>
      </div>

      <section className="usa-card" aria-label="MuleSoft and HRIS connection">
        <div className="usa-card__header">
          <span className="usa-card__header-title">MuleSoft Integration Layer</span>
          <StatusTag tone="cyan">HRIS personnel data</StatusTag>
        </div>
        <div className="usa-card__body">
          <p className="mb-2">
            MuleSoft is the only path between this app and agency systems; the app never calls those
            systems directly. HRIS personnel data, onboarding and offboarding events, personal email
            for notifications, and the role, group, and firearms-access flags that drive access control,
            all arrive through this boundary. The receiver contract is locked and the live pull is
            simulated until HRIS subscribes the endpoint.
          </p>
          <IntegrationSyncPanel />
        </div>
      </section>

      <section className="usa-card mt-3">
        <div className="usa-card__header">
          <span className="usa-card__header-title">MuleSoft inbound endpoint</span>
          <StatusTag tone="cyan">Stubbed, contract locked</StatusTag>
        </div>
        <div className="usa-card__body">
          <dl className="workflow-step__meta">
            <dt>Method and path</dt>
            <dd className="font-mono">POST /api/integrations/hr/intake</dd>
            <dt>Authentication</dt>
            <dd>X-Webhook-Signature header: HMAC-SHA256 over the raw body, secret held in HR_WEBHOOK_SECRET.</dd>
            <dt>Idempotency</dt>
            <dd>Deduplicates on idempotency_key, so redeliveries of the same event are safe.</dd>
            <dt>Responses</dt>
            <dd className="font-mono">202 accepted, 200 duplicate, 401 invalid signature, 400 missing idempotency_key</dd>
            <dt>Status</dt>
            <dd>
              Receiver contract is built. The HR webhook subscribes this endpoint once the payload
              schema and signing details are finalized with the integration owner.
            </dd>
          </dl>
        </div>
      </section>

      <section className="usa-card mt-3">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Access control across the workflow</span>
        </div>
        <div className="usa-card__body">
          <p>
            Roles and group memberships originate in HRIS (synced through MuleSoft) and are
            enforced at the PostgreSQL query layer, not the interface alone. A user only sees assets and
            reports belonging to their group, and firearms records stay hidden unless the firearms access
            flag is present, even for an Asset Manager.
          </p>
        </div>
      </section>

      <section className="usa-card mt-3">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Other connections</span>
          <StatusTag tone="gray">Roadmap</StatusTag>
        </div>
        <div className="usa-card__body">
          <div className="stat-grid" aria-label="Other connections" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            {otherConnections.map((svc) => (
              <div className="detail-stat-card" key={svc.name}>
                <h3 className="detail-stat-card__name">{svc.name}</h3>
                <div className="detail-stat-card__body">
                  <strong>Via:</strong> {svc.via}
                  <br />
                  {svc.purpose}
                </div>
                <div>
                  <StatusTag tone={svc.tone}>{svc.status}</StatusTag>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2">
            Looking for how personnel data moves from HRIS through custody to return? See the{" "}
            <Link href="/help/mulesoft-flow">MuleSoft data integration flow</Link> in Help.
          </p>
        </div>
      </section>
    </div>
  );
}
