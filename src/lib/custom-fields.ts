import type { PoolClient } from "pg";
import { getPool } from "@/lib/db";
import { writeAuditLog, resolveActor } from "@/lib/audit";
import type { FieldType, CustomFieldDefinition, CustomFieldWithValue } from "@/lib/custom-field-types";

// ============================================================================
// Custom Field Admin ("Customize Form") library — DB-backed queries/mutations.
//
// Backs the admin-managed custom field builder. Admins define fields on an
// entity (today: the computer asset form) and those fields render dynamically
// on the create form and asset detail page. Built clean-room, inspired by the
// ERPNext Customize Form pattern.
//
// Client-safe types, constants, and pure helpers live in custom-field-types.ts
// (which never imports `pg`); we re-export them below so server code can keep
// importing everything from "@/lib/custom-fields".
//
// Every mutation writes an audit_log row so the field set has the same
// tamper-evident trail as asset custody changes.
// ============================================================================

export type {
  FieldType,
  CustomFieldDefinition,
  CustomFieldWithValue
} from "@/lib/custom-field-types";
export {
  FIELD_TYPES,
  fieldTypeLabel,
  CUSTOM_FIELD_ENTITIES,
  entityLabel,
  validateCustomValues,
  formatCustomValue,
  groupBySection,
  distinctSections,
  DEFAULT_SECTION_LABEL
} from "@/lib/custom-field-types";

type DefinitionRow = {
  id: string;
  entity: string;
  field_key: string;
  label: string;
  field_type: FieldType;
  options: string[] | null;
  help_text: string | null;
  default_value: string | null;
  required: boolean;
  display_order: number;
  active: boolean;
  section: string | null;
};

function mapDefinition(r: DefinitionRow): CustomFieldDefinition {
  return {
    id: r.id,
    entity: r.entity,
    fieldKey: r.field_key,
    label: r.label,
    fieldType: r.field_type,
    options: Array.isArray(r.options) ? r.options : [],
    helpText: r.help_text,
    defaultValue: r.default_value,
    required: r.required,
    displayOrder: r.display_order,
    active: r.active,
    section: r.section
  };
}

const DEFINITION_COLUMNS = `id, entity, field_key, label, field_type, options,
  help_text, default_value, required, display_order, active, section`;

// All definitions for an entity (admin view: includes inactive), ordered.
export async function listFieldDefinitions(entity = "asset"): Promise<CustomFieldDefinition[]> {
  const r = await getPool().query<DefinitionRow>(
    `SELECT ${DEFINITION_COLUMNS} FROM custom_field_definitions
      WHERE entity = $1
      ORDER BY display_order, label`,
    [entity]
  );
  return r.rows.map(mapDefinition);
}

// Active definitions only, ordered. Used when rendering forms / detail.
export async function listActiveFieldDefinitions(entity = "asset"): Promise<CustomFieldDefinition[]> {
  const r = await getPool().query<DefinitionRow>(
    `SELECT ${DEFINITION_COLUMNS} FROM custom_field_definitions
      WHERE entity = $1 AND active = true
      ORDER BY display_order, label`,
    [entity]
  );
  return r.rows.map(mapDefinition);
}

export async function getFieldDefinition(id: string): Promise<CustomFieldDefinition | null> {
  const r = await getPool().query<DefinitionRow>(
    `SELECT ${DEFINITION_COLUMNS} FROM custom_field_definitions WHERE id = $1`,
    [id]
  );
  return r.rowCount ? mapDefinition(r.rows[0]) : null;
}

// Turns a human label into a stable machine key: lower snake_case, alnum only.
function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "field"
  );
}

