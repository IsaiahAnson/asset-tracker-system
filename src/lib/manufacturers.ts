import { getPool } from "@/lib/db";

export type ManufacturerCount = { name: string; count: number };

// Distinct manufacturers across every catalog table, with a total item count.
// Manufacturer is a free-text field today (not a first-class entity), so this
// aggregates by the stored string.
export async function listManufacturers(): Promise<ManufacturerCount[]> {
  const result = await getPool().query<{ manufacturer: string; n: string }>(
    `SELECT manufacturer, count(*)::text AS n FROM (
                  SELECT manufacturer FROM assets      WHERE manufacturer IS NOT NULL AND status <> 'retired'
       UNION ALL SELECT manufacturer FROM accessories WHERE manufacturer IS NOT NULL
       UNION ALL SELECT manufacturer FROM consumables WHERE manufacturer IS NOT NULL
       UNION ALL SELECT manufacturer FROM components  WHERE manufacturer IS NOT NULL
     ) t
     GROUP BY manufacturer
     ORDER BY manufacturer`
  );
  return result.rows.map((r) => ({ name: r.manufacturer, count: Number(r.n) }));
}

export type ManufacturerItem = {
  id: string;
  label: string;
  detail: string;
  href: string;
};
export type ManufacturerInventory = {
  name: string;
  assets: ManufacturerItem[];
  accessories: ManufacturerItem[];
  consumables: ManufacturerItem[];
  components: ManufacturerItem[];
  total: number;
};

export async function getManufacturerInventory(name: string): Promise<ManufacturerInventory> {
  const pool = getPool();
  const [assets, accessories, consumables, components] = await Promise.all([
    pool.query<{ id: string; asset_tag: string; model: string | null; status: string }>(
      `SELECT a.id, a.asset_tag, a.model, a.status
         FROM assets a
        WHERE a.manufacturer = $1 AND a.status <> 'retired'
        ORDER BY a.asset_tag`,
      [name]
    ),
    pool.query<{ id: string; name: string; category: string | null }>(
      `SELECT id, name, category FROM accessories WHERE manufacturer = $1 ORDER BY name`,
      [name]
    ),
    pool.query<{ id: string; name: string; category: string | null }>(
      `SELECT id, name, category FROM consumables WHERE manufacturer = $1 ORDER BY name`,
      [name]
    ),
    pool.query<{ id: string; name: string; category: string | null }>(
      `SELECT id, name, category FROM components WHERE manufacturer = $1 ORDER BY name`,
      [name]
    )
  ]);

  const assetItems = assets.rows.map((r) => ({
    id: r.id, label: r.asset_tag, detail: r.model ?? "Computer", href: `/assets/${r.id}`
  }));
  const accessoryItems = accessories.rows.map((r) => ({
    id: r.id, label: r.name, detail: r.category ?? "Accessory", href: `/accessories/${r.id}`
  }));
  const consumableItems = consumables.rows.map((r) => ({
    id: r.id, label: r.name, detail: r.category ?? "Consumable", href: `/consumables/${r.id}`
  }));
  const componentItems = components.rows.map((r) => ({
    id: r.id, label: r.name, detail: r.category ?? "Component", href: `/components/${r.id}`
  }));

  return {
    name,
    assets: assetItems,
    accessories: accessoryItems,
    consumables: consumableItems,
    components: componentItems,
    total: assetItems.length + accessoryItems.length + consumableItems.length + componentItems.length
  };
}
