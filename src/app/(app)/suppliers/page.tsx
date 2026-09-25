import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { listSuppliers } from "@/lib/suppliers";

export default async function SuppliersPage() {
  const suppliers = await listSuppliers();
  return (
    <div className="usa-page">
      <div className="usa-page-header">
        <div>
          <h1 className="usa-page-title">Suppliers</h1>
          <p className="usa-page-subtitle">
            Vendors the inventory is sourced from. Open one to see everything they supply.
          </p>
        </div>
      </div>

      <section className="usa-card">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Suppliers in use</span>
          <StatusTag tone="blue">{`${suppliers.length} total`}</StatusTag>
        </div>
        <div className="usa-card__body">
          <div className="table-wrap">
            <table className="usa-table">
              <thead>
                <tr>
                  <th scope="col">Supplier</th>
                  <th scope="col">Items</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={2}>No suppliers recorded yet.</td>
                  </tr>
                ) : (
                  suppliers.map((s) => (
                    <tr key={s.name}>
                      <td>
                        <Link href={`/suppliers/${encodeURIComponent(s.name)}`}>{s.name}</Link>
                      </td>
                      <td className="font-mono">{s.count}</td>
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
