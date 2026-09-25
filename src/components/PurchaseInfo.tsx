import Link from "next/link";

// Renders the procurement metadata for a catalog item (supplier, order number,
// cost, purchase date). The order number links to its purchase order. Returns
// null when nothing is recorded so the card does not show an empty section.
export function PurchaseInfo({
  supplier,
  orderNumber,
  purchaseCost,
  purchaseDate
}: {
  supplier: string | null;
  orderNumber: string | null;
  purchaseCost: string | null;
  purchaseDate: string | null;
}) {
  if (!supplier && !orderNumber && !purchaseCost && !purchaseDate) return null;
  const cost = purchaseCost ? `$${Number(purchaseCost).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—";
  return (
    <section className="usa-card mt-3">
      <div className="usa-card__header">
        <span className="usa-card__header-title">Purchase information</span>
      </div>
      <div className="usa-card__body">
        <dl className="detail-grid">
          <div>
            <dt>Supplier</dt>
            <dd>
              {supplier ? (
                <Link href={`/suppliers/${encodeURIComponent(supplier)}`}>{supplier}</Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt>Order number</dt>
            <dd className="font-mono">
              {orderNumber ? (
                <Link href={`/procurement/${encodeURIComponent(orderNumber)}`}>{orderNumber}</Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt>Purchase cost</dt>
            <dd className="font-mono">{cost}</dd>
          </div>
          <div>
            <dt>Purchase date</dt>
            <dd className="font-mono">{purchaseDate ?? "—"}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
