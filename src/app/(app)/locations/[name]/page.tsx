import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { getLocationInventory, type LocationItem } from "@/lib/locations";

function ItemTable({ title, items }: { title: string; items: LocationItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="usa-card mt-3">
      <div className="usa-card__header">
        <span className="usa-card__header-title">{title}</span>
        <StatusTag tone="gray">{`${items.length}`}</StatusTag>
      </div>
      <div className="usa-card__body">
        <div className="table-wrap">
          <table className="usa-table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Detail</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link href={item.href}>{item.label}</Link>
                  </td>
                  <td>{item.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default async function LocationDetailPage({
  params
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const inv = await getLocationInventory(decoded);

  return (
    <div className="usa-page">
      <div className="usa-page-header">
        <div>
          <Link className="record-id" href="/locations">
            BACK TO LOCATIONS
          </Link>
          <h1 className="usa-page-title">{decoded}</h1>
          <p className="usa-page-subtitle">Everything stored at this location.</p>
        </div>
        <div className="page-actions">
          <StatusTag tone="blue">{`${inv.total} item${inv.total === 1 ? "" : "s"}`}</StatusTag>
        </div>
      </div>

      {inv.total === 0 ? (
        <section className="usa-card">
          <div className="usa-card__body">
            <p>No items recorded at {decoded}.</p>
          </div>
        </section>
      ) : (
        <>
          <ItemTable title="Accessories" items={inv.accessories} />
          <ItemTable title="Consumables" items={inv.consumables} />
          <ItemTable title="Components" items={inv.components} />
        </>
      )}
    </div>
  );
}
