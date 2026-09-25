import { groupBySection, type CustomFieldWithValue } from "@/lib/custom-field-types";

// Renders admin-defined custom fields as real form inputs on the asset create
// form, grouped under their admin-assigned sections. Each input is named
// `cf_<fieldKey>` so the server action can collect them without colliding with
// the standard asset fields. Presentational and server-compatible.
export function CustomFieldInputs({ fields }: { fields: CustomFieldWithValue[] }) {
  if (fields.length === 0) return null;
  const groups = groupBySection(fields);

  return (
    <div className="custom-fields-section">
      <p className="custom-fields-section__label">Custom fields</p>
      {groups.map((group) => (
        <div className="custom-fields-group" key={group.section}>
          <p className="custom-fields-group__heading">{group.section}</p>
          <div className="asset-form-grid">
            {group.items.map(({ definition: d, value }) => {
              const name = `cf_${d.fieldKey}`;
              const inputId = `cf-input-${d.fieldKey}`;
              const defaultVal = value ?? "";

              if (d.fieldType === "checkbox") {
                return (
                  <div className="usa-form-group asset-form-grid__full" key={d.id}>
                    <label className="cf-editor__checkbox" htmlFor={inputId}>
                      <input
                        id={inputId}
                        name={name}
                        type="checkbox"
                        defaultChecked={value === "true"}
                      />
                      <span>{d.label}</span>
                    </label>
                    {d.helpText ? <p className="usa-hint">{d.helpText}</p> : null}
                  </div>
                );
              }

              return (
                <div className="usa-form-group" key={d.id}>
                  <label className="usa-label" htmlFor={inputId}>
                    {d.label}
                    {d.required ? <span className="cf-required"> *</span> : null}
                  </label>

                  {d.fieldType === "select" ? (
                    <select
                      id={inputId}
                      name={name}
                      className="usa-select"
                      defaultValue={defaultVal}
                      required={d.required}
                    >
                      <option value="">Select...</option>
                      {d.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : d.fieldType === "textarea" ? (
                    <textarea
                      id={inputId}
                      name={name}
                      className="usa-textarea"
                      rows={3}
                      defaultValue={defaultVal}
                      required={d.required}
                    />
                  ) : (
                    <input
                      id={inputId}
                      name={name}
                      className="usa-input"
                      type={d.fieldType === "number" ? "number" : "text"}
                      inputMode={d.fieldType === "number" ? "numeric" : undefined}
                      placeholder={d.fieldType === "date" ? "YYYY-MM-DD" : undefined}
                      pattern={d.fieldType === "date" ? "\\d{4}-\\d{2}-\\d{2}" : undefined}
                      defaultValue={defaultVal}
                      required={d.required}
                    />
                  )}

                  {d.helpText ? <p className="usa-hint">{d.helpText}</p> : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
