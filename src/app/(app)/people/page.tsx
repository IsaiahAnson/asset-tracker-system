import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { AvatarInitials } from "@/components/AvatarInitials";
import { listPeople, getPeopleStats } from "@/lib/people";

export default async function PeoplePage() {
  const [people, stats] = await Promise.all([listPeople(), getPeopleStats()]);

  return (
    <div className="usa-page">
      <div className="usa-page-header">
        <div>
          <h1 className="usa-page-title">People</h1>
          <p className="usa-page-subtitle">
            Personnel directory with assigned assets and accessories.
          </p>
        </div>
      </div>

      <section className="stat-grid" aria-label="People summary">
        <div className="stat-card">
          <div className="stat-label">Users</div>
          <div className="stat-value">{stats.total.toLocaleString("en-US")}</div>
          <div className="stat-card__detail">Personnel records</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Active</div>
          <div className="stat-value success">{stats.active.toLocaleString("en-US")}</div>
          <div className="stat-card__detail">Currently active accounts</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-label">Firearm access</div>
          <div className="stat-value danger">{stats.firearmAccess.toLocaleString("en-US")}</div>
          <div className="stat-card__detail">Users with the firearms flag</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Items assigned</div>
          <div className="stat-value">{stats.itemsAssigned.toLocaleString("en-US")}</div>
          <div className="stat-card__detail">Assets, accessories, consumables</div>
        </div>
      </section>

      <section className="usa-card" id="people-directory">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Personnel directory</span>
          <StatusTag tone="green">Active module</StatusTag>
        </div>
        <div className="usa-card__body">
          <div className="table-wrap">
            <table className="usa-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Group</th>
                  <th scope="col">Role</th>
                  <th scope="col">Assets</th>
                  <th scope="col">Accessories</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {people.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No personnel records yet.</td>
                  </tr>
                ) : (
                  people.map((person) => (
                    <tr key={person.id}>
                      <td>
                        <span className="record-title">
                          <AvatarInitials name={person.displayName} />
                          <Link href={`/people/${person.id}`}>{person.displayName}</Link>
                        </span>
                        <span className="record-id">{person.email}</span>
                      </td>
                      <td>{person.group ?? "—"}</td>
                      <td>
                        {person.roles || "—"}
                        {person.firearmAccess ? (
                          <>
                            {" "}
                            <StatusTag tone="red" title="Has the firearms access flag: can view and manage firearms records">
                              Firearms
                            </StatusTag>
                          </>
                        ) : null}
                      </td>
                      <td className="font-mono">{person.assets}</td>
                      <td className="font-mono">{person.accessories}</td>
                      <td>
                        <StatusTag tone={person.active ? "green" : "gray"}>
                          {person.active ? "Active" : "Deactivated"}
                        </StatusTag>
                      </td>
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
