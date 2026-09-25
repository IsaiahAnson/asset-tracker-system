import type { PoolClient } from "pg";
import { getPool } from "@/lib/db";
import { writeAuditLog, resolveActor } from "@/lib/audit";

// ============================================================================
// Reference-data administration: admin-managed lookup tables (asset
// categories, groups, roles). Admins edit the human-facing fields and can add
// new entries; the `code` is a stable machine key the app queries on (e.g.
// category 'computers', role 'admin'), so it is generated once on create and
// never edited. Every mutation writes an audit_log row.
// ============================================================================

function slugify(name: string, fallback: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 50) || fallback
  );
}

// Ensures a generated code is unique within its table by appending _2, _3, ...
async function uniqueCode(client: PoolClient, table: string, base: string): Promise<string> {
  const existing = await client.query<{ code: string }>(`SELECT code FROM ${table}`);
  const taken = new Set(existing.rows.map((r) => r.code));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

async function withTxn<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ── Asset categories ─────────────────────────────────────────────────────────

export async function createCategory(input: { name: string; highSensitivity: boolean }): Promise<void> {
  await withTxn(async (client) => {
    const code = await uniqueCode(client, "asset_categories", slugify(input.name, "category"));
    await client.query(
      "INSERT INTO asset_categories (code, name, high_sensitivity) VALUES ($1, $2, $3)",
      [code, input.name, input.highSensitivity]
    );
    const actor = await resolveActor(client);
    await writeAuditLog(
      {
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: "Created asset category",
        recordType: "asset_category",
        recordId: code,
        metadata: { name: input.name, highSensitivity: input.highSensitivity }
      },
      client
    );
  });
}

export async function updateCategory(id: string, input: { name: string; highSensitivity: boolean }): Promise<void> {
  await withTxn(async (client) => {
    const row = await client.query<{ code: string }>(
      "SELECT code FROM asset_categories WHERE id = $1 FOR UPDATE",
      [id]
    );
    if (row.rowCount === 0) throw new Error("Asset category not found.");
    await client.query("UPDATE asset_categories SET name = $1, high_sensitivity = $2 WHERE id = $3", [
      input.name,
      input.highSensitivity,
      id
    ]);
    const actor = await resolveActor(client);
    await writeAuditLog(
      {
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: "Updated asset category",
        recordType: "asset_category",
        recordId: row.rows[0].code,
        metadata: { name: input.name, highSensitivity: input.highSensitivity }
      },
      client
    );
  });
}

// ── Groups (offices) ─────────────────────────────────────────────────────────

export async function createGroup(input: { name: string }): Promise<void> {
  await withTxn(async (client) => {
    // Group codes follow the existing NWA-XXX convention (uppercase, hyphens).
    const base = slugify(input.name, "group").toUpperCase().replace(/_/g, "-");
    const code = await uniqueCode(client, "groups", `NWA-${base}`.slice(0, 50));
    // Nest new offices under the root group for consistency, if present.
    const parent = await client.query<{ id: string }>("SELECT id FROM groups WHERE code = 'NWA' LIMIT 1");
    await client.query(
      "INSERT INTO groups (code, name, parent_group_id) VALUES ($1, $2, $3)",
      [code, input.name, parent.rows[0]?.id ?? null]
    );
    const actor = await resolveActor(client);
    await writeAuditLog(
      {
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: "Created group",
        recordType: "group",
        recordId: code,
        metadata: { name: input.name }
      },
      client
    );
  });
}

export async function updateGroup(id: string, input: { name: string }): Promise<void> {
  await withTxn(async (client) => {
    const row = await client.query<{ code: string }>("SELECT code FROM groups WHERE id = $1 FOR UPDATE", [id]);
    if (row.rowCount === 0) throw new Error("Group not found.");
    await client.query("UPDATE groups SET name = $1 WHERE id = $2", [input.name, id]);
    const actor = await resolveActor(client);
    await writeAuditLog(
      {
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: "Updated group",
        recordType: "group",
        recordId: row.rows[0].code,
        metadata: { name: input.name }
      },
      client
    );
  });
}

// ── Roles ──────────────────────────────────────────────────────────────────

export async function createRole(input: { name: string; description: string }): Promise<void> {
  await withTxn(async (client) => {
    const code = await uniqueCode(client, "roles", slugify(input.name, "role"));
    await client.query("INSERT INTO roles (code, name, description) VALUES ($1, $2, $3)", [
      code,
      input.name,
      input.description
    ]);
    const actor = await resolveActor(client);
    await writeAuditLog(
      {
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: "Created role",
        recordType: "role",
        recordId: code,
        metadata: { name: input.name }
      },
      client
    );
  });
}

export async function updateRole(id: string, input: { name: string; description: string }): Promise<void> {
  await withTxn(async (client) => {
    const row = await client.query<{ code: string }>("SELECT code FROM roles WHERE id = $1 FOR UPDATE", [id]);
    if (row.rowCount === 0) throw new Error("Role not found.");
    await client.query("UPDATE roles SET name = $1, description = $2 WHERE id = $3", [
      input.name,
      input.description,
      id
    ]);
    const actor = await resolveActor(client);
    await writeAuditLog(
      {
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: "Updated role",
        recordType: "role",
        recordId: row.rows[0].code,
        metadata: { name: input.name }
      },
      client
    );
  });
}
