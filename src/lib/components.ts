import { getPool } from "@/lib/db";
import { writeAuditLog, resolveActor } from "@/lib/audit";

export type ComponentRow = {
  id: string;
  name: string;
  category: string | null;
  manufacturer: string | null;
  serial: string | null;
  qty: number;
  assigned: number;
  available: number;
  minAmt: number;
  location: string | null;
  lowStock: boolean;
};

export type ComponentFilters = { q?: string; category?: string; manufacturer?: string; location?: string; status?: string };
export type SortDir = "asc" | "desc";
export type ComponentSortOptions = { sort?: string; dir?: SortDir; page?: number; pageSize?: number };

const COMPONENT_SORT_COLUMNS: Record<string, string> = {
  name: "c.name",
  category: "c.category",
  manufacturer: "c.manufacturer",
  available: "(c.qty - COALESCE(sum(ca.assigned_qty), 0))",
  location: "c.location"
};

export const COMPONENT_PAGE_SIZE = 20;

function buildComponentWhere(filters: ComponentFilters): { clauses: string[]; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters.category) { params.push(filters.category); clauses.push(`c.category = $${params.length}`); }
  if (filters.manufacturer) { params.push(filters.manufacturer); clauses.push(`c.manufacturer = $${params.length}`); }
  if (filters.location) { params.push(filters.location); clauses.push(`c.location = $${params.length}`); }
  if (filters.q) {
    params.push(`%${filters.q}%`);
    const i = params.length;
    clauses.push(`(c.name ILIKE $${i} OR c.manufacturer ILIKE $${i} OR c.serial ILIKE $${i})`);
  }
  return { clauses, params };
}

const COMPONENT_HAVING = (status?: string) =>
  status === "low" ? "HAVING (c.qty - COALESCE(sum(ca.assigned_qty), 0)) <= c.min_amt"
    : status === "ok" ? "HAVING (c.qty - COALESCE(sum(ca.assigned_qty), 0)) > c.min_amt" : "";

export async function listComponentCategories(): Promise<string[]> {
  const r = await getPool().query<{ category: string }>("SELECT DISTINCT category FROM components WHERE category IS NOT NULL ORDER BY category");
  return r.rows.map((x) => x.category);
}
export async function listComponentManufacturers(): Promise<string[]> {
  const r = await getPool().query<{ manufacturer: string }>("SELECT DISTINCT manufacturer FROM components WHERE manufacturer IS NOT NULL ORDER BY manufacturer");
  return r.rows.map((x) => x.manufacturer);
}
export async function listComponentLocations(): Promise<string[]> {
  const r = await getPool().query<{ location: string }>("SELECT DISTINCT location FROM components WHERE location IS NOT NULL ORDER BY location");
  return r.rows.map((x) => x.location);
}

export async function countFilteredComponents(filters: ComponentFilters = {}): Promise<number> {
  const { clauses, params } = buildComponentWhere(filters);
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await getPool().query<{ n: string }>(
    `SELECT count(*)::text AS n FROM (
       SELECT c.id FROM components c
         LEFT JOIN component_assignments ca ON ca.component_id = c.id
         ${where} GROUP BY c.id ${COMPONENT_HAVING(filters.status)}
     ) s`,
    params
  );
  return Number(result.rows[0].n);
}

export async function listComponents(
  filters: ComponentFilters = {},
  options: ComponentSortOptions = {}
): Promise<ComponentRow[]> {
  const { clauses, params } = buildComponentWhere(filters);
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const sortColumn = options.sort ? COMPONENT_SORT_COLUMNS[options.sort] : undefined;
  const dir = options.dir === "asc" ? "ASC" : "DESC";
  const orderBy = sortColumn ? `${sortColumn} ${dir} NULLS LAST, c.name ASC` : "c.name ASC";
  const pageSize = options.pageSize ?? COMPONENT_PAGE_SIZE;
  const pageNum = Math.max(1, options.page ?? 1);
  params.push(pageSize); const limitParam = params.length;
  params.push((pageNum - 1) * pageSize); const offsetParam = params.length;

  const result = await getPool().query<{
    id: string;
    name: string;
    category: string | null;
    manufacturer: string | null;
    serial: string | null;
    qty: number;
    min_amt: number;
    location: string | null;
    assigned: number;
  }>(
    `SELECT c.id, c.name, c.category, c.manufacturer, c.serial, c.qty, c.min_amt, c.location,
            COALESCE(sum(ca.assigned_qty), 0)::int AS assigned
       FROM components c
       LEFT JOIN component_assignments ca ON ca.component_id = c.id
       ${where}
      GROUP BY c.id
      ${COMPONENT_HAVING(filters.status)}
      ORDER BY ${orderBy}
      LIMIT $${limitParam} OFFSET $${offsetParam}`,
    params
  );
  return result.rows.map((r) => {
    const available = Math.max(r.qty - r.assigned, 0);
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      manufacturer: r.manufacturer,
      serial: r.serial,
      qty: r.qty,
      assigned: r.assigned,
      available,
      minAmt: r.min_amt,
      location: r.location,
      lowStock: available <= r.min_amt
    };
  });
}

export type ComponentStats = {
  total: number;
  totalUnits: number;
  assignedUnits: number;
  lowStock: number;
};

