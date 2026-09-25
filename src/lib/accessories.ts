import { getPool } from "@/lib/db";
import { writeAuditLog, resolveActor } from "@/lib/audit";

export type AccessoryRow = {
  id: string;
  name: string;
  category: string | null;
  manufacturer: string | null;
  qty: number;
  checkedOut: number;
  available: number;
  minAmt: number;
  location: string | null;
  lowStock: boolean;
};

export type AccessoryFilters = { q?: string; category?: string; manufacturer?: string; location?: string; status?: string };
export type SortDir = "asc" | "desc";
export type AccessorySortOptions = { sort?: string; dir?: SortDir; page?: number; pageSize?: number };

const ACCESSORY_SORT_COLUMNS: Record<string, string> = {
  name: "a.name",
  category: "a.category",
  manufacturer: "a.manufacturer",
  available: "(a.qty - count(co.*))",
  location: "a.location"
};

export const ACCESSORY_PAGE_SIZE = 20;

function buildAccessoryWhere(filters: AccessoryFilters): { clauses: string[]; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters.category) {
    params.push(filters.category);
    clauses.push(`a.category = $${params.length}`);
  }
  if (filters.manufacturer) {
    params.push(filters.manufacturer);
    clauses.push(`a.manufacturer = $${params.length}`);
  }
  if (filters.location) {
    params.push(filters.location);
    clauses.push(`a.location = $${params.length}`);
  }
  if (filters.q) {
    params.push(`%${filters.q}%`);
    const i = params.length;
    clauses.push(`(a.name ILIKE $${i} OR a.manufacturer ILIKE $${i})`);
  }
  return { clauses, params };
}

export async function listAccessoryCategories(): Promise<string[]> {
  const r = await getPool().query<{ category: string }>(
    "SELECT DISTINCT category FROM accessories WHERE category IS NOT NULL ORDER BY category"
  );
  return r.rows.map((x) => x.category);
}
export async function listAccessoryManufacturers(): Promise<string[]> {
  const r = await getPool().query<{ manufacturer: string }>(
    "SELECT DISTINCT manufacturer FROM accessories WHERE manufacturer IS NOT NULL ORDER BY manufacturer"
  );
  return r.rows.map((x) => x.manufacturer);
}
export async function listAccessoryLocations(): Promise<string[]> {
  const r = await getPool().query<{ location: string }>(
    "SELECT DISTINCT location FROM accessories WHERE location IS NOT NULL ORDER BY location"
  );
  return r.rows.map((x) => x.location);
}

export async function countFilteredAccessories(filters: AccessoryFilters = {}): Promise<number> {
  const { clauses, params } = buildAccessoryWhere(filters);
  // The low-stock status filter depends on the per-row aggregate, so it is
  // applied via HAVING after grouping.
  const having = filters.status === "low" ? "HAVING (a.qty - count(co.*)) <= a.min_amt"
    : filters.status === "ok" ? "HAVING (a.qty - count(co.*)) > a.min_amt" : "";
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await getPool().query<{ n: string }>(
    `SELECT count(*)::text AS n FROM (
       SELECT a.id
         FROM accessories a
         LEFT JOIN accessory_checkouts co ON co.accessory_id = a.id
         ${where}
        GROUP BY a.id
        ${having}
     ) s`,
    params
  );
  return Number(result.rows[0].n);
}

export async function listAccessories(
  filters: AccessoryFilters = {},
  options: AccessorySortOptions = {}
): Promise<AccessoryRow[]> {
  const { clauses, params } = buildAccessoryWhere(filters);
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const having = filters.status === "low" ? "HAVING (a.qty - count(co.*)) <= a.min_amt"
    : filters.status === "ok" ? "HAVING (a.qty - count(co.*)) > a.min_amt" : "";

  const sortColumn = options.sort ? ACCESSORY_SORT_COLUMNS[options.sort] : undefined;
  const dir = options.dir === "asc" ? "ASC" : "DESC";
  const orderBy = sortColumn ? `${sortColumn} ${dir} NULLS LAST, a.name ASC` : "a.name ASC";

  const pageSize = options.pageSize ?? ACCESSORY_PAGE_SIZE;
  const pageNum = Math.max(1, options.page ?? 1);
  params.push(pageSize);
  const limitParam = params.length;
  params.push((pageNum - 1) * pageSize);
  const offsetParam = params.length;

  const result = await getPool().query<{
    id: string;
    name: string;
    category: string | null;
    manufacturer: string | null;
    qty: number;
    min_amt: number;
    location: string | null;
    checked_out: number;
  }>(
    `SELECT a.id, a.name, a.category, a.manufacturer, a.qty, a.min_amt, a.location,
            count(co.*)::int AS checked_out
       FROM accessories a
       LEFT JOIN accessory_checkouts co ON co.accessory_id = a.id
       ${where}
      GROUP BY a.id
      ${having}
      ORDER BY ${orderBy}
      LIMIT $${limitParam} OFFSET $${offsetParam}`,
    params
  );
  return result.rows.map((r) => {
    const available = Math.max(r.qty - r.checked_out, 0);
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      manufacturer: r.manufacturer,
      qty: r.qty,
      checkedOut: r.checked_out,
      available,
      minAmt: r.min_amt,
      location: r.location,
      lowStock: available <= r.min_amt
    };
  });
}

export type AccessoryStats = {
  total: number;
  totalUnits: number;
  checkedOut: number;
  lowStock: number;
};

