import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { SubmitButton } from "@/components/SubmitButton";
import { CustomFieldEditor } from "@/components/CustomFieldEditor";
import { actingUserIsAdmin } from "@/lib/authz";
import {
  listFieldDefinitions,
  fieldTypeLabel,
  entityLabel,
  distinctSections,
  CUSTOM_FIELD_ENTITIES
} from "@/lib/custom-fields";
import {
  createCustomFieldAction,
  updateCustomFieldAction,
  toggleCustomFieldAction,
  deleteCustomFieldAction,
  moveCustomFieldAction
} from "./actions";

export default async function CustomFieldsPage() {
  const isAdmin = await actingUserIsAdmin();

  if (!isAdmin) {
    return (
      <div className="usa-page">
        <div className="usa-page-header">
          <div>
            <h1 className="usa-page-title">Customize Form</h1>
            <p className="usa-page-subtitle">Custom field administration.</p>
          </div>
        </div>
        <section className="usa-alert usa-alert--warning">
          <strong>Administrator access required.</strong> The custom field builder changes the
          fields every user sees on a form, so it is limited to administrators. Switch to an admin
          account (e.g. Taylor Ellis in the dev login picker) to manage custom fields.
        </section>
      </div>
    );
  }

  const entity = "asset";
  const fields = await listFieldDefinitions(entity);
  const activeCount = fields.filter((f) => f.active).length;
  const knownSections = distinctSections(fields);

  return (
    <div className="usa-page usa-page--wide">
      <div className="usa-page-header">
        <div>
          <h1 className="usa-page-title">Customize Form</h1>
          <p className="usa-page-subtitle">
            Add and manage your own fields without an engineering change. Fields you define here
            appear on the form and on each record, and are written to the audit log.
          </p>
        </div>
        <div className="page-actions">
          <StatusTag tone="blue">{`${fields.length} field${fields.length === 1 ? "" : "s"}`}</StatusTag>
          <StatusTag tone="green">{`${activeCount} active`}</StatusTag>
        </div>
      </div>

      <section className="usa-card">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Form</span>
        </div>
        <div className="usa-card__body">
          <label className="usa-label" htmlFor="cf-entity">
            Customizing
          </label>
          <select id="cf-entity" className="usa-select cf-entity-select" defaultValue={entity} disabled>
            {CUSTOM_FIELD_ENTITIES.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
          <p className="usa-hint mt-2">
            Fields apply to the <strong>{entityLabel(entity)}</strong> form. More form types open up
            as their modules ship.
          </p>
        </div>
      </section>

      <section className="usa-card mt-3">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Add a field</span>
        </div>
        <div className="usa-card__body">
          <CustomFieldEditor
            action={createCustomFieldAction}
            mode="create"
            formId="cf-create"
            knownSections={knownSections}
          />
        </div>
      </section>

      <section className="usa-card mt-3" id="cf-list">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Fields on this form</span>
          <Link className="usa-button usa-button--outline usa-button--sm" href="/assets#asset-create">
            View on asset form
          </Link>
        </div>
        <div className="usa-card__body">
          {fields.length === 0 ? (
            <p>No custom fields yet. Use the form above to add your first one.</p>
          ) : (
            <div className="table-wrap">
              <table className="usa-table cf-table">
                <thead>
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col">Label</th>
                    <th scope="col">Section</th>
                    <th scope="col">Key</th>
                    <th scope="col">Type</th>
                    <th scope="col">Required</th>
                    <th scope="col">Status</th>
                    <th scope="col">Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((f, idx) => (
                    <tr key={f.id} className={f.active ? undefined : "cf-row--inactive"}>
                      <td>
                        <div className="cf-reorder">
                          <form action={moveCustomFieldAction}>
                            <input type="hidden" name="id" value={f.id} />
                            <input type="hidden" name="direction" value="up" />
                            <button
                              type="submit"
                              className="cf-reorder__btn"
                              aria-label={`Move ${f.label} up`}
                              disabled={idx === 0}
                            >
                              ▲
                            </button>
                          </form>
                          <form action={moveCustomFieldAction}>
                            <input type="hidden" name="id" value={f.id} />
                            <input type="hidden" name="direction" value="down" />
                            <button
                              type="submit"
                              className="cf-reorder__btn"
                              aria-label={`Move ${f.label} down`}
                              disabled={idx === fields.length - 1}
                            >
                              ▼
                            </button>
                          </form>
                        </div>
                      </td>
                      <td>
                        <strong>{f.label}</strong>
                        {f.helpText ? <div className="cf-help">{f.helpText}</div> : null}
                      </td>
                      <td>{f.section ? f.section : <span className="cf-help">Additional fields</span>}</td>
                      <td className="font-mono">{f.fieldKey}</td>
                      <td>
                        {fieldTypeLabel(f.fieldType)}
                        {f.fieldType === "select" && f.options.length > 0 ? (
                          <div className="cf-help">{f.options.join(", ")}</div>
                        ) : null}
                      </td>
                      <td>{f.required ? <StatusTag tone="yellow">Required</StatusTag> : "—"}</td>
                      <td>
                        {f.active ? (
                          <StatusTag tone="green">Active</StatusTag>
                        ) : (
                          <StatusTag tone="gray">Inactive</StatusTag>
                        )}
                      </td>
                      <td>
                        <div className="cf-row-actions">
                          <details className="cf-edit-expander">
                            <summary className="usa-button usa-button--outline usa-button--sm">
                              Edit
                            </summary>
                            <div className="cf-edit-panel">
                              <CustomFieldEditor
                                action={updateCustomFieldAction}
                                mode="edit"
                                initial={f}
                                formId={`cf-edit-${f.id}`}
                                knownSections={knownSections}
                              />
                            </div>
                          </details>
                          <form action={toggleCustomFieldAction}>
                            <input type="hidden" name="id" value={f.id} />
                            <input type="hidden" name="active" value={f.active ? "false" : "true"} />
                            <SubmitButton
                              className="usa-button usa-button--outline usa-button--sm"
                              pendingText="..."
                            >
                              {f.active ? "Deactivate" : "Activate"}
                            </SubmitButton>
                          </form>
                          <form action={deleteCustomFieldAction}>
                            <input type="hidden" name="id" value={f.id} />
                            <SubmitButton
                              className="usa-button usa-button--secondary usa-button--sm"
                              pendingText="Deleting..."
                              confirm={`Delete "${f.label}"? Any values stored for this field on existing records will be removed. This cannot be undone.`}
                              confirmLabel="Delete field"
                            >
                              Delete
                            </SubmitButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
