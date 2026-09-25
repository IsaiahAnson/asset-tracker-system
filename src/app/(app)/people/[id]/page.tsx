import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { AvatarInitials } from "@/components/AvatarInitials";
import {
  getPersonDetail,
  listPersonAssets,
  listPersonAccessories,
  listPersonConsumables,
  listPersonActivity,
  type AssignedItem
} from "@/lib/person-detail";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "equipment", label: "Assigned equipment" },
  { key: "activity", label: "Activity" }
] as const;

type Row = AssignedItem & { type: string };

export default async function PersonDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const person = await getPersonDetail(id);

  if (!person) {
    return (
      <div className="usa-page">
        <div className="usa-page-header">
          <h1 className="usa-page-title">Person not found</h1>
        </div>
        <Link className="usa-button usa-button--outline" href="/people">
          Back to people
        </Link>
      </div>
    );
  }

  const requestedTab = (await searchParams).tab ?? "overview";
  const tab = TABS.some((t) => t.key === requestedTab) ? requestedTab : "overview";

  const [assets, accessories, consumables, activity] = await Promise.all([
    listPersonAssets(id),
    listPersonAccessories(id),
    listPersonConsumables(id),
    tab === "activity" ? listPersonActivity(id) : Promise.resolve([])
  ]);

  const equipment: Row[] = [
    ...assets.map((i) => ({ ...i, type: "Asset" })),
    ...accessories.map((i) => ({ ...i, type: "Accessory" })),
    ...consumables.map((i) => ({ ...i, type: "Consumable" }))
  ];

  return (
    <div className="usa-page">
      <div className="usa-page-header">
        <div>
          <Link className="record-id" href="/people">
            BACK TO PEOPLE
          </Link>
          <h1 className="usa-page-title">
            <span className="record-title">
              <AvatarInitials name={person.displayName} />
              {person.displayName}
            </span>
          </h1>
          <p className="usa-page-subtitle">{person.email}</p>
        </div>
        <div className="page-actions">
          <StatusTag tone={person.active ? "green" : "gray"}>
            {person.active ? "Active" : "Deactivated"}
          </StatusTag>
          {person.firearmAccess ? <StatusTag tone="red">Firearms access</StatusTag> : null}
        </div>
      </div>

      <nav className="detail-tabs" aria-label="Person detail sections">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "overview" ? `/people/${person.id}` : `/people/${person.id}?tab=${t.key}`}
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
                <dt>Name</dt>
                <dd>{person.displayName}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{person.email}</dd>
              </div>
              <div>
                <dt>Group</dt>
                <dd>{person.group ?? "—"}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{person.roles || "No system role"}</dd>
              </div>
              <div>
                <dt>Firearms access</dt>
                <dd>{person.firearmAccess ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt>Assigned assets</dt>
                <dd>{assets.length}</dd>
              </div>
              <div>
                <dt>Accessories</dt>
                <dd>{accessories.length}</dd>
              </div>
              <div>
                <dt>Consumables</dt>
                <dd>{consumables.length}</dd>
              </div>
            </dl>
          </div>
        </section>
      ) : null}

      {tab === "equipment" ? (
        <section className="usa-card">
          <div className="usa-card__header">
            <span className="usa-card__header-title">Assigned equipment</span>
          </div>
          <div className="usa-card__body">
            <div className="table-wrap">
              <table className="usa-table">
                <thead>
                  <tr>
                    <th scope="col">Type</th>
                    <th scope="col">Item</th>
                    <th scope="col">Detail</th>
                    <th scope="col">Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {equipment.length === 0 ? (
                    <tr>
                      <td colSpan={4}>Nothing currently assigned to this person.</td>
                    </tr>
                  ) : (
                    equipment.map((item) => (
                      <tr key={`${item.type}-${item.id}-${item.label}`}>
                        <td>{item.type}</td>
                        <td>
                          <Link href={item.href}>{item.label}</Link>
                        </td>
                        <td>{item.detail}</td>
                        <td className="font-mono">{item.assignedOn ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
                    <th scope="col">Record</th>
                    <th scope="col">When</th>
                    <th scope="col">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No recorded activity for this person.</td>
                    </tr>
                  ) : (
                    activity.map((a) => (
                      <tr key={a.id}>
                        <td className="font-mono">{a.id}</td>
                        <td>{a.action}</td>
                        <td className="font-mono">{a.record}</td>
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
