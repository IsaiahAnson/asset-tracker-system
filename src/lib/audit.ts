import { randomBytes } from "crypto";
import type { PoolClient } from "pg";
import { getPool } from "@/lib/db";
import { getActingUserId } from "@/lib/session";

// Resolves the acting user. Real PIV/CAC auth is out of scope for the
// prototype; until session auth lands we honor the dev "acting user" cookie
// (set via the login picker) and otherwise attribute actions to a seeded
// Asset Manager (falling back to any active user). Shared across modules.
export async function resolveActor(
  client: PoolClient
): Promise<{ id: string; label: string }> {
  const actingId = await getActingUserId();
  if (actingId) {
    const acting = await client.query<{ id: string; display_name: string }>(
      "SELECT id, display_name FROM app_users WHERE id = $1 AND active = true",
      [actingId]
    );
    if (acting.rowCount && acting.rows[0]) {
      return { id: acting.rows[0].id, label: acting.rows[0].display_name };
    }
  }

  const result = await client.query<{ id: string; display_name: string }>(
    `SELECT u.id, u.display_name
       FROM app_users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.active = true
      ORDER BY (r.code = 'asset_manager') DESC NULLS LAST, u.display_name
      LIMIT 1`
  );
  if (result.rowCount === 0) {
    throw new Error("No active user available to attribute the action to.");
  }
  return { id: result.rows[0].id, label: result.rows[0].display_name };
}

const ET_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "numeric",
  minute: "2-digit",
  hour12: true
});

// Renders a UTC timestamp in Eastern time (EST/EDT per DST) as
// "YYYY-MM-DD H:MM AM/PM ET" (12-hour clock).
export function formatEastern(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = ET_FORMATTER.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const period = get("dayPeriod").replace(/\./g, "").toUpperCase();
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")} ${period} ET`;
}

export type AuditEntry = {
  id: string;
  timestamp: string;
  actor: string;
  actorUserId: string | null;
  action: string;
  record: string;
  recordType: string;
  recordHref: string | null;
  result: string;
};

export type AuditFilters = { q?: string; recordType?: string; actor?: string; action?: string };

export async function listAuditActions(): Promise<string[]> {
  const r = await getPool().query<{ action: string }>(
    "SELECT DISTINCT action FROM audit_log ORDER BY action"
  );
  return r.rows.map((x) => x.action);
}

export async function listAuditRecordTypes(): Promise<string[]> {
  const r = await getPool().query<{ record_type: string }>(
    "SELECT DISTINCT record_type FROM audit_log ORDER BY record_type"
  );
  return r.rows.map((x) => x.record_type);
}

export async function listAuditActors(): Promise<{ id: string; label: string }[]> {
  const r = await getPool().query<{ id: string; label: string }>(
    "SELECT DISTINCT actor_user_id AS id, actor_label AS label FROM audit_log WHERE actor_user_id IS NOT NULL ORDER BY actor_label"
  );
  return r.rows.map((x) => ({ id: x.id, label: x.label }));
}

// Shared WHERE builder for audit queries (table aliased as `al`), used by both
// the on-screen list and the CSV export so they always match.
function buildAuditWhere(filters: AuditFilters): { clauses: string[]; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters.recordType) {
    params.push(filters.recordType);
    clauses.push(`al.record_type = $${params.length}`);
  }
  if (filters.actor) {
    params.push(filters.actor);
    clauses.push(`al.actor_user_id = $${params.length}`);
  }
  if (filters.action) {
    params.push(filters.action);
    clauses.push(`al.action = $${params.length}`);
  }
  if (filters.q) {
    params.push(`%${filters.q}%`);
    const i = params.length;
    clauses.push(`(al.action ILIKE $${i} OR al.record_id ILIKE $${i} OR al.actor_label ILIKE $${i})`);
  }
  return { clauses, params };
}

export type AuditExportRow = {
  entry: string;
  timestamp: string;
  actor: string;
  action: string;
  recordType: string;
  record: string;
  result: string;
};