// Ensures the generated key is unique within the entity by appending _2, _3...
async function uniqueFieldKey(client: PoolClient, entity: string, base: string): Promise<string> {
  const existing = await client.query<{ field_key: string }>(
    "SELECT field_key FROM custom_field_definitions WHERE entity = $1",
    [entity]
  );
  const taken = new Set(existing.rows.map((r) => r.field_key));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

export type CreateFieldInput = {
  entity?: string;
  label: string;
  fieldType: FieldType;
  options?: string[];
  helpText?: string | null;
  defaultValue?: string | null;
  required?: boolean;
  section?: string | null;
};

export async function createFieldDefinition(input: CreateFieldInput): Promise<{ id: string }> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const entity = input.entity || "asset";
    const fieldKey = await uniqueFieldKey(client, entity, slugify(input.label));
    const options = input.fieldType === "select" ? input.options ?? [] : [];

    // New fields append to the end of the order.
    const orderRes = await client.query<{ next_order: number }>(
      "SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order FROM custom_field_definitions WHERE entity = $1",
      [entity]
    );

    const ins = await client.query<{ id: string }>(
      `INSERT INTO custom_field_definitions
         (entity, field_key, label, field_type, options, help_text, default_value, required, display_order, section)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        entity,
        fieldKey,
        input.label,
        input.fieldType,
        JSON.stringify(options),
        input.helpText || null,
        input.defaultValue || null,
        Boolean(input.required),
        orderRes.rows[0].next_order,
        input.section?.trim() || null
      ]
    );

    const actor = await resolveActor(client);
    await writeAuditLog(
      {
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: "Created custom field",
        recordType: "custom_field",
        recordId: fieldKey,
        metadata: { entity, label: input.label, fieldType: input.fieldType }
      },
      client
    );

    await client.query("COMMIT");
    return { id: ins.rows[0].id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type UpdateFieldInput = {
  label: string;
  fieldType: FieldType;
  options?: string[];
  helpText?: string | null;
  defaultValue?: string | null;
  required?: boolean;
  section?: string | null;
};

export async function updateFieldDefinition(id: string, input: UpdateFieldInput): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ field_key: string; entity: string }>(
      "SELECT field_key, entity FROM custom_field_definitions WHERE id = $1 FOR UPDATE",
      [id]
    );
    if (existing.rowCount === 0) throw new Error("Custom field not found.");
    const options = input.fieldType === "select" ? input.options ?? [] : [];

    await client.query(
      `UPDATE custom_field_definitions
          SET label = $1, field_type = $2, options = $3::jsonb,
              help_text = $4, default_value = $5, required = $6, section = $7
        WHERE id = $8`,
      [
        input.label,
        input.fieldType,
        JSON.stringify(options),
        input.helpText || null,
        input.defaultValue || null,
        Boolean(input.required),
        input.section?.trim() || null,
        id
      ]
    );

    const actor = await resolveActor(client);
    await writeAuditLog(
      {
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: "Updated custom field",
        recordType: "custom_field",
        recordId: existing.rows[0].field_key,
        metadata: { label: input.label, fieldType: input.fieldType }
      },
      client
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setFieldActive(id: string, active: boolean): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ field_key: string }>(
      "SELECT field_key FROM custom_field_definitions WHERE id = $1 FOR UPDATE",
      [id]
    );
    if (existing.rowCount === 0) throw new Error("Custom field not found.");
    await client.query("UPDATE custom_field_definitions SET active = $1 WHERE id = $2", [active, id]);
    const actor = await resolveActor(client);
    await writeAuditLog(
      {
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: active ? "Activated custom field" : "Deactivated custom field",
        recordType: "custom_field",
        recordId: existing.rows[0].field_key,
        metadata: { active }
      },
      client
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteFieldDefinition(id: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ field_key: string }>(
      "SELECT field_key FROM custom_field_definitions WHERE id = $1 FOR UPDATE",
      [id]
    );
    if (existing.rowCount === 0) throw new Error("Custom field not found.");
    // Values cascade via FK ON DELETE CASCADE.
    await client.query("DELETE FROM custom_field_definitions WHERE id = $1", [id]);
    const actor = await resolveActor(client);
    await writeAuditLog(
      {
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: "Deleted custom field",
        recordType: "custom_field",
        recordId: existing.rows[0].field_key,
        metadata: {}
      },
      client
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Swaps display_order with the adjacent field in the given direction so admins
// can reorder how fields appear on the form.
export async function moveFieldDefinition(id: string, direction: "up" | "down"): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cur = await client.query<{ entity: string; display_order: number }>(
      "SELECT entity, display_order FROM custom_field_definitions WHERE id = $1 FOR UPDATE",
      [id]
    );
    if (cur.rowCount === 0) throw new Error("Custom field not found.");
    const { entity, display_order } = cur.rows[0];

    const neighbor = await client.query<{ id: string; display_order: number }>(
      direction === "up"
        ? `SELECT id, display_order FROM custom_field_definitions
             WHERE entity = $1 AND display_order < $2
             ORDER BY display_order DESC LIMIT 1`
        : `SELECT id, display_order FROM custom_field_definitions
             WHERE entity = $1 AND display_order > $2
             ORDER BY display_order ASC LIMIT 1`,
      [entity, display_order]
    );
    if (neighbor.rowCount === 0) {
      // Already at the edge; nothing to do.
      await client.query("COMMIT");
      return;
    }

    await client.query("UPDATE custom_field_definitions SET display_order = $1 WHERE id = $2", [
      neighbor.rows[0].display_order,
      id
    ]);
    await client.query("UPDATE custom_field_definitions SET display_order = $1 WHERE id = $2", [
      display_order,
      neighbor.rows[0].id
    ]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ── Per-asset values ────────────────────────────────────────────────────────

// Active definitions joined with the asset's stored value (falling back to the
// definition default for the create form / first render). Used by both the
// create form and the asset detail page.
export async function getAssetCustomFields(assetId: string | null): Promise<CustomFieldWithValue[]> {
  const definitions = await listActiveFieldDefinitions("asset");
  if (definitions.length === 0) return [];

  let valueByDef = new Map<string, string | null>();
  if (assetId) {
    const r = await getPool().query<{ field_definition_id: string; value: string | null }>(
      "SELECT field_definition_id, value FROM asset_custom_field_value WHERE asset_id = $1",
      [assetId]
    );
    valueByDef = new Map(r.rows.map((row) => [row.field_definition_id, row.value]));
  }

  return definitions.map((definition) => ({
    definition,
    value: valueByDef.has(definition.id)
      ? valueByDef.get(definition.id) ?? null
      : definition.defaultValue
  }));
}

// Only the fields that actually have a stored value, for compact detail
// display. Includes the definition so the label/type are available.
export async function getAssetCustomValuesForDisplay(assetId: string): Promise<CustomFieldWithValue[]> {
  const r = await getPool().query<DefinitionRow & { value: string | null }>(
    `SELECT d.id, d.entity, d.field_key, d.label, d.field_type, d.options,
            d.help_text, d.default_value, d.required, d.display_order, d.active, d.section,
            v.value
       FROM asset_custom_field_value v
       JOIN custom_field_definitions d ON d.id = v.field_definition_id
      WHERE v.asset_id = $1 AND d.active = true
      ORDER BY d.display_order, d.label`,
    [assetId]
  );
  return r.rows.map((row) => ({ definition: mapDefinition(row), value: row.value }));
}

// Upserts the supplied values for an asset. valuesByKey is keyed by field_key
// (what the form submits). Skips definitions not present in the map so partial
// saves don't wipe untouched fields. Returns nothing; enlists in caller's
// transaction when a client is provided (so it commits atomically with the
// asset insert).
export async function setAssetCustomValues(
  assetId: string,
  valuesByKey: Record<string, string>,
  client?: PoolClient
): Promise<void> {
  const runner = client ?? getPool();
  const definitions = await listActiveFieldDefinitions("asset");
  for (const def of definitions) {
    if (!(def.fieldKey in valuesByKey)) continue;
    const raw = valuesByKey[def.fieldKey];
    // Checkbox: normalize to 'true'/'false'. Empty string clears the value.
    const value =
      def.fieldType === "checkbox"
        ? raw === "true" || raw === "on"
          ? "true"
          : "false"
        : raw.trim() === ""
          ? null
          : raw.trim();

    await runner.query(
      `INSERT INTO asset_custom_field_value (asset_id, field_definition_id, value)
       VALUES ($1, $2, $3)
       ON CONFLICT (asset_id, field_definition_id) DO UPDATE SET value = EXCLUDED.value`,
      [assetId, def.id, value]
    );
  }
}
