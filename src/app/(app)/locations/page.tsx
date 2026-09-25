import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { listLocations } from "@/lib/locations";

export default async function LocationsPage() {
  const locations = await listLocations();
  return (
    <div className="usa-page">
      <div className="usa-page-header">
        <div>
          <h1 className="usa-page-title">Locations</h1>
          <p className="usa-page-subtitle">
            Storage locations across the catalog. Open one to see everything stored there.
          </p>
        </div>
      </div>

      <section className="usa-card">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Locations in use</span>
          <StatusTag tone="blue">{`${locations.length} total`}</StatusTag>
        </div>
        <div className="usa-card__body">
          <div className="table-wrap">
            <table className="usa-table">
              <thead>
                <tr>
                  <th scope="col">Location</th>
                  <th scope="col">Items</th>
                </tr>
              </thead>
              <tbody>
                {locations.length === 0 ? (
                  <tr>
                    <td colSpan={2}>No locations recorded yet.</td>
                  </tr>
                ) : (
                  locations.map((l) => (
                    <tr key={l.name}>
                      <td>
                        <Link href={`/locations/${encodeURIComponent(l.name)}`}>{l.name}</Link>
                      </td>
                      <td className="font-mono">{l.count}</td>
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
