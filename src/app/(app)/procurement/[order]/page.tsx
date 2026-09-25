import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { getPurchaseOrder } from "@/lib/purchase-orders";

function money(v: string | null): string {
  return v ? `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—";
}

export default async function PurchaseOrderDetailPage({
  params
}: {
  params: Promise<{ order: string }>;
}) {
  const { order } = await params;
  const decoded = decodeURIComponent(order);
  const po = await getPurchaseOrder(decoded);

  if (!po) {
    return (
      <div className="usa-page">
        <div className="usa-page-header">
          <h1 className="usa-page-title">Purchase order not found</h1>
        </div>
        <Link className="usa-button usa-button--outline" href="/procurement">
          Back to procurement
        </Link>
      </div>
    );
  }

  return (
    <div className="usa-page">
      <div className="usa-page-header">
        <div>
          <Link className="record-id" href="/procurement">
            BACK TO PROCUREMENT
          </Link>
          <h1 className="usa-page-title font-mono">{po.orderNumber}</h1>
          <p className="usa-page-subtitle">
            {po.supplier ? (
              <>Supplier: <Link href={`/suppliers/${encodeURIComponent(po.supplier)}`}>{po.supplier}</Link></>
            ) : (
              "Purchase order"
            )}
          </p>
        </div>
        <div className="page-actions">
          <StatusTag tone="blue">{`${po.items.length} item${po.items.length === 1 ? "" : "s"}`}</StatusTag>
          <StatusTag tone="green">{`Total ${money(po.total)}`}</StatusTag>
        </div>
      </div>

      <section className="usa-card">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Order line items</span>
        </div>
        <div className="usa-card__body">
          <div className="table-wrap">
            <table className="usa-table">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Type</th>
                  <th scope="col">Cost</th>
                  <th scope="col">Purchase date</th>
                </tr>
              </thead>
              <tbody>
                {po.items.map((item) => (
                  <tr key={`${item.type}-${item.id}`}>
                    <td>
                      <Link href={item.href}>{item.label}</Link>
                    </td>
                    <td>{item.type}</td>
                    <td className="font-mono">{money(item.cost)}</td>
                    <td className="font-mono">{item.date ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