// Filtered rows for CSV export (no pagination), honoring the same filters as the
// on-screen audit log.
export async function getAuditExportRows(filters: AuditFilters = {}): Promise<AuditExportRow[]> {
  const { clauses, params } = buildAuditWhere(filters);
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await getPool().query<{
    audit_number: string; created_at: Date; actor_label: string; action: string;
    record_type: string; record_id: string; result: string;
  }>(
    `SELECT al.audit_number, al.created_at, al.actor_label, al.action, al.record_type, al.record_id, al.result
       FROM audit_log al
       ${where}
      ORDER BY al.created_at DESC`,
    params
  );
  return result.rows.map((r) => ({
    entry: r.audit_number,
    timestamp: formatEastern(r.created_at),
    actor: r.actor_label,
    action: r.action,
    recordType: r.record_type,
    record: r.record_id,
    result: r.result
  }));
}

export async function listAuditEntries(filters: AuditFilters = {}, limit = 50): Promise<AuditEntry[]> {
  const { clauses, params } = buildAuditWhere(filters);
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  params.push(limit);
  const limitParam = params.length;

  const result = await getPool().query<{
    audit_number: string;
    actor_label: string;
    actor_user_id: string | null;
    action: string;
    record_id: string;
    record_type: string;
    result: string;
    created_at: Date;
    asset_id: string | null;
    request_id: string | null;
    accessory_id: string | null;
    consumable_id: string | null;
    component_id: string | null;
  }>(
    `SELECT al.audit_number, al.actor_label, al.actor_user_id, al.action, al.record_id,
            al.record_type, al.result, al.created_at,
            a.id AS asset_id, r.id AS request_id,
            (SELECT id FROM accessories WHERE name = al.record_id LIMIT 1) AS accessory_id,
            (SELECT id FROM consumables WHERE name = al.record_id LIMIT 1) AS consumable_id,
            (SELECT id FROM components WHERE name = al.record_id LIMIT 1) AS component_id
       FROM audit_log al
       LEFT JOIN assets a ON al.record_type = 'asset' AND a.asset_tag = al.record_id
       LEFT JOIN asset_requests r ON al.record_type = 'request' AND r.request_number = al.record_id
       ${where}
      ORDER BY al.created_at DESC
      LIMIT $${limitParam}`,
    params
  );

  return result.rows.map((row) => {
    let recordHref: string | null = null;
    const t = row.record_type;
    if (t === "asset" && row.asset_id) recordHref = `/assets/${row.asset_id}`;
    else if (t === "request" && row.request_id) recordHref = `/requests/${row.request_id}`;
    else if (t === "accessory" && row.accessory_id) recordHref = `/accessories/${row.accessory_id}`;
    else if (t === "consumable" && row.consumable_id) recordHref = `/consumables/${row.consumable_id}`;
    else if (t === "component" && row.component_id) recordHref = `/components/${row.component_id}`;
    else if (t === "approval") recordHref = "/approvals";
    return {
      id: row.audit_number,
      timestamp: formatEastern(row.created_at),
      actor: row.actor_label,
      actorUserId: row.actor_user_id,
      action: row.action,
      record: row.record_id,
      recordType: row.record_type,
      recordHref,
      result: row.result
    };
  });
}

type AuditInput = {
  actorUserId?: string | null;
  actorLabel: string;
  action: string;
  recordType: string;
  recordId: string;
  result?: string;
  metadata?: Record<string, unknown>;
};

// Millisecond timestamp alone collides when two rows are written in the same
// ms (e.g. a seat checkout immediately followed by release), so we append a
// random suffix to keep audit numbers unique under the audit_log unique index.
function nextAuditNumber(): string {
  const time = Date.now().toString(36).toUpperCase();
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `AUD-${time}-${suffix}`;
}

// Append-only audit write. Pass a client to enlist in a caller transaction so
// the audit row commits or rolls back atomically with the mutation it records.
export async function writeAuditLog(
  input: AuditInput,
  client?: PoolClient
): Promise<void> {
  const runner = client ?? getPool();

  await runner.query(
    `INSERT INTO audit_log
       (audit_number, actor_user_id, actor_label, action, record_type, record_id, result, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      nextAuditNumber(),
      input.actorUserId ?? null,
      input.actorLabel,
      input.action,
      input.recordType,
      input.recordId,
      input.result ?? "Logged",
      JSON.stringify(input.metadata ?? {})
    ]
  );
}
