import { getPool } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { setAssetCustomValues } from "@/lib/custom-fields";

export type ComputerAssetRow = {
  id: string;
  assetTag: string;
  model: string;
  serial: string;
  custodian: string;
  custodianId: string | null;
  office: string;
  status: string;
  expectedReturn: string | null;
  overdue: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  assigned: "Assigned",
  in_transfer: "In transfer",
  in_repair: "In-Repair",
  pending_approval: "Needs approval",
  retired: "Retired",
  disposed: "Disposed",
  lost: "Lost"
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function statusTone(status: string): "green" | "blue" | "yellow" | "cyan" | "red" | "gray" {
  switch (status) {
    case "available":
      return "green";
    case "assigned":
      return "blue";
    case "pending_approval":
      return "yellow";
    case "in_transfer":
      return "cyan";
    case "in_repair":
      return "yellow";
    case "retired":
      return "gray";
    default:
      return "red";
  }
}

export async function countComputerAssets(): Promise<number> {
  const result = await getPool().query<{ n: string }>(
    `SELECT count(*)::text AS n FROM assets a
       JOIN asset_categories c ON c.id = a.category_id
      WHERE c.code = 'computers'`
  );
  return Number(result.rows[0].n);
}

export type AssetFilters = { q?: string; office?: string; status?: string };

export type SortDir = "asc" | "desc";
export type AssetSortOptions = { sort?: string; dir?: SortDir; page?: number; pageSize?: number };

// Whitelist of sortable columns. The key is the public column name used in the
// ?sort= query param; the value is the trusted SQL expression. Never
// interpolate a raw column name from the request into SQL.
const ASSET_SORT_COLUMNS: Record<string, string> = {
  assetTag: "a.asset_tag",
  model: "a.model",
  serial: "a.serial_number",
  custodian: "u.display_name",
  office: "a.office",
  status: "a.status",
  dueBack: "a.expected_return_on"
};

export const ASSET_PAGE_SIZE = 20;

// Builds the shared WHERE clauses + bound params used by both the list and the
// filtered-count queries so they stay in sync.
function buildAssetWhere(filters: AssetFilters): { clauses: string[]; params: unknown[] } {
  const clauses: string[] = ["c.code = 'computers'", "a.status <> 'retired'"];
  const params: unknown[] = [];

  if (filters.status === "overdue") {
    // Overdue is not a stored status: it is an assigned asset whose expected
    // return date has passed.
    clauses.push("a.status = 'assigned' AND a.expected_return_on < CURRENT_DATE");
  } else if (filters.status) {
    params.push(filters.status);
    clauses.push(`a.status = $${params.length}`);
  }
  if (filters.office) {
    params.push(filters.office);
    clauses.push(`a.office = $${params.length}`);
  }
  if (filters.q) {
    params.push(`%${filters.q}%`);
    const i = params.length;
    clauses.push(
      `(a.asset_tag ILIKE $${i} OR a.serial_number ILIKE $${i} OR u.display_name ILIKE $${i})`
    );
  }

  return { clauses, params };
}

export async function countFilteredComputerAssets(filters: AssetFilters = {}): Promise<number> {
  const { clauses, params } = buildAssetWhere(filters);
  const result = await getPool().query<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM assets a
       JOIN asset_categories c ON c.id = a.category_id
       LEFT JOIN app_users u ON u.id = a.current_custodian_id
      WHERE ${clauses.join(" AND ")}`,
    params
  );
  return Number(result.rows[0].n);
}

export async function listComputerOffices(): Promise<string[]> {
  const result = await getPool().query<{ office: string }>(
    `SELECT DISTINCT a.office
       FROM assets a
       JOIN asset_categories c ON c.id = a.category_id
      WHERE c.code = 'computers' AND a.office IS NOT NULL AND a.status <> 'retired'
      ORDER BY a.office`
  );
  return result.rows.map((r) => r.office);
}

export async function listComputerAssets(
  filters: AssetFilters = {},
  options: AssetSortOptions = {}
): Promise<ComputerAssetRow[]> {
  const { clauses, params } = buildAssetWhere(filters);

  const sortColumn = options.sort ? ASSET_SORT_COLUMNS[options.sort] : undefined;
  const dir = options.dir === "asc" ? "ASC" : "DESC";
  const orderBy = sortColumn
    ? `${sortColumn} ${dir} NULLS LAST, a.created_at DESC`
    : "a.created_at DESC";

  const pageSize = options.pageSize ?? ASSET_PAGE_SIZE;
  const page = Math.max(1, options.page ?? 1);
  params.push(pageSize);
  const limitParam = params.length;
  params.push((page - 1) * pageSize);
  const offsetParam = params.length;

  const result = await getPool().query<{
    id: string;
    asset_tag: string;
    model: string | null;
    manufacturer: string | null;
    serial_number: string | null;
    office: string | null;
    status: string;
    custodian: string | null;
    custodian_id: string | null;
    expected_return: string | null;
    overdue: boolean;
  }>(
    `SELECT a.id,
            a.asset_tag,
            a.model,
            a.manufacturer,
            a.serial_number,
            a.office,
            a.status,
            u.display_name AS custodian,
            u.id AS custodian_id,
            to_char(a.expected_return_on, 'YYYY-MM-DD') AS expected_return,
            (a.expected_return_on IS NOT NULL
             AND a.expected_return_on < CURRENT_DATE
             AND a.status = 'assigned') AS overdue
       FROM assets a
       JOIN asset_categories c ON c.id = a.category_id
       LEFT JOIN app_users u ON u.id = a.current_custodian_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY ${orderBy}
      LIMIT $${limitParam} OFFSET $${offsetParam}`,
    params
  );

  return result.rows.map((row) => ({
    id: row.id,
    assetTag: row.asset_tag,
    model: [row.manufacturer, row.model].filter(Boolean).join(" ") || "Computer",
    serial: row.serial_number ?? "",
    custodian: row.custodian ?? "Unassigned",
    custodianId: row.custodian_id,
    office: row.office ?? "",
    status: row.status,
    expectedReturn: row.expected_return,
    overdue: row.overdue
  }));
}

export type DisposedAssetRow = {
  id: string;
  assetTag: string;
  model: string;
  serial: string | null;
  office: string | null;
  disposedOn: string | null;
};

export type DisposedFilters = { q?: string; office?: string };

export async function listDisposedOffices(): Promise<string[]> {
  const result = await getPool().query<{ office: string }>(
    `SELECT DISTINCT a.office FROM assets a JOIN asset_categories c ON c.id = a.category_id
      WHERE c.code = 'computers' AND a.status = 'retired' AND a.office IS NOT NULL
      ORDER BY a.office`
  );
  return result.rows.map((r) => r.office);
}

// Disposed (retired) computer assets, shown in their own section so they stay
// out of the active inventory but remain viewable.
export async function listDisposedComputerAssets(filters: DisposedFilters = {}): Promise<DisposedAssetRow[]> {
  const clauses: string[] = ["c.code = 'computers'", "a.status = 'retired'"];
  const params: unknown[] = [];
  if (filters.office) {
    params.push(filters.office);
    clauses.push(`a.office = $${params.length}`);
  }
  if (filters.q) {
    params.push(`%${filters.q}%`);
    const i = params.length;
    clauses.push(`(a.asset_tag ILIKE $${i} OR a.serial_number ILIKE $${i})`);
  }
  const result = await getPool().query<{
    id: string; asset_tag: string; manufacturer: string | null; model: string | null;
    serial_number: string | null; office: string | null; disposed_on: string | null;
  }>(
    `SELECT a.id, a.asset_tag, a.manufacturer, a.model, a.serial_number, a.office,
            to_char(a.disposed_on, 'YYYY-MM-DD') AS disposed_on
       FROM assets a
       JOIN asset_categories c ON c.id = a.category_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY a.disposed_on DESC NULLS LAST, a.asset_tag`,
    params
  );
  return result.rows.map((r) => ({
    id: r.id,
    assetTag: r.asset_tag,
    model: [r.manufacturer, r.model].filter(Boolean).join(" ") || "Computer",
    serial: r.serial_number,
    office: r.office,
    disposedOn: r.disposed_on
  }));
}

export type UserOption = { id: string; displayName: string };

export async function listUsers(): Promise<UserOption[]> {
  const result = await getPool().query<{ id: string; display_name: string }>(
    `SELECT id, display_name FROM app_users WHERE active = true ORDER BY display_name`
  );
  return result.rows.map((r) => ({ id: r.id, displayName: r.display_name }));
}

// Resolves the acting user. Real PIV/CAC auth is out of scope for the
// prototype; until session auth lands we attribute actions to a seeded
// Asset Manager (falling back to any active user).
async function resolveActor(
  client: import("pg").PoolClient
): Promise<{ id: string; label: string }> {
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

// Reassigns custody: updates the asset, records a custody_events row, and
// writes the audit entry, all in one transaction.
export async function transferCustody(
  assetTag: string,
  toUserId: string,
  expectedReturn?: string | null
): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const asset = await client.query<{ id: string; current_custodian_id: string | null }>(
      "SELECT id, current_custodian_id FROM assets WHERE asset_tag = $1 FOR UPDATE",
      [assetTag]
    );
    if (asset.rowCount === 0) {
      throw new Error(`Asset ${assetTag} not found.`);
    }

    const fromUserId = asset.rows[0].current_custodian_id;
    const eventType = fromUserId ? "transfer" : "issue";
    const actor = await resolveActor(client);

    await client.query(
      "UPDATE assets SET current_custodian_id = $1, status = 'assigned', expected_return_on = $2 WHERE id = $3",
      [toUserId, expectedReturn || null, asset.rows[0].id]
    );

    await client.query(
      `INSERT INTO custody_events
         (asset_id, from_user_id, to_user_id, event_type, performed_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [asset.rows[0].id, fromUserId, toUserId, eventType, actor.id, "Custody change via Assets module"]
    );

    await writeAuditLog(
      {
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: eventType === "issue" ? "Issued computer asset" : "Transferred computer custody",
        recordType: "asset",
        recordId: assetTag,
        metadata: { fromUserId, toUserId, expectedReturn: expectedReturn || null }
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

// Checks an asset back in: returns it to available, clears the custodian and
// expected-return date, and records a 'return' custody event + audit entry in
// one transaction.
export async function checkInAsset(assetTag: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const asset = await client.query<{ id: string; current_custodian_id: string | null }>(
      "SELECT id, current_custodian_id FROM assets WHERE asset_tag = $1 FOR UPDATE",
      [assetTag]
    );
    if (asset.rowCount === 0) {
      throw new Error(`Asset ${assetTag} not found.`);
    }
    if (asset.rows[0].current_custodian_id === null) {
      throw new Error(`Asset ${assetTag} is not currently checked out.`);
    }

    const fromUserId = asset.rows[0].current_custodian_id;
    const actor = await resolveActor(client);

    await client.query(
      "UPDATE assets SET status = 'available', current_custodian_id = NULL, expected_return_on = NULL WHERE id = $1",
      [asset.rows[0].id]
    );

    await client.query(
      `INSERT INTO custody_events
         (asset_id, from_user_id, to_user_id, event_type, performed_by, notes)
       VALUES ($1, $2, NULL, 'return', $3, $4)`,
      [asset.rows[0].id, fromUserId, actor.id, "Checked in via Assets module"]
    );

    await writeAuditLog(
      {
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: "Checked in computer asset",
        recordType: "asset",
        recordId: assetTag,
        metadata: { fromUserId }
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

// Retires an asset: status -> disposed, records the disposition custody event
// and the audit entry in one transaction.
export async function dispositionAsset(assetTag: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const asset = await client.query<{ id: string; current_custodian_id: string | null; status: string }>(
      "SELECT id, current_custodian_id, status FROM assets WHERE asset_tag = $1 FOR UPDATE",
      [assetTag]
    );
    if (asset.rowCount === 0) {
      throw new Error(`Asset ${assetTag} not found.`);
    }
    if (asset.rows[0].status === "disposed") {
      throw new Error(`Asset ${assetTag} is already dispositioned.`);
    }

    const actor = await resolveActor(client);

    await client.query(
      "UPDATE assets SET status = 'retired', disposed_on = CURRENT_DATE, current_custodian_id = NULL WHERE id = $1",
      [asset.rows[0].id]
    );

    await client.query(
      `INSERT INTO custody_events
         (asset_id, from_user_id, to_user_id, event_type, performed_by, notes)
       VALUES ($1, $2, NULL, 'disposition', $3, $4)`,
      [asset.rows[0].id, asset.rows[0].current_custodian_id, actor.id, "Asset retired via Assets module"]
    );

    await writeAuditLog(
      {
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: "Dispositioned computer asset",
        recordType: "asset",
        recordId: assetTag,
        metadata: { previousStatus: asset.rows[0].status }
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

function nextAssetTag(): string {
  const suffix = Math.floor(10000 + Math.random() * 89999);
  return `NWA-CMP-${suffix}`;
}

export type CreateComputerInput = {
  model: string;
  serial: string;
  office: string;
  // Admin-defined custom field values, keyed by field_key. Saved atomically
  // with the asset so a record never exists without its declared custom data.
  customValues?: Record<string, string>;
};

// Creates a computer asset and writes the audit entry in one transaction so a
// record never exists without its corresponding audit trail.
export async function createComputerAsset(
  input: CreateComputerInput
): Promise<{ assetTag: string; id: string }> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const category = await client.query<{ id: string }>(
      "SELECT id FROM asset_categories WHERE code = 'computers'"
    );
    const group = await client.query<{ id: string }>(
      "SELECT id FROM groups WHERE code = 'NWA-HQ'"
    );

    if (category.rowCount === 0 || group.rowCount === 0) {
      throw new Error("Computers category or default group is not seeded.");
    }

    const assetTag = nextAssetTag();

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO assets
         (asset_tag, category_id, group_id, serial_number, model, status, office)
       VALUES ($1, $2, $3, $4, $5, 'available', $6)
       RETURNING id`,
      [
        assetTag,
        category.rows[0].id,
        group.rows[0].id,
        input.serial,
        input.model,
        input.office
      ]
    );

    const id = inserted.rows[0].id;

    if (input.customValues && Object.keys(input.customValues).length > 0) {
      await setAssetCustomValues(id, input.customValues, client);
    }

    await writeAuditLog(
      {
        actorLabel: "Asset Manager",
        action: "Created computer asset",
        recordType: "asset",
        recordId: assetTag,
        metadata: { model: input.model, office: input.office }
      },
      client
    );

    await client.query("COMMIT");
    return { assetTag, id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type EditableAsset = {
  id: string;
  assetTag: string;
  model: string | null;
  serial: string | null;
  office: string | null;
};

export async function getComputerAsset(id: string): Promise<EditableAsset | null> {
  const result = await getPool().query<{
    id: string; asset_tag: string; model: string | null; serial_number: string | null; office: string | null;
  }>(
    `SELECT a.id, a.asset_tag, a.model, a.serial_number, a.office
       FROM assets a JOIN asset_categories c ON c.id = a.category_id
      WHERE a.id = $1 AND c.code = 'computers'`,
    [id]
  );
  if (result.rowCount === 0) return null;
  const r = result.rows[0];
  return { id: r.id, assetTag: r.asset_tag, model: r.model, serial: r.serial_number, office: r.office };
}

export type UpdateComputerInput = { model: string; serial: string; office: string };

// Updates a computer asset's descriptive fields and writes an audit entry in
// one transaction. (Status changes flow through the custody actions instead.)
export async function updateComputerAsset(id: string, input: UpdateComputerInput): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const asset = await client.query<{ asset_tag: string }>(
      "SELECT asset_tag FROM assets WHERE id = $1 FOR UPDATE",
      [id]
    );
    if (asset.rowCount === 0) throw new Error("Asset not found.");
    const actor = await resolveActor(client);
    await client.query(
      "UPDATE assets SET model = $1, serial_number = $2, office = $3 WHERE id = $4",
      [input.model, input.serial, input.office, id]
    );
    await writeAuditLog(
      {
        actorUserId: actor.id, actorLabel: actor.label,
        action: "Updated computer asset", recordType: "asset", recordId: asset.rows[0].asset_tag,
        metadata: { model: input.model, office: input.office }
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
