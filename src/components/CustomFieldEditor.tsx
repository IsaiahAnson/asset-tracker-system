"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { FIELD_TYPES, type FieldType, type CustomFieldDefinition } from "@/lib/custom-field-types";

// Add/edit form for a custom field, with a live preview of how the field will
// render on the asset form. Reused in both "create" (top of the builder page)
// and "edit" (inline per row) modes. Client component because the field-type
// selector conditionally reveals the options editor and reshapes the preview.
export function CustomFieldEditor({
  action,
  mode,
  initial,
  formId,
  knownSections = []
}: {
  action: (formData: FormData) => void | Promise<void>;
  mode: "create" | "edit";
  initial?: CustomFieldDefinition;
  formId?: string;
  knownSections?: string[];
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [fieldType, setFieldType] = useState<FieldType>(initial?.fieldType ?? "text");
  const [optionsText, setOptionsText] = useState((initial?.options ?? []).join("\n"));
  const [helpText, setHelpText] = useState(initial?.helpText ?? "");
  const [defaultValue, setDefaultValue] = useState(initial?.defaultValue ?? "");
  const [required, setRequired] = useState(initial?.required ?? false);
  const [section, setSection] = useState(initial?.section ?? "");

  const isSelect = fieldType === "select";
  const previewOptions = optionsText
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="cf-editor">
      <form action={action} id={formId} className="cf-editor__form">
        {mode === "edit" && initial ? <input type="hidden" name="id" value={initial.id} /> : null}

        <div className="cf-editor__grid">
          <div className="usa-form-group">
            <label className="usa-label" htmlFor={`${formId}-label`}>
              Field label
            </label>
            <input
              id={`${formId}-label`}
              name="label"
              className="usa-input"
              type="text"
              required
              placeholder="e.g. Property Pass Number"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div className="usa-form-group">
            <label className="usa-label" htmlFor={`${formId}-type`}>
              Field type
            </label>
            <select
              id={`${formId}-type`}
              name="fieldType"
              className="usa-select"
              value={fieldType}
              onChange={(e) => setFieldType(e.target.value as FieldType)}
            >
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <p className="usa-hint">{FIELD_TYPES.find((t) => t.value === fieldType)?.hint}</p>
          </div>

          {isSelect ? (
            <div className="usa-form-group cf-editor__full">
              <label className="usa-label" htmlFor={`${formId}-options`}>
                Options (one per line)
              </label>
              <textarea
                id={`${formId}-options`}
                name="options"
                className="usa-textarea"
                rows={4}
                placeholder={"In Service\nSpare\nSurplus"}
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
              />
            </div>
          ) : null}

          <div className="usa-form-group">
            <label className="usa-label" htmlFor={`${formId}-default`}>
              Default value (optional)
            </label>
            <input
              id={`${formId}-default`}
              name="defaultValue"
              className="usa-input"
              type="text"
              placeholder={isSelect ? "Must match an option" : "Prefilled when blank"}
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
            />
          </div>

          <div className="usa-form-group">
            <label className="usa-label" htmlFor={`${formId}-help`}>
              Help text (optional)
            </label>
            <input
              id={`${formId}-help`}
              name="helpText"
              className="usa-input"
              type="text"
              placeholder="Shown under the field"
              value={helpText}
              onChange={(e) => setHelpText(e.target.value)}
            />
          </div>

          <div className="usa-form-group">
            <label className="usa-label" htmlFor={`${formId}-section`}>
              Section (optional)
            </label>
            <input
              id={`${formId}-section`}
              name="section"
              className="usa-input"
              type="text"
              list={`${formId}-section-list`}
              placeholder="Group fields under a heading"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            />
            <datalist id={`${formId}-section-list`}>
              {knownSections.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <p className="usa-hint">Fields with the same section render together. Blank groups under &quot;Additional fields&quot;.</p>
          </div>

          <div className="usa-form-group cf-editor__full">
            <label className="cf-editor__checkbox">
              <input
                type="checkbox"
                name="required"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
              />
              <span>Required field</span>
            </label>
          </div>
        </div>

        <div className="cf-editor__actions">
          <SubmitButton
            className="usa-button usa-button--primary"
            pendingText={mode === "create" ? "Adding..." : "Saving..."}
          >
            {mode === "create" ? "Add field" : "Save changes"}
          </SubmitButton>
        </div>
      </form>

      {/* Live preview of how the field will render on the asset form. */}
      <div className="cf-editor__preview" aria-label="Field preview">
        <p className="cf-editor__preview-label">Live preview</p>
        <FieldPreview
          label={label || "Untitled field"}
          fieldType={fieldType}
          options={previewOptions}
          helpText={helpText}
          defaultValue={defaultValue}
          required={required}
        />
      </div>
    </div>
  );
}

function FieldPreview({
  label,
  fieldType,
  options,
  helpText,
  defaultValue,
  required
}: {
  label: string;
  fieldType: FieldType;
  options: string[];
  helpText: string;
  defaultValue: string;
  required: boolean;
}) {
  const labelEl = (
    <span className="usa-label">
      {label}
      {required ? <span className="cf-required"> *</span> : null}
    </span>
  );

  return (
    <div className="usa-form-group cf-preview-field">
      {fieldType === "checkbox" ? (
        <label className="cf-editor__checkbox">
          <input type="checkbox" defaultChecked={defaultValue === "true"} disabled />
          <span>{label}</span>
        </label>
      ) : (
        <>
          {labelEl}
          {fieldType === "text" || fieldType === "number" ? (
            <input
              className="usa-input"
              type={fieldType === "number" ? "number" : "text"}
              defaultValue={defaultValue}
              disabled
            />
          ) : null}
          {fieldType === "date" ? (
            <input className="usa-input" type="text" placeholder="YYYY-MM-DD" defaultValue={defaultValue} disabled />
          ) : null}
          {fieldType === "textarea" ? (
            <textarea className="usa-textarea" rows={2} defaultValue={defaultValue} disabled />
          ) : null}
          {fieldType === "select" ? (
            <select className="usa-select" defaultValue={defaultValue} disabled>
              <option value="">Select...</option>
              {options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : null}
        </>
      )}
      {helpText ? <p className="usa-hint">{helpText}</p> : null}
    </div>
  );
}
