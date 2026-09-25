import { getPool } from "@/lib/db";

export type SupplierCount = { name: string; count: number };

// Distinct suppliers across the catalog tables that record a supplier
// (accessories, consumables, components), with a total item count. Supplier is
// a free-text field today, not a first-class entity.
export async function listSuppliers(): Promise<SupplierCount[]> {
  const result = await getPool().query<{ supplier: string; n: string }>(
    `SELECT supplier, count(*)::text AS n FROM (
                  SELECT supplier FROM accessories WHERE supplier IS NOT NULL
       UNION ALL SELECT supplier FROM consumables WHERE supplier IS NOT NULL
       UNION ALL SELECT supplier FROM components  WHERE supplier IS NOT NULL
     ) t
     GROUP BY supplier
     ORDER BY supplier`
  );
  return result.rows.map((r) => ({ name: r.supplier, count: Number(r.n) }));
}

export type SupplierItem = { id: string; label: string; detail: string; href: string };
export type SupplierInventory = {
  name: string;
  accessories: SupplierItem[];
  consumables: SupplierItem[];
  components: SupplierItem[];
  total: number;
};

export async function getSupplierInventory(name: string): Promise<SupplierInventory> {
  const pool = getPool();
  const [accessories, consumables, components] = await Promise.all([
    pool.query<{ id: string; label: string; category: string | null }>(
      `SELECT id, name AS label, category FROM accessories WHERE supplier = $1 ORDER BY name`, [name]
    ),
    pool.query<{ id: string; label: string; category: string | null }>(
      `SELECT id, name AS label, category FROM consumables WHERE supplier = $1 ORDER BY name`, [name]
    ),
    pool.query<{ id: string; label: string; category: string | null }>(
      `SELECT id, name AS label, category FROM components WHERE supplier = $1 ORDER BY name`, [name]
    )
  ]);
  const accessoryItems = accessories.rows.map((r) => ({ id: r.id, label: r.label, detail: r.category ?? "Accessory", href: `/accessories/${r.id}` }));
  const consumableItems = consumables.rows.map((r) => ({ id: r.id, label: r.label, detail: r.category ?? "Consumable", href: `/consumables/${r.id}` }));
  const componentItems = components.rows.map((r) => ({ id: r.id, label: r.label, detail: r.category ?? "Component", href: `/components/${r.id}` }));
  return {
    name,
    accessories: accessoryItems,
    consumables: consumableItems,
    components: componentItems,
    total: accessoryItems.length + consumableItems.length + componentItems.length
  };
}
