import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";

type HelpCard = {
  href: string;
  title: string;
  body: string;
  tag: string;
  tone: string;
};

const cards: HelpCard[] = [
  {
    href: "/help/asset-managers",
    title: "Asset manager guide",
    body: "Create and edit records, assign custody, transfer and dispose assets, and work the request and approval queues.",
    tag: "For asset managers",
    tone: "blue"
  },
  {
    href: "/help/admins",
    title: "Admin and staff guide",
    body: "Roles and access, the dev role switcher, read-only behavior, reference data, and the audit log.",
    tag: "For admins and staff",
    tone: "cyan"
  },
  {
    href: "/help/mulesoft-flow",
    title: "MuleSoft data integration flow",
    body: "How personnel data moves from HRIS through custody actions to offboarding return, and which role acts at each step.",
    tag: "Integration reference",
    tone: "green"
  }
];

export default function HelpPage() {
  return (
    <div className="usa-page">
      <div className="usa-page-header">
        <div>
          <h1 className="usa-page-title">Help and guidance</h1>
          <p className="usa-page-subtitle">
            Learning and reference material for asset managers and web app administrators and staff.
          </p>
        </div>
      </div>

      <section className="stat-grid" aria-label="Help topics">
        {cards.map((card) => (
          <Link className="detail-stat-card help-card" href={card.href} key={card.href}>
            <div>
              <StatusTag tone={card.tone}>{card.tag}</StatusTag>
            </div>
            <h2 className="detail-stat-card__heading">{card.title}</h2>
            <p className="detail-stat-card__body">{card.body}</p>
            <span className="help-card__cta">Open guide</span>
          </Link>
        ))}
      </section>

      <section className="usa-card mt-3">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Getting started</span>
        </div>
        <div className="usa-card__body">
          <ol className="help-steps">
            <li>Sign in from the login picker. In development you can switch roles to see what each role can do.</li>
            <li>Use the sidebar to reach Inventory, People and Requests, and System areas.</li>
            <li>Asset managers create and assign equipment; approvers clear requests; everyone can read the audit trail.</li>
            <li>Need integration detail? See the <Link href="/help/mulesoft-flow">MuleSoft data integration flow</Link>.</li>
          </ol>
        </div>
      </section>
    </div>
  );
}
