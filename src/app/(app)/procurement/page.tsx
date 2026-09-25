import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { listPurchaseOrders } from "@/lib/purchase-orders";

function money(v: string | null): string {
  return v ? `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—";
}

export default async function ProcurementPage() {
  const orders = await listPurchaseOrders();
  const grandTotal = orders.reduce((s, o) => s + (o.total ? Number(o.total) : 0), 0);

  return (
    <div className="usa-page">
      <div className="usa-page-header">
        <div>
          <h1 className="usa-page-title">Procurement</h1>
          <p className="usa-page-subtitle">
            Purchase orders, derived from the order numbers recorded against catalog items.
          </p>
        </div>
      </div>

      <section className="stat-grid" aria-label="Procurement summary">
        <div className="stat-card">
          <div className="stat-label">Purchase orders</div>
          <div className="stat-value">{orders.length.toLocaleString("en-US")}</div>
          <div className="stat-card__detail">Distinct order numbers</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Line items</div>
          <div className="stat-value">{orders.reduce((s, o) => s + o.items, 0).toLocaleString("en-US")}</div>
          <div className="stat-card__detail">Across all orders</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Recorded spend</div>
          <div className="stat-value success">{money(grandTotal ? String(grandTotal) : null)}</div>
          <div className="stat-card__detail">Sum of recorded item costs</div>
        </div>
      </section>

      <section className="usa-card">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Purchase orders</span>
          <StatusTag tone="blue">{`${orders.length} total`}</StatusTag>
        </div>
        <div className="usa-card__body">
          <div className="table-wrap">
            <table className="usa-table">
              <thead>
                <tr>
                  <th scope="col">Order number</th>
                  <th scope="col">Supplier</th>
                  <th scope="col">Items</th>
                  <th scope="col">Total</th>
                  <th scope="col">Ordered</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No purchase orders recorded yet.</td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.orderNumber}>
                      <td className="font-mono">
                        <Link href={`/procurement/${encodeURIComponent(o.orderNumber)}`}>{o.orderNumber}</Link>
                      </td>
                      <td>
                        {o.supplier ? (
                          <Link href={`/suppliers/${encodeURIComponent(o.supplier)}`}>{o.supplier}</Link>
                        ) : "—"}
                      </td>
                      <td className="font-mono">{o.items}</td>
                      <td className="font-mono">{money(o.total)}</td>
                      <td className="font-mono">{o.earliest ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
