import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { ModalForm } from "@/components/ModalForm";
import { getReferenceData, type NameCount } from "@/lib/reference";
import { actingUserIsAdmin } from "@/lib/authz";
import {
  createCategoryAction,
  updateCategoryAction,
  createGroupAction,
  updateGroupAction,
  createRoleAction,
  updateRoleAction
} from "./actions";

function TagList({ items, linkBase }: { items: NameCount[]; linkBase?: string }) {
  if (items.length === 0) return <p>None recorded yet.</p>;
  return (
    <div className="tag-list">
      {items.map((item) =>
        linkBase ? (
          <Link className="tag-list__item" key={item.name} href={`${linkBase}/${encodeURIComponent(item.name)}`}>
            {item.name}
            <span className="tag-list__count">{item.count}</span>
          </Link>
        ) : (
          <span className="tag-list__item" key={item.name}>
            {item.name}
            <span className="tag-list__count">{item.count}</span>
          </span>
        )
      )}
    </div>
  );
}

const ADD_BTN = "usa-button usa-button--outline usa-button--sm";
const EDIT_BTN = "usa-button usa-button--outline usa-button--sm";

export default async function ReferenceDataPage() {
  const [data, isAdmin] = await Promise.all([getReferenceData(), actingUserIsAdmin()]);

  return (
    <div className="usa-page usa-page--wide">
      <div className="usa-page-header">
        <div>
          <h1 className="usa-page-title">Reference data</h1>
          <p className="usa-page-subtitle">
            Lookup values and organizational structures used across the platform.
          </p>
        </div>
        <div className="page-actions">
          {isAdmin ? (
            <StatusTag tone="green">Admin editable</StatusTag>
          ) : (
            <StatusTag tone="gray">Read-only</StatusTag>
          )}
        </div>
      </div>

      {/* Asset categories */}
      <section className="usa-card">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Asset categories</span>
          {isAdmin ? (
            <ModalForm
              triggerLabel="Add category"
              triggerClassName={ADD_BTN}
              title="Add asset category"
              action={createCategoryAction}
              submitLabel="Add category"
              pendingLabel="Adding..."
            >
              <div className="usa-form-group">
                <label className="usa-label" htmlFor="cat-new-name">Name</label>
                <input id="cat-new-name" name="name" className="usa-input" type="text" required />
              </div>
              <label className="cf-editor__checkbox">
                <input type="checkbox" name="highSensitivity" />
                <span>High sensitivity</span>
              </label>
            </ModalForm>
          ) : null}
        </div>
        <div className="usa-card__body">
          <div className="table-wrap">
            <table className="usa-table">
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">Code</th>
                  <th scope="col">Sensitivity</th>
                  {isAdmin ? <th scope="col">Manage</th> : null}
                </tr>
              </thead>
              <tbody>
                {data.categories.map((c) => (
                  <tr key={c.code}>
                    <td>{c.name}</td>
                    <td className="font-mono">{c.code}</td>
                    <td>
                      {c.highSensitivity ? (
                        <StatusTag tone="red">High sensitivity</StatusTag>
                      ) : (
                        <StatusTag tone="green">Standard</StatusTag>
                      )}
                    </td>
                    {isAdmin ? (
                      <td>
                        <ModalForm
                          triggerLabel="Edit"
                          triggerClassName={EDIT_BTN}
                          title={`Edit ${c.name}`}
                          action={updateCategoryAction}
                          submitLabel="Save"
                        >
                          <input type="hidden" name="id" defaultValue={c.id} />
                          <p className="cf-help">
                            Code <span className="font-mono">{c.code}</span> is fixed.
                          </p>
                          <div className="usa-form-group">
                            <label className="usa-label" htmlFor={`cat-${c.id}-name`}>Name</label>
                            <input id={`cat-${c.id}-name`} name="name" className="usa-input" type="text" defaultValue={c.name} required />
                          </div>
                          <label className="cf-editor__checkbox">
                            <input type="checkbox" name="highSensitivity" defaultChecked={c.highSensitivity} />
                            <span>High sensitivity</span>
                          </label>
                        </ModalForm>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Groups */}
      <section className="usa-card mt-3">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Groups</span>
          {isAdmin ? (
            <ModalForm
              triggerLabel="Add group"
              triggerClassName={ADD_BTN}
              title="Add group"
              action={createGroupAction}
              submitLabel="Add group"
              pendingLabel="Adding..."
            >
              <div className="usa-form-group">
                <label className="usa-label" htmlFor="grp-new-name">Office / group name</label>
                <input id="grp-new-name" name="name" className="usa-input" type="text" required placeholder="e.g. Denver Field Office" />
              </div>
            </ModalForm>
          ) : null}
        </div>
        <div className="usa-card__body">
          <div className="table-wrap">
            <table className="usa-table">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Name</th>
                  {isAdmin ? <th scope="col">Manage</th> : null}
                </tr>
              </thead>
              <tbody>
                {data.groups.map((g) => (
                  <tr key={g.code}>
                    <td className="font-mono">{g.code}</td>
                    <td>{g.name}</td>
                    {isAdmin ? (
                      <td>
                        <ModalForm
                          triggerLabel="Edit"
                          triggerClassName={EDIT_BTN}
                          title={`Edit ${g.name}`}
                          action={updateGroupAction}
                          submitLabel="Save"
                        >
                          <input type="hidden" name="id" defaultValue={g.id} />
                          <p className="cf-help">
                            Code <span className="font-mono">{g.code}</span> is fixed.
                          </p>
                          <div className="usa-form-group">
                            <label className="usa-label" htmlFor={`grp-${g.id}-name`}>Name</label>
                            <input id={`grp-${g.id}-name`} name="name" className="usa-input" type="text" defaultValue={g.name} required />
                          </div>
                        </ModalForm>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="usa-card mt-3">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Roles</span>
          {isAdmin ? (
            <ModalForm
              triggerLabel="Add role"
              triggerClassName={ADD_BTN}
              title="Add role"
              action={createRoleAction}
              submitLabel="Add role"
              pendingLabel="Adding..."
            >
              <div className="usa-form-group">
                <label className="usa-label" htmlFor="role-new-name">Role name</label>
                <input id="role-new-name" name="name" className="usa-input" type="text" required />
              </div>
              <div className="usa-form-group">
                <label className="usa-label" htmlFor="role-new-desc">Description</label>
                <input id="role-new-desc" name="description" className="usa-input" type="text" />
              </div>
            </ModalForm>
          ) : null}
        </div>
        <div className="usa-card__body">
          <div className="table-wrap">
            <table className="usa-table">
              <thead>
                <tr>
                  <th scope="col">Role</th>
                  <th scope="col">Description</th>
                  {isAdmin ? <th scope="col">Manage</th> : null}
                </tr>
              </thead>
              <tbody>
                {data.roles.map((r) => (
                  <tr key={r.code}>
                    <td>{r.name}</td>
                    <td>{r.description}</td>
                    {isAdmin ? (
                      <td>
                        <ModalForm
                          triggerLabel="Edit"
                          triggerClassName={EDIT_BTN}
                          title={`Edit ${r.name}`}
                          action={updateRoleAction}
                          submitLabel="Save"
                        >
                          <input type="hidden" name="id" defaultValue={r.id} />
                          <p className="cf-help">
                            Code <span className="font-mono">{r.code}</span> is fixed (access rules key off it).
                          </p>
                          <div className="usa-form-group">
                            <label className="usa-label" htmlFor={`role-${r.id}-name`}>Name</label>
                            <input id={`role-${r.id}-name`} name="name" className="usa-input" type="text" defaultValue={r.name} required />
                          </div>
                          <div className="usa-form-group">
                            <label className="usa-label" htmlFor={`role-${r.id}-desc`}>Description</label>
                            <input id={`role-${r.id}-desc`} name="description" className="usa-input" type="text" defaultValue={r.description} />
                          </div>
                        </ModalForm>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="dashboard-grid mt-3">
        <section className="usa-card">
          <div className="usa-card__header">
            <span className="usa-card__header-title">Manufacturers in use</span>
            <Link className="usa-button usa-button--outline usa-button--sm" href="/manufacturers">
              View all
            </Link>
          </div>
          <div className="usa-card__body">
            <TagList items={data.manufacturers} linkBase="/manufacturers" />
            {isAdmin ? (
              <p className="cf-help mt-2">Managing these values directly is a later phase.</p>
            ) : null}
          </div>
        </section>
        <section className="usa-card">
          <div className="usa-card__header">
            <span className="usa-card__header-title">Suppliers in use</span>
            <Link className="usa-button usa-button--outline usa-button--sm" href="/suppliers">
              View all
            </Link>
          </div>
          <div className="usa-card__body">
            <TagList items={data.suppliers} linkBase="/suppliers" />
          </div>
        </section>
      </div>

      <section className="usa-card mt-3">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Locations in use</span>
        </div>
        <div className="usa-card__body">
          <TagList items={data.locations} />
        </div>
      </section>
    </div>
  );
}
