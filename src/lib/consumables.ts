import { getPool } from "@/lib/db";
import { writeAuditLog, resolveActor } from "@/lib/audit";

export type ConsumableRow = {
  id: string;
  name: string;
  category: string | null;
  manufacturer: string | null;
  itemNo: string | null;
  qty: number;
  issued: number;
  remaining: number;
  minAmt: number;
  location: string | null;
  lowStock: boolean;
};

export type ConsumableFilters = { q?: string; category?: string; manufacturer?: string; location?: string; status?: string };
export type SortDir = "asc" | "desc";
export type ConsumableSortOptions = { sort?: string; dir?: SortDir; page?: number; pageSize?: number };

const CONSUMABLE_SORT_COLUMNS: Record<string, string> = {
  name: "c.name",
  category: "c.category",
  itemNo: "c.item_no",
  remaining: "(c.qty - count(ci.*))",
  location: "c.location"
};

export const CONSUMABLE_PAGE_SIZE = 20;

function buildConsumableWhere(filters: ConsumableFilters): { clauses: string[]; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters.category) { params.push(filters.category); clauses.push(`c.category = $${params.length}`); }
  if (filters.manufacturer) { params.push(filters.manufacturer); clauses.push(`c.manufacturer = $${params.length}`); }
  if (filters.location) { params.push(filters.location); clauses.push(`c.location = $${params.length}`); }
  if (filters.q) {
    params.push(`%${filters.q}%`);
    const i = params.length;
    clauses.push(`(c.name ILIKE $${i} OR c.manufacturer ILIKE $${i} OR c.item_no ILIKE $${i})`);
  }
  return { clauses, params };
}

export async function listConsumableCategories(): Promise<string[]> {
  const r = await getPool().query<{ category: string }>("SELECT DISTINCT category FROM consumables WHERE category IS NOT NULL ORDER BY category");
  return r.rows.map((x) => x.category);
}
export async function listConsumableManufacturers(): Promise<string[]> {
  const r = await getPool().query<{ manufacturer: string }>("SELECT DISTINCT manufacturer FROM consumables WHERE manufacturer IS NOT NULL ORDER BY manufacturer");
  return r.rows.map((x) => x.manufacturer);
}
export async function listConsumableLocations(): Promise<string[]> {
  const r = await getPool().query<{ location: string }>("SELECT DISTINCT location FROM consumables WHERE location IS NOT NULL ORDER BY location");
  return r.rows.map((x) => x.location);
}

export async function countFilteredConsumables(filters: ConsumableFilters = {}): Promise<number> {
  const { clauses, params } = buildConsumableWhere(filters);
  const having = filters.status === "low" ? "HAVING (c.qty - count(ci.*)) <= c.min_amt"
    : filters.status === "ok" ? "HAVING (c.qty - count(ci.*)) > c.min_amt" : "";
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await getPool().query<{ n: string }>(
    `SELECT count(*)::text AS n FROM (
       SELECT c.id FROM consumables c
         LEFT JOIN consumable_issues ci ON ci.consumable_id = c.id
         ${where} GROUP BY c.id ${having}
     ) s`,
    params
  );
  return Number(result.rows[0].n);
}

export async function listConsumables(
  filters: ConsumableFilters = {},
  options: ConsumableSortOptions = {}
): Promise<ConsumableRow[]> {
  const { clauses, params } = buildConsumableWhere(filters);
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const having = filters.status === "low" ? "HAVING (c.qty - count(ci.*)) <= c.min_amt"
    : filters.status === "ok" ? "HAVING (c.qty - count(ci.*)) > c.min_amt" : "";
  const sortColumn = options.sort ? CONSUMABLE_SORT_COLUMNS[options.sort] : undefined;
  const dir = options.dir === "asc" ? "ASC" : "DESC";
  const orderBy = sortColumn ? `${sortColumn} ${dir} NULLS LAST, c.name ASC` : "c.name ASC";
  const pageSize = options.pageSize ?? CONSUMABLE_PAGE_SIZE;
  const pageNum = Math.max(1, options.page ?? 1);
  params.push(pageSize); const limitParam = params.length;
  params.push((pageNum - 1) * pageSize); const offsetParam = params.length;

  const result = await getPool().query<{
    id: string;
    name: string;
    category: string | null;
    manufacturer: string | null;
    item_no: string | null;
    qty: number;
    min_amt: number;
    location: string | null;
    issued: number;
  }>(
    `SELECT c.id, c.name, c.category, c.manufacturer, c.item_no, c.qty, c.min_amt, c.location,
            count(ci.*)::int AS issued
       FROM consumables c
       LEFT JOIN consumable_issues ci ON ci.consumable_id = c.id
       ${where}
      GROUP BY c.id
      ${having}
      ORDER BY ${orderBy}
      LIMIT $${limitParam} OFFSET $${offsetParam}`,
    params
  );
  return result.rows.map((r) => {
    const remaining = Math.max(r.qty - r.issued, 0);
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      manufacturer: r.manufacturer,
      itemNo: r.item_no,
      qty: r.qty,
      issued: r.issued,
      remaining,
      minAmt: r.min_amt,
      location: r.location,
      lowStock: remaining <= r.min_amt
    };
  });
}