export async function getAccessoryStats(): Promise<AccessoryStats> {
  const pool = getPool();
  const [base, low] = await Promise.all([
    pool.query<{ total: string; total_units: string; checked_out: string }>(
      `SELECT count(*)::text AS total,
              COALESCE(sum(qty), 0)::text AS total_units,
              (SELECT count(*) FROM accessory_checkouts)::text AS checked_out
         FROM accessories`
    ),
    pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM (
         SELECT a.qty - count(co.*) AS available, a.min_amt
           FROM accessories a
           LEFT JOIN accessory_checkouts co ON co.accessory_id = a.id
          GROUP BY a.id
       ) s WHERE s.available <= s.min_amt`
    )
  ]);
  return {
    total: Number(base.rows[0].total),
    totalUnits: Number(base.rows[0].total_units),
    checkedOut: Number(base.rows[0].checked_out),
    lowStock: Number(low.rows[0].n)
  };
}

export type AccessoryDetail = {
  id: string;
  name: string;
  category: string | null;
  manufacturer: string | null;
  modelNumber: string | null;
  qty: number;
  checkedOut: number;
  available: number;
  minAmt: number;
  location: string | null;
  supplier: string | null;
  orderNumber: string | null;
  purchaseCost: string | null;
  purchaseDate: string | null;
};

export async function getAccessoryDetail(id: string): Promise<AccessoryDetail | null> {
  const result = await getPool().query<{
    id: string; name: string; category: string | null; manufacturer: string | null;
    model_number: string | null; qty: number; min_amt: number; location: string | null;
    supplier: string | null; checked_out: number;
    order_number: string | null; purchase_cost: string | null; purchase_date: string | null;
  }>(
    `SELECT a.id, a.name, a.category, a.manufacturer, a.model_number, a.qty, a.min_amt,
            a.location, a.supplier, a.order_number, a.purchase_cost::text AS purchase_cost,
            to_char(a.purchase_date, 'YYYY-MM-DD') AS purchase_date,
            count(co.*)::int AS checked_out
       FROM accessories a
       LEFT JOIN accessory_checkouts co ON co.accessory_id = a.id
      WHERE a.id = $1
      GROUP BY a.id`,
    [id]
  );
  if (result.rowCount === 0) return null;
  const r = result.rows[0];
  return {
    id: r.id, name: r.name, category: r.category, manufacturer: r.manufacturer,
    modelNumber: r.model_number, qty: r.qty, checkedOut: r.checked_out,
    available: Math.max(r.qty - r.checked_out, 0), minAmt: r.min_amt,
    location: r.location, supplier: r.supplier,
    orderNumber: r.order_number, purchaseCost: r.purchase_cost, purchaseDate: r.purchase_date
  };
}

export type AccessoryHolder = {
  checkoutId: string;
  userName: string;
  checkedOutOn: string;
};

export async function listAccessoryHolders(id: string): Promise<AccessoryHolder[]> {
  const result = await getPool().query<{ checkout_id: string; user_name: string; created_at: string }>(
    `SELECT co.id AS checkout_id, u.display_name AS user_name,
            to_char(co.created_at, 'YYYY-MM-DD') AS created_at
       FROM accessory_checkouts co
       JOIN app_users u ON u.id = co.assigned_user_id
      WHERE co.accessory_id = $1
      ORDER BY co.created_at DESC`,
    [id]
  );
  return result.rows.map((r) => ({
    checkoutId: r.checkout_id,
    userName: r.user_name,
    checkedOutOn: r.created_at
  }));
}

// Checks out one unit of an accessory to a user (if available), recording an
// audit entry in the same transaction.
export async function checkOutAccessory(accessoryId: string, toUserId: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const a = await client.query<{ name: string; qty: number }>(
      "SELECT name, qty FROM accessories WHERE id = $1 FOR UPDATE",
      [accessoryId]
    );
    if (a.rowCount === 0) throw new Error("Accessory not found.");
    const usedRes = await client.query<{ used: number }>(
      "SELECT count(*)::int AS used FROM accessory_checkouts WHERE accessory_id = $1",
      [accessoryId]
    );
    if (a.rows[0].qty - usedRes.rows[0].used <= 0) throw new Error("No units available to check out.");
    const actor = await resolveActor(client);
    await client.query(
      "INSERT INTO accessory_checkouts (accessory_id, assigned_user_id) VALUES ($1, $2)",
      [accessoryId, toUserId]
    );
    await writeAuditLog(
      {
        actorUserId: actor.id, actorLabel: actor.label,
        action: "Checked out accessory", recordType: "accessory", recordId: a.rows[0].name,
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

// Checks an accessory unit back in by removing a checkout row.
export async function checkInAccessory(checkoutId: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const co = await client.query<{ accessory_id: string; name: string }>(
      `SELECT co.accessory_id, a.name
         FROM accessory_checkouts co JOIN accessories a ON a.id = co.accessory_id
        WHERE co.id = $1`,
      [checkoutId]
    );
    if (co.rowCount === 0) throw new Error("Checkout not found.");
    const actor = await resolveActor(client);
    await client.query("DELETE FROM accessory_checkouts WHERE id = $1", [checkoutId]);
    await writeAuditLog(
      {
        actorUserId: actor.id, actorLabel: actor.label,
        action: "Checked in accessory", recordType: "accessory", recordId: co.rows[0].name,
        metadata: { checkoutId }
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
