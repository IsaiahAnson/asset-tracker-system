import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { statusLabel, statusTone } from "@/lib/assets";
import { searchAll } from "@/lib/search";

export default async function SearchPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = (await searchParams).q?.trim() ?? "";
  const results = q ? await searchAll(q) : { shortcuts: [], assets: [], people: [] };
  const total = results.shortcuts.length + results.assets.length + results.people.length;

  return (
    <div className="usa-page">
      <div className="usa-page-header">
        <div>
          <h1 className="usa-page-title">Search</h1>
        </div>
      </div>

      <section className="usa-card">
        <div className="usa-card__body">
          <form className="filter-bar" method="get" action="/search">
            <label className="sr-only" htmlFor="global-search-page">
              Search assets and people
            </label>
            <div className="filter-bar__search">
              <input
                id="global-search-page"
                name="q"
                className="usa-input"
                type="search"
                placeholder="Search assets, people"
                defaultValue={q}
              />
            </div>
            <button className="usa-button usa-button--primary usa-button--sm" type="submit">
              Search
            </button>
          </form>
        </div>
      </section>

      {!q ? (
        <p className="mt-3">Enter a search term to find assets or people.</p>
      ) : (
        <>
          <p className="mt-3">
            {total === 0
              ? `No results for "${q}".`
              : `${total} result${total === 1 ? "" : "s"} for "${q}".`}
          </p>

          {results.shortcuts.length > 0 ? (
            <section className="usa-card mt-3">
              <div className="usa-card__header">
                <span className="usa-card__header-title">Quick actions</span>
              </div>
              <div className="usa-card__body">
                <ul className="search-shortcuts">
                  {results.shortcuts.map((s) => (
                    <li key={s.href}>
                      <Link className="search-shortcut" href={s.href}>
                        <span className="search-shortcut__label">{s.label}</span>
                        <span className="search-shortcut__desc">{s.description}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}

          {results.assets.length > 0 ? (
            <section className="usa-card mt-3">
              <div className="usa-card__header">
                <span className="usa-card__header-title">Assets ({results.assets.length})</span>
              </div>
              <div className="usa-card__body">
                <div className="table-wrap">
                  <table className="usa-table">
                    <thead>
                      <tr>
                        <th scope="col">Asset ID</th>
                        <th scope="col">Type</th>
                        <th scope="col">Serial</th>
                        <th scope="col">Custodian</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.assets.map((asset) => (
                        <tr key={asset.id}>
                          <td className="font-mono">
                            <Link href={`/assets/${asset.id}`}>{asset.assetTag}</Link>
                          </td>
                          <td>{asset.model}</td>
                          <td className="font-mono">{asset.serial ?? "—"}</td>
                          <td>{asset.custodian}</td>
                          <td>
                            <StatusTag tone={statusTone(asset.status)}>
                              {statusLabel(asset.status)}
                            </StatusTag>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : null}

          {results.people.length > 0 ? (
            <section className="usa-card mt-3">
              <div className="usa-card__header">
                <span className="usa-card__header-title">People ({results.people.length})</span>
              </div>
              <div className="usa-card__body">
                <div className="table-wrap">
                  <table className="usa-table">
                    <thead>
                      <tr>
                        <th scope="col">Name</th>
                        <th scope="col">Email</th>
                        <th scope="col">Group</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.people.map((person) => (
                        <tr key={person.id}>
                          <td>
                            <Link href="/people">{person.displayName}</Link>
                          </td>
                          <td>{person.email}</td>
                          <td>{person.group ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : null}

        </>
      )}
    </div>
  );
}
