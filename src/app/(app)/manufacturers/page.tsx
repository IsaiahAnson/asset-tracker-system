import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { listManufacturers } from "@/lib/manufacturers";

export default async function ManufacturersPage() {
  const manufacturers = await listManufacturers();

  return (
    <div className="usa-page">
      <div className="usa-page-header">
        <div>
          <h1 className="usa-page-title">Manufacturers</h1>
          <p className="usa-page-subtitle">
            Every manufacturer in the inventory. Open one to see all equipment from them across modules.
          </p>
        </div>
      </div>

      <section className="usa-card">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Manufacturers in use</span>
          <StatusTag tone="blue">{`${manufacturers.length} total`}</StatusTag>
        </div>
        <div className="usa-card__body">
          <div className="table-wrap">
            <table className="usa-table">
              <thead>
                <tr>
                  <th scope="col">Manufacturer</th>
                  <th scope="col">Items</th>
                </tr>
              </thead>
              <tbody>
                {manufacturers.length === 0 ? (
                  <tr>
                    <td colSpan={2}>No manufacturers recorded yet.</td>
                  </tr>
                ) : (
                  manufacturers.map((m) => (
                    <tr key={m.name}>
                      <td>
                        <Link href={`/manufacturers/${encodeURIComponent(m.name)}`}>{m.name}</Link>
                      </td>
                      <td className="font-mono">{m.count}</td>
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
