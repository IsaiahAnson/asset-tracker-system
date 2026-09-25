import { getPool } from "@/lib/db";

export type LocationCount = { name: string; count: number };

// Distinct storage locations across the catalog tables that carry a location
// (accessories, consumables, components), with a total item count.
export async function listLocations(): Promise<LocationCount[]> {
  const result = await getPool().query<{ location: string; n: string }>(
    `SELECT location, count(*)::text AS n FROM (
       SELECT location FROM accessories WHERE location IS NOT NULL
       UNION ALL SELECT location FROM consumables WHERE location IS NOT NULL
       UNION ALL SELECT location FROM components WHERE location IS NOT NULL
     ) t
     GROUP BY location
     ORDER BY location`
  );
  return result.rows.map((r) => ({ name: r.location, count: Number(r.n) }));
}

export type LocationItem = { id: string; label: string; detail: string; href: string };
export type LocationInventory = {
  name: string;
  accessories: LocationItem[];
  consumables: LocationItem[];
  components: LocationItem[];
  total: number;
};

export async function getLocationInventory(name: string): Promise<LocationInventory> {
  const pool = getPool();
  const [accessories, consumables, components] = await Promise.all([
    pool.query<{ id: string; name: string; category: string | null }>(
      `SELECT id, name, category FROM accessories WHERE location = $1 ORDER BY name`,
      [name]
    ),
    pool.query<{ id: string; name: string; category: string | null }>(
      `SELECT id, name, category FROM consumables WHERE location = $1 ORDER BY name`,
      [name]
    ),
    pool.query<{ id: string; name: string; category: string | null }>(
      `SELECT id, name, category FROM components WHERE location = $1 ORDER BY name`,
      [name]
    )
  ]);
  const accessoryItems = accessories.rows.map((r) => ({ id: r.id, label: r.name, detail: r.category ?? "Accessory", href: `/accessories/${r.id}` }));
  const consumableItems = consumables.rows.map((r) => ({ id: r.id, label: r.name, detail: r.category ?? "Consumable", href: `/consumables/${r.id}` }));
  const componentItems = components.rows.map((r) => ({ id: r.id, label: r.name, detail: r.category ?? "Component", href: `/components/${r.id}` }));
  return {
    name,
    accessories: accessoryItems,
    consumables: consumableItems,
    components: componentItems,
    total: accessoryItems.length + consumableItems.length + componentItems.length
  };
}
