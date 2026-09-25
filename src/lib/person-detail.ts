import { getPool } from "@/lib/db";
import { formatEastern } from "@/lib/audit";

export type PersonDetail = {
  id: string;
  displayName: string;
  email: string;
  group: string | null;
  roles: string;
  firearmAccess: boolean;
  active: boolean;
};

export async function getPersonDetail(id: string): Promise<PersonDetail | null> {
  const result = await getPool().query<{
    id: string;
    display_name: string;
    email: string;
    group_name: string | null;
    roles: string | null;
    firearm_access: boolean;
    active: boolean;
  }>(
    `SELECT u.id, u.display_name, u.email,
            g.name AS group_name,
            COALESCE(string_agg(DISTINCT r.name, ', '), '') AS roles,
            u.firearm_access, u.active
       FROM app_users u
       LEFT JOIN groups g ON g.id = u.group_id
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.id = $1
      GROUP BY u.id, g.name`,
    [id]
  );
  if (result.rowCount === 0) return null;
  const r = result.rows[0];
  return {
    id: r.id,
    displayName: r.display_name,
    email: r.email,
    group: r.group_name,
    roles: r.roles ?? "",
    firearmAccess: r.firearm_access,
    active: r.active
  };
}

export type AssignedItem = {
  id: string;
  label: string;
  detail: string;
  href: string;
  assignedOn: string | null;
};

// Assets where this person is the current custodian.
export async function listPersonAssets(id: string): Promise<AssignedItem[]> {
  const result = await getPool().query<{
    id: string; asset_tag: string; manufacturer: string | null; model: string | null; status: string;
  }>(
    `SELECT id, asset_tag, manufacturer, model, status
       FROM assets
      WHERE current_custodian_id = $1 AND status <> 'retired'
      ORDER BY asset_tag`,
    [id]
  );
  return result.rows.map((r) => ({
    id: r.id,
    label: r.asset_tag,
    detail: [r.manufacturer, r.model].filter(Boolean).join(" ") || "Computer",
    href: `/assets/${r.id}`,
    assignedOn: null
  }));
}

export async function listPersonAccessories(id: string): Promise<AssignedItem[]> {
  const result = await getPool().query<{
    accessory_id: string; name: string; created_at: string;
  }>(
    `SELECT ac.accessory_id, a.name, to_char(ac.created_at, 'YYYY-MM-DD') AS created_at
       FROM accessory_checkouts ac
       JOIN accessories a ON a.id = ac.accessory_id
      WHERE ac.assigned_user_id = $1
      ORDER BY ac.created_at DESC`,
    [id]
  );
  return result.rows.map((r) => ({
    id: r.accessory_id,
    label: r.name,
    detail: "Accessory",
    href: `/accessories/${r.accessory_id}`,
    assignedOn: r.created_at
  }));
}

export async function listPersonConsumables(id: string): Promise<AssignedItem[]> {
  const result = await getPool().query<{
    consumable_id: string; name: string; created_at: string;
  }>(
    `SELECT ci.consumable_id, c.name, to_char(ci.created_at, 'YYYY-MM-DD') AS created_at
       FROM consumable_issues ci
       JOIN consumables c ON c.id = ci.consumable_id
      WHERE ci.assigned_user_id = $1
      ORDER BY ci.created_at DESC`,
    [id]
  );
  return result.rows.map((r) => ({
    id: r.consumable_id,
    label: r.name,
    detail: "Consumable",
    href: `/consumables/${r.consumable_id}`,
    assignedOn: r.created_at
  }));
}

export type PersonActivity = {
  id: string;
  timestamp: string;
  action: string;
  record: string;
  result: string;
};

// Audit entries for actions this person performed.
export async function listPersonActivity(id: string, limit = 25): Promise<PersonActivity[]> {
  const result = await getPool().query<{
    audit_number: string; action: string; record_id: string; result: string; created_at: string;
  }>(
    `SELECT audit_number, action, record_id, result, created_at
       FROM audit_log
      WHERE actor_user_id = $1
      ORDER BY created_at DESC
      LIMIT ${limit}`,
    [id]
  );
  return result.rows.map((r) => ({
    id: r.audit_number,
    timestamp: formatEastern(r.created_at),
    action: r.action,
    record: r.record_id,
    result: r.result
  }));
}
