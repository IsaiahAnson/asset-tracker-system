import { getPool } from "@/lib/db";

export type PurchaseOrderSummary = {
  orderNumber: string;
  supplier: string | null;
  items: number;
  total: string | null;
  earliest: string | null;
  latest: string | null;
};

// Purchase orders are derived from the order_number recorded on catalog items
// (accessories, consumables, components). Order number is a free-text field
// today, not a first-class PO entity; this aggregates by it.
export async function listPurchaseOrders(): Promise<PurchaseOrderSummary[]> {
  const r = await getPool().query<{
    order_number: string; supplier: string | null; items: number; total: string | null;
    earliest: string | null; latest: string | null;
  }>(
    `SELECT order_number,
            max(supplier) AS supplier,
            count(*)::int AS items,
            sum(cost)::text AS total,
            to_char(min(pdate), 'YYYY-MM-DD') AS earliest,
            to_char(max(pdate), 'YYYY-MM-DD') AS latest
       FROM (
                  SELECT order_number, supplier, purchase_cost AS cost, purchase_date AS pdate FROM accessories WHERE order_number IS NOT NULL
         UNION ALL SELECT order_number, supplier, purchase_cost,        purchase_date         FROM consumables WHERE order_number IS NOT NULL
         UNION ALL SELECT order_number, supplier, purchase_cost,        purchase_date         FROM components  WHERE order_number IS NOT NULL
       ) t
      GROUP BY order_number
      ORDER BY order_number`
  );
  return r.rows.map((x) => ({
    orderNumber: x.order_number,
    supplier: x.supplier,
    items: x.items,
    total: x.total,
    earliest: x.earliest,
    latest: x.latest
  }));
}

export type PurchaseOrderItem = {
  id: string;
  label: string;
  type: string;
  href: string;
  cost: string | null;
  date: string | null;
};
export type PurchaseOrderDetail = {
  orderNumber: string;
  supplier: string | null;
  total: string | null;
  items: PurchaseOrderItem[];
};

export async function getPurchaseOrder(orderNumber: string): Promise<PurchaseOrderDetail | null> {
  const pool = getPool();
  const [accessories, consumables, components] = await Promise.all([
    pool.query<{ id: string; label: string; supplier: string | null; cost: string | null; pdate: string | null }>(
      `SELECT id, name AS label, supplier, purchase_cost::text AS cost, to_char(purchase_date,'YYYY-MM-DD') AS pdate FROM accessories WHERE order_number = $1 ORDER BY name`, [orderNumber]
    ),
    pool.query<{ id: string; label: string; supplier: string | null; cost: string | null; pdate: string | null }>(
      `SELECT id, name AS label, supplier, purchase_cost::text AS cost, to_char(purchase_date,'YYYY-MM-DD') AS pdate FROM consumables WHERE order_number = $1 ORDER BY name`, [orderNumber]
    ),
    pool.query<{ id: string; label: string; supplier: string | null; cost: string | null; pdate: string | null }>(
      `SELECT id, name AS label, supplier, purchase_cost::text AS cost, to_char(purchase_date,'YYYY-MM-DD') AS pdate FROM components WHERE order_number = $1 ORDER BY name`, [orderNumber]
    )
  ]);

  const items: PurchaseOrderItem[] = [
    ...accessories.rows.map((r) => ({ id: r.id, label: r.label, type: "Accessory", href: `/accessories/${r.id}`, cost: r.cost, date: r.pdate })),
    ...consumables.rows.map((r) => ({ id: r.id, label: r.label, type: "Consumable", href: `/consumables/${r.id}`, cost: r.cost, date: r.pdate })),
    ...components.rows.map((r) => ({ id: r.id, label: r.label, type: "Component", href: `/components/${r.id}`, cost: r.cost, date: r.pdate }))
  ];
  if (items.length === 0) return null;

  const supplierRow =
    accessories.rows[0] ?? consumables.rows[0] ?? components.rows[0];
  const total = items.reduce((sum, i) => sum + (i.cost ? Number(i.cost) : 0), 0);

  return {
    orderNumber,
    supplier: supplierRow?.supplier ?? null,
    total: total ? total.toFixed(2) : null,
    items
  };
}
