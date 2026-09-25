import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { actingUserIsAdmin } from "@/lib/authz";

// Administration hub: the self-service control center for site admins. Frames
// the autonomy story for the demo ("your team manages this without an
// engineering ticket"). Each card links to a capability; "live" cards are
// usable today, "planned" cards set expectations for the roadmap.
type Capability = {
  title: string;
  href: string;
  description: string;
  state: "live" | "planned";
};

const CAPABILITIES: Capability[] = [
  {
    title: "Customize Form",
    href: "/settings/custom-fields",
    description:
      "Add, edit, reorder, and group your own custom fields on the asset form. Fields you define appear on every record immediately, with no engineering change.",
    state: "live"
  },
  {
    title: "Reference data",
    href: "/reference",
    description:
      "Review the lookup values and organizational structures used across the platform (asset categories, roles, offices). Editable management is on the roadmap.",
    state: "planned"
  },
  {
    title: "Audit log",
    href: "/audit",
    description:
      "Every change, including custom field changes, is recorded with who, what, and when. Filter and export the trail for compliance.",
    state: "live"
  },
  {
    title: "Integrations",
    href: "/integrations",
    description:
      "Monitor the MuleSoft data integration layer and trigger a sync. Connection status is shown live.",
    state: "live"
  }
];

export default async function AdministrationPage() {
  const isAdmin = await actingUserIsAdmin();

  if (!isAdmin) {
    return (
      <div className="usa-page">
        <div className="usa-page-header">
          <div>
            <h1 className="usa-page-title">Administration</h1>
            <p className="usa-page-subtitle">Site administration and self-service tools.</p>
          </div>
        </div>
        <section className="usa-alert usa-alert--warning">
          <strong>Administrator access required.</strong> The administration tools change settings
          that affect every user. Switch to an admin account (e.g. Taylor Ellis in the dev login
          picker) to manage them.
        </section>
      </div>
    );
  }

  return (
    <div className="usa-page usa-page--wide">
      <div className="usa-page-header">
        <div>
          <h1 className="usa-page-title">Administration</h1>
          <p className="usa-page-subtitle">
            Self-service control center. These tools let your team manage the system directly,
            without an engineering request for every change.
          </p>
        </div>
        <div className="page-actions">
          <StatusTag tone="blue">Admin</StatusTag>
        </div>
      </div>

      <div className="admin-hub-grid">
        {CAPABILITIES.map((c) => (
          <Link className="admin-hub-card" key={c.href} href={c.href}>
            <div className="admin-hub-card__head">
              <span className="admin-hub-card__title">{c.title}</span>
              {c.state === "live" ? (
                <StatusTag tone="green">Live</StatusTag>
              ) : (
                <StatusTag tone="gray">Planned</StatusTag>
              )}
            </div>
            <p className="admin-hub-card__desc">{c.description}</p>
            <span className="admin-hub-card__cta">Open</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
