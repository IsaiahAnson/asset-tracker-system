import { getPool } from "@/lib/db";

export type PersonRow = {
  id: string;
  displayName: string;
  email: string;
  group: string | null;
  roles: string;
  assets: number;
  accessories: number;
  consumables: number;
  firearmAccess: boolean;
  active: boolean;
};

export async function listPeople(): Promise<PersonRow[]> {
  const result = await getPool().query<{
    id: string;
    display_name: string;
    email: string;
    group_code: string | null;
    firearm_access: boolean;
    active: boolean;
    roles: string | null;
    assets: number;
    accessories: number;
    consumables: number;
  }>(
    `SELECT u.id,
            u.display_name,
            u.email,
            g.code AS group_code,
            u.firearm_access,
            u.active,
            COALESCE(string_agg(DISTINCT r.name, ', '), '') AS roles,
            (SELECT count(*) FROM assets a
              WHERE a.current_custodian_id = u.id AND a.status <> 'retired')::int AS assets,
            (SELECT count(*) FROM accessory_checkouts ac WHERE ac.assigned_user_id = u.id)::int AS accessories,
            (SELECT count(*) FROM consumable_issues ci WHERE ci.assigned_user_id = u.id)::int AS consumables
       FROM app_users u
       LEFT JOIN groups g ON g.id = u.group_id
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
      GROUP BY u.id, g.code
      ORDER BY u.display_name`
  );

  return result.rows.map((r) => ({
    id: r.id,
    displayName: r.display_name,
    email: r.email,
    group: r.group_code,
    roles: r.roles ?? "",
    assets: r.assets,
    accessories: r.accessories,
    consumables: r.consumables,
    firearmAccess: r.firearm_access,
    active: r.active
  }));
}

export type PeopleStats = {
  total: number;
  active: number;
  firearmAccess: number;
  itemsAssigned: number;
};

export async function getPeopleStats(): Promise<PeopleStats> {
  const pool = getPool();
  const [users, items] = await Promise.all([
    pool.query<{ total: string; active: string; firearm: string }>(
      `SELECT count(*)::text AS total,
              count(*) FILTER (WHERE active)::text AS active,
              count(*) FILTER (WHERE firearm_access)::text AS firearm
         FROM app_users`
    ),
    pool.query<{ n: string }>(
      `SELECT (
         (SELECT count(*) FROM assets WHERE current_custodian_id IS NOT NULL AND status <> 'retired') +
         (SELECT count(*) FROM accessory_checkouts) +
         (SELECT count(*) FROM consumable_issues)
       )::text AS n`
    )
  ]);
  return {
    total: Number(users.rows[0].total),
    active: Number(users.rows[0].active),
    firearmAccess: Number(users.rows[0].firearm),
    itemsAssigned: Number(items.rows[0].n)
  };
}