export async function getComponentStats(): Promise<ComponentStats> {
  const pool = getPool();
  const [base, low] = await Promise.all([
    pool.query<{ total: string; total_units: string; assigned_units: string }>(
      `SELECT count(*)::text AS total,
              COALESCE(sum(qty), 0)::text AS total_units,
              (SELECT COALESCE(sum(assigned_qty), 0) FROM component_assignments)::text AS assigned_units
         FROM components`
    ),
    pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM (
         SELECT c.qty - COALESCE(sum(ca.assigned_qty), 0) AS available, c.min_amt
           FROM components c
           LEFT JOIN component_assignments ca ON ca.component_id = c.id
          GROUP BY c.id
       ) s WHERE s.available <= s.min_amt`
    )
  ]);
  return {
    total: Number(base.rows[0].total),
    totalUnits: Number(base.rows[0].total_units),
    assignedUnits: Number(base.rows[0].assigned_units),
    lowStock: Number(low.rows[0].n)
  };
}

export type ComponentDetail = {
  id: string;
  name: string;
  category: string | null;
  manufacturer: string | null;
  serial: string | null;
  qty: number;
  assigned: number;
  available: number;
  minAmt: number;
  location: string | null;
  supplier: string | null;
  orderNumber: string | null;
  purchaseCost: string | null;
  purchaseDate: string | null;
};

export async function getComponentDetail(id: string): Promise<ComponentDetail | null> {
  const result = await getPool().query<{
    id: string; name: string; category: string | null; manufacturer: string | null;
    serial: string | null; qty: number; min_amt: number; location: string | null; assigned: number;
    supplier: string | null; order_number: string | null; purchase_cost: string | null; purchase_date: string | null;
  }>(
    `SELECT c.id, c.name, c.category, c.manufacturer, c.serial, c.qty, c.min_amt, c.location,
            c.supplier, c.order_number, c.purchase_cost::text AS purchase_cost,
            to_char(c.purchase_date, 'YYYY-MM-DD') AS purchase_date,
            COALESCE(sum(ca.assigned_qty), 0)::int AS assigned
       FROM components c
       LEFT JOIN component_assignments ca ON ca.component_id = c.id
      WHERE c.id = $1
      GROUP BY c.id`,
    [id]
  );
  if (result.rowCount === 0) return null;
  const r = result.rows[0];
  return {
    id: r.id, name: r.name, category: r.category, manufacturer: r.manufacturer,
    serial: r.serial, qty: r.qty, assigned: r.assigned,
    available: Math.max(r.qty - r.assigned, 0), minAmt: r.min_amt, location: r.location,
    supplier: r.supplier, orderNumber: r.order_number,
    purchaseCost: r.purchase_cost, purchaseDate: r.purchase_date
  };
}

export type ComponentAssignment = {
  assignmentId: string;
  assetTag: string;
  qty: number;
  assignedOn: string;
};

export async function listComponentAssignments(id: string): Promise<ComponentAssignment[]> {
  const result = await getPool().query<{
    assignment_id: string; asset_tag: string; assigned_qty: number; created_at: string;
  }>(
    `SELECT ca.id AS assignment_id, a.asset_tag, ca.assigned_qty,
            to_char(ca.created_at, 'YYYY-MM-DD') AS created_at
       FROM component_assignments ca
       JOIN assets a ON a.id = ca.asset_id
      WHERE ca.component_id = $1
      ORDER BY ca.created_at DESC`,
    [id]
  );
  return result.rows.map((r) => ({
    assignmentId: r.assignment_id,
    assetTag: r.asset_tag,
    qty: r.assigned_qty,
    assignedOn: r.created_at
  }));
}

// Assigns a quantity of a component to an asset (if enough is available), with
// an audit entry in the same transaction.
export async function assignComponentToAsset(
  componentId: string,
  assetId: string,
  qty: number
): Promise<void> {
  const amount = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const c = await client.query<{ name: string; qty: number }>(
      "SELECT name, qty FROM components WHERE id = $1 FOR UPDATE",
      [componentId]
    );
    if (c.rowCount === 0) throw new Error("Component not found.");
    const usedRes = await client.query<{ used: number }>(
      "SELECT COALESCE(sum(assigned_qty), 0)::int AS used FROM component_assignments WHERE component_id = $1",
      [componentId]
    );
    if (c.rows[0].qty - usedRes.rows[0].used < amount) throw new Error("Not enough units available.");
    const tag = await client.query<{ asset_tag: string }>(
      "SELECT asset_tag FROM assets WHERE id = $1",
      [assetId]
    );
    if (tag.rowCount === 0) throw new Error("Asset not found.");
    const actor = await resolveActor(client);
    await client.query(
      "INSERT INTO component_assignments (component_id, asset_id, assigned_qty) VALUES ($1, $2, $3)",
      [componentId, assetId, amount]
    );
    await writeAuditLog(
      {
        actorUserId: actor.id, actorLabel: actor.label,
        action: "Assigned component to asset", recordType: "component", recordId: c.rows[0].name,
        metadata: { assetTag: tag.rows[0].asset_tag, qty: amount }
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

// Removes a component-to-asset assignment, returning the units to stock.
export async function unassignComponent(assignmentId: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const a = await client.query<{ name: string }>(
      `SELECT c.name FROM component_assignments ca JOIN components c ON c.id = ca.component_id
        WHERE ca.id = $1`,
      [assignmentId]
    );
    if (a.rowCount === 0) throw new Error("Assignment not found.");
    const actor = await resolveActor(client);
    await client.query("DELETE FROM component_assignments WHERE id = $1", [assignmentId]);
    await writeAuditLog(
      {
        actorUserId: actor.id, actorLabel: actor.label,
        action: "Unassigned component from asset", recordType: "component", recordId: a.rows[0].name,
        metadata: { assignmentId }
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