export type ConsumableStats = {
  total: number;
  remainingUnits: number;
  issued: number;
  lowStock: number;
};

export async function getConsumableStats(): Promise<ConsumableStats> {
  const pool = getPool();
  const [agg, issuedRes, low] = await Promise.all([
    pool.query<{ total: string; total_qty: string }>(
      "SELECT count(*)::text AS total, COALESCE(sum(qty), 0)::text AS total_qty FROM consumables"
    ),
    pool.query<{ n: string }>("SELECT count(*)::text AS n FROM consumable_issues"),
    pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM (
         SELECT c.qty - count(ci.*) AS remaining, c.min_amt
           FROM consumables c
           LEFT JOIN consumable_issues ci ON ci.consumable_id = c.id
          GROUP BY c.id
       ) s WHERE s.remaining <= s.min_amt`
    )
  ]);
  const issued = Number(issuedRes.rows[0].n);
  return {
    total: Number(agg.rows[0].total),
    remainingUnits: Math.max(Number(agg.rows[0].total_qty) - issued, 0),
    issued,
    lowStock: Number(low.rows[0].n)
  };
}

export type ConsumableDetail = {
  id: string;
  name: string;
  category: string | null;
  manufacturer: string | null;
  itemNo: string | null;
  qty: number;
  issued: number;
  remaining: number;
  minAmt: number;
  location: string | null;
  supplier: string | null;
  orderNumber: string | null;
  purchaseCost: string | null;
  purchaseDate: string | null;
};

export async function getConsumableDetail(id: string): Promise<ConsumableDetail | null> {
  const result = await getPool().query<{
    id: string; name: string; category: string | null; manufacturer: string | null;
    item_no: string | null; qty: number; min_amt: number; location: string | null;
    supplier: string | null; issued: number;
    order_number: string | null; purchase_cost: string | null; purchase_date: string | null;
  }>(
    `SELECT c.id, c.name, c.category, c.manufacturer, c.item_no, c.qty, c.min_amt,
            c.location, c.supplier, c.order_number, c.purchase_cost::text AS purchase_cost,
            to_char(c.purchase_date, 'YYYY-MM-DD') AS purchase_date,
            count(ci.*)::int AS issued
       FROM consumables c
       LEFT JOIN consumable_issues ci ON ci.consumable_id = c.id
      WHERE c.id = $1
      GROUP BY c.id`,
    [id]
  );
  if (result.rowCount === 0) return null;
  const r = result.rows[0];
  return {
    id: r.id, name: r.name, category: r.category, manufacturer: r.manufacturer,
    itemNo: r.item_no, qty: r.qty, issued: r.issued,
    remaining: Math.max(r.qty - r.issued, 0), minAmt: r.min_amt,
    location: r.location, supplier: r.supplier,
    orderNumber: r.order_number, purchaseCost: r.purchase_cost, purchaseDate: r.purchase_date
  };
}

export type ConsumableIssue = {
  userName: string;
  issuedOn: string;
};

export async function listConsumableIssues(id: string): Promise<ConsumableIssue[]> {
  const result = await getPool().query<{ user_name: string; created_at: string }>(
    `SELECT u.display_name AS user_name, to_char(ci.created_at, 'YYYY-MM-DD') AS created_at
       FROM consumable_issues ci
       JOIN app_users u ON u.id = ci.assigned_user_id
      WHERE ci.consumable_id = $1
      ORDER BY ci.created_at DESC`,
    [id]
  );
  return result.rows.map((r) => ({ userName: r.user_name, issuedOn: r.created_at }));
}

// Issues one unit of a consumable to a user (consumed, not returned), with an
// audit entry in the same transaction.
export async function issueConsumable(consumableId: string, toUserId: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const c = await client.query<{ name: string; qty: number }>(
      "SELECT name, qty FROM consumables WHERE id = $1 FOR UPDATE",
      [consumableId]
    );
    if (c.rowCount === 0) throw new Error("Consumable not found.");
    const usedRes = await client.query<{ used: number }>(
      "SELECT count(*)::int AS used FROM consumable_issues WHERE consumable_id = $1",
      [consumableId]
    );
    if (c.rows[0].qty - usedRes.rows[0].used <= 0) throw new Error("No units remaining to issue.");
    const actor = await resolveActor(client);
    await client.query(
      "INSERT INTO consumable_issues (consumable_id, assigned_user_id) VALUES ($1, $2)",
      [consumableId, toUserId]
    );
    await writeAuditLog(
      {
        actorUserId: actor.id, actorLabel: actor.label,
        action: "Issued consumable", recordType: "consumable", recordId: c.rows[0].name,
        metadata: { toUserId }
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
