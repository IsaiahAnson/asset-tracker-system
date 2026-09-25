import { getPool } from "@/lib/db";
import { writeAuditLog, resolveActor } from "@/lib/audit";

export type MaintenanceRow = {
  id: string;
  assetId: string;
  assetTag: string;
  type: string;
  title: string;
  supplier: string | null;
  startDate: string;
  completionDate: string | null;
  cost: string | null;
  open: boolean;
};

export type MaintenanceFilters = { q?: string; type?: string; status?: string };

export async function listMaintenanceTypes(): Promise<string[]> {
  const r = await getPool().query<{ maintenance_type: string }>(
    "SELECT DISTINCT maintenance_type FROM maintenances ORDER BY maintenance_type"
  );
  return r.rows.map((x) => x.maintenance_type);
}

export async function listMaintenances(filters: MaintenanceFilters = {}): Promise<MaintenanceRow[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters.type) {
    params.push(filters.type);
    clauses.push(`m.maintenance_type = $${params.length}`);
  }
  if (filters.status === "open") clauses.push("m.completion_date IS NULL");
  else if (filters.status === "completed") clauses.push("m.completion_date IS NOT NULL");
  if (filters.q) {
    params.push(`%${filters.q}%`);
    const i = params.length;
    clauses.push(`(m.title ILIKE $${i} OR a.asset_tag ILIKE $${i})`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const result = await getPool().query<{
    id: string; asset_id: string; asset_tag: string; maintenance_type: string; title: string;
    supplier: string | null; start_date: string; completion_date: string | null; cost: string | null;
  }>(
    `SELECT m.id, m.asset_id, a.asset_tag, m.maintenance_type, m.title, m.supplier,
            to_char(m.start_date, 'YYYY-MM-DD') AS start_date,
            to_char(m.completion_date, 'YYYY-MM-DD') AS completion_date,
            m.cost::text AS cost
       FROM maintenances m
       JOIN assets a ON a.id = m.asset_id
       ${where}
      ORDER BY m.start_date DESC`,
    params
  );
  return result.rows.map((r) => ({
    id: r.id,
    assetId: r.asset_id,
    assetTag: r.asset_tag,
    type: r.maintenance_type,
    title: r.title,
    supplier: r.supplier,
    startDate: r.start_date,
    completionDate: r.completion_date,
    cost: r.cost,
    open: r.completion_date === null
  }));
}

export type MaintenanceStats = { total: number; open: number; completed: number; totalCost: string };

export async function getMaintenanceStats(): Promise<MaintenanceStats> {
  const result = await getPool().query<{ total: string; open: string; completed: string; cost: string }>(
    `SELECT count(*)::text AS total,
            count(*) FILTER (WHERE completion_date IS NULL)::text AS open,
            count(*) FILTER (WHERE completion_date IS NOT NULL)::text AS completed,
            COALESCE(sum(cost), 0)::text AS cost
       FROM maintenances`
  );
  const r = result.rows[0];
  return { total: Number(r.total), open: Number(r.open), completed: Number(r.completed), totalCost: r.cost };
}

export type LogMaintenanceInput = {
  assetId: string;
  type: string;
  title: string;
  supplier?: string | null;
  cost?: number | null;
};

export async function logMaintenance(input: LogMaintenanceInput): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tag = await client.query<{ asset_tag: string }>(
      "SELECT asset_tag FROM assets WHERE id = $1",
      [input.assetId]
    );
    if (tag.rowCount === 0) throw new Error("Asset not found.");
    const actor = await resolveActor(client);
    await client.query(
      `INSERT INTO maintenances (asset_id, maintenance_type, title, supplier, cost)
       VALUES ($1, $2, $3, $4, $5)`,
      [input.assetId, input.type, input.title, input.supplier || null, input.cost ?? null]
    );
    await writeAuditLog(
      {
        actorUserId: actor.id, actorLabel: actor.label,
        action: "Logged asset maintenance", recordType: "asset", recordId: tag.rows[0].asset_tag,
        metadata: { type: input.type, title: input.title }
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

export async function completeMaintenance(id: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const m = await client.query<{ title: string; asset_tag: string }>(
      `SELECT m.title, a.asset_tag FROM maintenances m JOIN assets a ON a.id = m.asset_id
        WHERE m.id = $1`,
      [id]
    );
    if (m.rowCount === 0) throw new Error("Maintenance record not found.");
    const actor = await resolveActor(client);
    await client.query(
      "UPDATE maintenances SET completion_date = CURRENT_DATE WHERE id = $1 AND completion_date IS NULL",
      [id]
    );
    await writeAuditLog(
      {
        actorUserId: actor.id, actorLabel: actor.label,
        action: "Completed asset maintenance", recordType: "asset", recordId: m.rows[0].asset_tag,
        metadata: { title: m.rows[0].title }
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
