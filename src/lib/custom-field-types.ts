// Client-safe types, constants, and pure helpers for the custom field feature.
//
// IMPORTANT: this module must NEVER import the database layer (`@/lib/db` /
// `pg`). It is imported by the client component CustomFieldEditor, so anything
// pulled in here lands in the browser bundle. The db-backed query/mutation
// functions live in `@/lib/custom-fields`, which re-exports everything here so
// server code can keep importing from a single place.

export type FieldType = "text" | "textarea" | "number" | "date" | "select" | "checkbox";

export const FIELD_TYPES: { value: FieldType; label: string; hint: string }[] = [
  { value: "text", label: "Text", hint: "Single line of text." },
  { value: "textarea", label: "Long text", hint: "Multiple lines of text." },
  { value: "number", label: "Number", hint: "Numeric value." },
  { value: "date", label: "Date", hint: "Calendar date (YYYY-MM-DD)." },
  { value: "select", label: "Select", hint: "Pick one from a fixed list." },
  { value: "checkbox", label: "Checkbox", hint: "Yes / no toggle." }
];

export function fieldTypeLabel(type: string): string {
  return FIELD_TYPES.find((t) => t.value === type)?.label ?? type;
}

// Entities a custom field can attach to. Only 'asset' is wired end-to-end
// today; the column + this list keep the door open for more without a schema
// change.
export const CUSTOM_FIELD_ENTITIES: { value: string; label: string }[] = [
  { value: "asset", label: "Computer Asset" }
];

export function entityLabel(entity: string): string {
  return CUSTOM_FIELD_ENTITIES.find((e) => e.value === entity)?.label ?? entity;
}

export type CustomFieldDefinition = {
  id: string;
  entity: string;
  fieldKey: string;
  label: string;
  fieldType: FieldType;
  options: string[];
  helpText: string | null;
  defaultValue: string | null;
  required: boolean;
  displayOrder: number;
  active: boolean;
  section: string | null;
};

export type CustomFieldWithValue = {
  definition: CustomFieldDefinition;
  value: string | null;
};

// Default heading for fields an admin has not assigned to a named section.
export const DEFAULT_SECTION_LABEL = "Additional fields";

// Groups field/value pairs into ordered sections, preserving the incoming
// (display_order) order both across sections and within each section. Fields
// with no section land in DEFAULT_SECTION_LABEL, which sorts last.
export function groupBySection<T extends { definition: CustomFieldDefinition }>(
  items: T[]
): { section: string; items: T[] }[] {
  const order: string[] = [];
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const key = item.definition.section?.trim() || DEFAULT_SECTION_LABEL;
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(item);
  }
  // Keep first-seen order, but always push the default group to the end.
  order.sort((a, b) => {
    if (a === DEFAULT_SECTION_LABEL) return 1;
    if (b === DEFAULT_SECTION_LABEL) return -1;
    return 0;
  });
  return order.map((section) => ({ section, items: buckets.get(section)! }));
}

// Distinct named sections present in a set of definitions (for the editor's
// datalist), excluding the implicit default.
export function distinctSections(definitions: CustomFieldDefinition[]): string[] {
  const seen = new Set<string>();
  for (const d of definitions) {
    const s = d.section?.trim();
    if (s) seen.add(s);
  }
  return Array.from(seen);
}

// Validates submitted values against active definitions. Returns an array of
// human-readable problems (empty = OK). Pure, so the action layer can call it
// before touching the DB.
export function validateCustomValues(
  definitions: CustomFieldDefinition[],
  valuesByKey: Record<string, string>
): string[] {
  const problems: string[] = [];
  for (const def of definitions) {
    const raw = (valuesByKey[def.fieldKey] ?? "").trim();
    if (def.required && def.fieldType !== "checkbox" && raw === "") {
      problems.push(`${def.label} is required.`);
      continue;
    }
    if (raw === "") continue;
    if (def.fieldType === "number" && Number.isNaN(Number(raw))) {
      problems.push(`${def.label} must be a number.`);
    }
    if (def.fieldType === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      problems.push(`${def.label} must be a date (YYYY-MM-DD).`);
    }
    if (def.fieldType === "select" && def.options.length > 0 && !def.options.includes(raw)) {
      problems.push(`${def.label} must be one of: ${def.options.join(", ")}.`);
    }
  }
  return problems;
}

// Formats a stored value for display per its type (checkbox -> Yes/No).
export function formatCustomValue(def: CustomFieldDefinition, value: string | null): string {
  if (def.fieldType === "checkbox") return value === "true" ? "Yes" : "No";
  if (value === null || value.trim() === "") return "—";
  return value;
}
