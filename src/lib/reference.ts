import { getPool } from "@/lib/db";

export type CategoryRef = { id: string; code: string; name: string; highSensitivity: boolean };
export type RoleRef = { id: string; code: string; name: string; description: string };
export type GroupRef = { id: string; code: string; name: string };
export type NameCount = { name: string; count: number };

export type ReferenceData = {
  categories: CategoryRef[];
  roles: RoleRef[];
  groups: GroupRef[];
  manufacturers: NameCount[];
  suppliers: NameCount[];
  locations: NameCount[];
};

export async function getReferenceData(): Promise<ReferenceData> {
  const pool = getPool();
  const [cats, roles, groups, mfg, sup, loc] = await Promise.all([
    pool.query<{ id: string; code: string; name: string; high_sensitivity: boolean }>(
      "SELECT id, code, name, high_sensitivity FROM asset_categories ORDER BY name"
    ),
    pool.query<{ id: string; code: string; name: string; description: string }>(
      "SELECT id, code, name, description FROM roles ORDER BY name"
    ),
    pool.query<{ id: string; code: string; name: string }>(
      "SELECT id, code, name FROM groups ORDER BY code"
    ),
    pool.query<{ name: string; n: number }>(
      `SELECT name, count(*)::int AS n FROM (
                    SELECT manufacturer AS name FROM assets      WHERE manufacturer IS NOT NULL
         UNION ALL SELECT manufacturer       FROM accessories WHERE manufacturer IS NOT NULL
         UNION ALL SELECT manufacturer       FROM consumables WHERE manufacturer IS NOT NULL
         UNION ALL SELECT manufacturer       FROM components  WHERE manufacturer IS NOT NULL
       ) m GROUP BY name ORDER BY n DESC, name`
    ),
    pool.query<{ name: string; n: number }>(
      `SELECT name, count(*)::int AS n FROM (
                    SELECT supplier AS name FROM accessories WHERE supplier IS NOT NULL
         UNION ALL SELECT supplier       FROM consumables WHERE supplier IS NOT NULL
         UNION ALL SELECT supplier       FROM components  WHERE supplier IS NOT NULL
       ) s GROUP BY name ORDER BY n DESC, name`
    ),
    pool.query<{ name: string; n: number }>(
      `SELECT name, count(*)::int AS n FROM (
         SELECT office AS name FROM assets WHERE office IS NOT NULL
         UNION ALL SELECT location FROM accessories WHERE location IS NOT NULL
         UNION ALL SELECT location FROM consumables WHERE location IS NOT NULL
         UNION ALL SELECT location FROM components WHERE location IS NOT NULL
       ) l GROUP BY name ORDER BY n DESC, name`
    )
  ]);

  return {
    categories: cats.rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      highSensitivity: r.high_sensitivity
    })),
    roles: roles.rows.map((r) => ({ id: r.id, code: r.code, name: r.name, description: r.description })),
    groups: groups.rows.map((r) => ({ id: r.id, code: r.code, name: r.name })),
    manufacturers: mfg.rows.map((r) => ({ name: r.name, count: r.n })),
    suppliers: sup.rows.map((r) => ({ name: r.name, count: r.n })),
    locations: loc.rows.map((r) => ({ name: r.name, count: r.n }))
  };
}
