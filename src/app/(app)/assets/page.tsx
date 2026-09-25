import Link from "next/link";
import { StatusTag } from "@/components/StatusTag";
import { SubmitButton } from "@/components/SubmitButton";
import { SortableHeader } from "@/components/SortableHeader";
import { Pagination } from "@/components/Pagination";
import { FilterPanel } from "@/components/FilterPanel";
import { ReturnDateField } from "@/components/ReturnDateField";
import { CustomFieldInputs } from "@/components/CustomFieldInputs";
import { buildHref } from "@/lib/querystring";
import { canActingUserWrite } from "@/lib/authz";
import { getAssetCustomFields } from "@/lib/custom-fields";
import {
  listComputerAssets,
  listComputerOffices,
  countComputerAssets,
  countFilteredComputerAssets,
  listDisposedComputerAssets,
  listDisposedOffices,
  listUsers,
  statusLabel,
  statusTone,
  ASSET_PAGE_SIZE
} from "@/lib/assets";
import {
  createComputerAssetAction,
  transferCustodyAction,
  dispositionAssetAction,
  checkInAssetAction
} from "./actions";

export default async function AssetsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; office?: string; status?: string; sort?: string; dir?: string; page?: string; dq?: string; doffice?: string }>;
}) {
  const sp = await searchParams;
  const filters = {
    q: sp.q?.trim() || undefined,
    office: sp.office || undefined,
    status: sp.status || undefined
  };
  const disposedFilters = { q: sp.dq?.trim() || undefined, office: sp.doffice || undefined };
  const disposedActive = [disposedFilters.q, disposedFilters.office].filter(Boolean).length;
  const hasFilters = Boolean(filters.q || filters.office || filters.status);
  const dir = sp.dir === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(sp.page) || 1);
  const sortOptions = { sort: sp.sort, dir, page, pageSize: ASSET_PAGE_SIZE } as const;
  // Snapshot of the active query for sort/pagination links.
  const headerParams: Record<string, string | undefined> = {
    q: filters.q,
    office: filters.office,
    status: filters.status,
    sort: sp.sort,
    dir: sp.sort ? dir : undefined
  };
  const [computerAssets, offices, users, totalRecorded, totalFiltered, disposedAssets, canWrite, customFields] = await Promise.all([
    listComputerAssets(filters, sortOptions),
    listComputerOffices(),
    listUsers(),
    countComputerAssets(),
    countFilteredComputerAssets(filters),
    listDisposedComputerAssets(disposedFilters),
    canActingUserWrite(),
    getAssetCustomFields(null)
  ]);
  const disposedOffices = await listDisposedOffices();
  return (
    <div className="usa-page usa-page--wide">
      <div className="usa-page-header">
        <div>
          <h1 className="usa-page-title">Assets</h1>
        </div>
        <div className="page-actions">
          <button
            className="usa-button usa-button--outline"
            type="button"
            disabled
            aria-disabled="true"
            title="The migration utility is on the roadmap. This control will be enabled when that module ships."
          >
            Import legacy export (coming soon)
          </button>
          {canWrite ? (
            <Link className="usa-button usa-button--primary" href="/assets#asset-create">
              New computer asset
            </Link>
          ) : null}
        </div>
      </div>

      {canWrite ? (
      <section className="usa-card" id="asset-create">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Create computer asset</span>
        </div>
        <div className="usa-card__body">
          <form className="asset-form-grid" action={createComputerAssetAction}>
            <div className="usa-form-group">
              <label className="usa-label" htmlFor="asset-type">
                Asset type
              </label>
              <select id="asset-type" name="type" className="usa-select" defaultValue="laptop">
                <option value="laptop">Laptop</option>
                <option value="desktop">Desktop</option>
                <option value="tablet">Tablet</option>
              </select>
            </div>
            <div className="usa-form-group">
              <label className="usa-label" htmlFor="asset-serial">
                Serial number
              </label>
              <input id="asset-serial" name="serial" className="usa-input" type="text" required placeholder="Manufacturer serial number" />
            </div>
            <div className="usa-form-group">
              <label className="usa-label" htmlFor="asset-office-new">
                Office
              </label>
              <input id="asset-office-new" name="office" className="usa-input" type="text" required placeholder="Office or group" />
            </div>
            <div className="usa-form-group">
              <label className="usa-label" htmlFor="asset-custodian">
                Initial custodian
              </label>
              <input id="asset-custodian" name="custodian" className="usa-input" type="text" placeholder="Optional until assignment" />
            </div>
            <CustomFieldInputs fields={customFields} />
            <div className="asset-form-grid__full flex-end gap-2">
              <button className="usa-button usa-button--secondary" type="reset">
                Reset
              </button>
              <SubmitButton className="usa-button usa-button--primary" pendingText="Creating...">
                Create asset
              </SubmitButton>
            </div>
          </form>
        </div>
      </section>
      ) : null}

      <section className="usa-card mt-3" id="asset-inventory">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Computer inventory</span>
          <StatusTag tone="green">Active module</StatusTag>
        </div>
        <div className="usa-toolbar">
          <form className="filter-bar" method="get" action="/assets">
            <label className="sr-only" htmlFor="asset-search">
              Search assets
            </label>
            <div className="filter-bar__search">
              <input id="asset-search" name="q" className="usa-input" type="search" placeholder="Search asset ID, serial, custodian" defaultValue={filters.q ?? ""} />
            </div>
            <label className="sr-only" htmlFor="asset-office">
              Office
            </label>
            <select id="asset-office" name="office" className="usa-select" defaultValue={filters.office ?? ""}>
              <option value="">All offices</option>
              {offices.map((office) => (
                <option key={office} value={office}>
                  {office}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="asset-status">
              Status
            </label>
            <select id="asset-status" name="status" className="usa-select" defaultValue={filters.status ?? ""}>
              <option value="">All statuses</option>
              <option value="assigned">Assigned</option>
              <option value="available">Available</option>
              <option value="overdue">Overdue</option>
              <option value="in_transfer">In transfer</option>
              <option value="pending_approval">Needs approval</option>
            </select>
            <button className="usa-button usa-button--primary usa-button--sm" type="submit">
              Filter
            </button>
            {hasFilters ? (
              <Link className="usa-button usa-button--outline usa-button--sm" href="/assets">
                Clear
              </Link>
            ) : null}
          </form>
        </div>
        <div className="usa-card__body">
          <div className="table-wrap">
            <table className="usa-table">
              <thead>
                <tr>
                  <SortableHeader label="Asset ID" column="assetTag" basePath="/assets" searchParams={headerParams} />
                  <SortableHeader label="Type" column="model" basePath="/assets" searchParams={headerParams} />
                  <SortableHeader label="Serial" column="serial" basePath="/assets" searchParams={headerParams} />
                  <SortableHeader label="Custodian" column="custodian" basePath="/assets" searchParams={headerParams} />
                  <SortableHeader label="Office" column="office" basePath="/assets" searchParams={headerParams} />
                  <SortableHeader label="Status" column="status" basePath="/assets" searchParams={headerParams} />
                  <SortableHeader label="Due back" column="dueBack" basePath="/assets" searchParams={headerParams} />
                  <th scope="col">Last action</th>
                  {canWrite ? <th scope="col">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {computerAssets.length === 0 ? (
                  <tr>
                    <td colSpan={canWrite ? 9 : 8}>
                      {hasFilters
                        ? "No computer assets match your filters."
                        : totalRecorded === 0
                          ? "No computer assets recorded yet."
                          : `All ${totalRecorded} recorded computer assets have been retired. Use the form below to create a new one.`}
                    </td>
                  </tr>
                ) : (
                  computerAssets.map((asset) => (
                    <tr key={asset.id}>
                      <td className="font-mono">
                        <Link href={`/assets/${asset.id}`}>{asset.assetTag}</Link>
                      </td>
                      <td>
                        {asset.model ? (
                          <Link href={`/assets?q=${encodeURIComponent(asset.model)}`}>{asset.model}</Link>
                        ) : "—"}
                      </td>
                      <td className="font-mono">{asset.serial}</td>
                      <td>
                        {asset.custodianId ? (
                          <Link href={`/people/${asset.custodianId}`}>{asset.custodian}</Link>
                        ) : (
                          asset.custodian
                        )}
                      </td>
                      <td>
                        {asset.office ? (
                          <Link href={`/assets?office=${encodeURIComponent(asset.office)}`}>{asset.office}</Link>
                        ) : "—"}
                      </td>
                      <td>
                        <StatusTag tone={statusTone(asset.status)}>
                          {statusLabel(asset.status)}
                        </StatusTag>
                      </td>
                      <td>
                        {asset.expectedReturn ? (
                          asset.overdue ? (
                            <StatusTag tone="red">{`Overdue ${asset.expectedReturn}`}</StatusTag>
                          ) : (
                            <span className="font-mono">{asset.expectedReturn}</span>
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{asset.status === "available" ? "Available for issue" : "In service"}</td>
                      {canWrite ? (
                      <td>
                        <div className="row-actions">
                          <form action={transferCustodyAction} className="row-actions__form">
                            <input type="hidden" name="assetTag" value={asset.assetTag} />
                            <label className="sr-only" htmlFor={`xfer-${asset.id}`}>
                              Transfer custodian for {asset.assetTag}
                            </label>
                            <select
                              id={`xfer-${asset.id}`}
                              name="toUserId"
                              className="usa-select usa-select--sm"
                              defaultValue=""
                              required
                            >
                              <option value="" disabled>
                                Transfer to...
                              </option>
                              {users.map((user) => (
                                <option key={user.id} value={user.id}>
                                  {user.displayName}
                                </option>
                              ))}
                            </select>
                            <span className="row-date-field">
                              <label className="row-date-field__label" htmlFor={`due-${asset.id}`}>
                                Return by
                                <span className="sr-only"> (expected return date for {asset.assetTag}, optional)</span>
                              </label>
                              <ReturnDateField id={`due-${asset.id}`} assetTag={asset.assetTag} />
                            </span>
                            <SubmitButton className="usa-button usa-button--outline usa-button--sm" pendingText="Checking out...">
                              Check out
                            </SubmitButton>
                          </form>
                          {asset.custodian !== "Unassigned" ? (
                            <form action={checkInAssetAction} className="row-actions__form">
                              <input type="hidden" name="assetTag" value={asset.assetTag} />
                              <SubmitButton className="usa-button usa-button--primary usa-button--sm" pendingText="Checking in...">
                                Check in
                              </SubmitButton>
                            </form>
                          ) : null}
                          <form action={dispositionAssetAction} className="row-actions__form">
                            <input type="hidden" name="assetTag" value={asset.assetTag} />
                            <SubmitButton
                              className="usa-button usa-button--secondary usa-button--sm"
                              pendingText="Retiring..."
                              confirm={`Retire ${asset.assetTag}? This action cannot be undone.`}
                            >
                              Retire
                            </SubmitButton>
                          </form>
                        </div>
                      </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={ASSET_PAGE_SIZE}
            total={totalFiltered}
            basePath="/assets"
            searchParams={headerParams}
          />
        </div>
      </section>

      <section className="usa-card mt-3" id="disposed-assets">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Retired assets</span>
          <StatusTag tone="gray">{`${disposedAssets.length} retired`}</StatusTag>
        </div>
        <div className="usa-card__body">
          <p className="usa-hint mb-2">
            Retired assets are kept for the historical record and removed from active inventory above.
          </p>
          <FilterPanel activeCount={disposedActive}>
            <form className="filter-bar" method="get" action="/assets">
              {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
              {filters.office ? <input type="hidden" name="office" value={filters.office} /> : null}
              {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
              {sp.sort ? <input type="hidden" name="sort" value={sp.sort} /> : null}
              {sp.sort ? <input type="hidden" name="dir" value={dir} /> : null}
              <label className="sr-only" htmlFor="disposed-search">Search retired assets</label>
              <div className="filter-bar__search">
                <input id="disposed-search" name="dq" className="usa-input" type="search" placeholder="Search asset ID or serial" defaultValue={disposedFilters.q ?? ""} />
              </div>
              <label className="sr-only" htmlFor="disposed-office">Office</label>
              <select id="disposed-office" name="doffice" className="usa-select" defaultValue={disposedFilters.office ?? ""}>
                <option value="">All offices</option>
                {disposedOffices.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <button className="usa-button usa-button--primary usa-button--sm" type="submit">Apply</button>
              {disposedActive > 0 ? (
                <Link className="usa-button usa-button--outline usa-button--sm" href={buildHref("/assets", headerParams, {})}>Clear</Link>
              ) : null}
            </form>
          </FilterPanel>
          <div className="table-wrap">
            <table className="usa-table">
              <thead>
                <tr>
                  <th scope="col">Asset ID</th>
                  <th scope="col">Type</th>
                  <th scope="col">Serial</th>
                  <th scope="col">Office</th>
                  <th scope="col">Retired on</th>
                </tr>
              </thead>
              <tbody>
                {disposedAssets.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No disposed assets.</td>
                  </tr>
                ) : (
                  disposedAssets.map((asset) => (
                    <tr key={asset.id}>
                      <td className="font-mono">
                        <Link href={`/assets/${asset.id}`}>{asset.assetTag}</Link>
                      </td>
                      <td>{asset.model}</td>
                      <td className="font-mono">{asset.serial ?? "—"}</td>
                      <td>{asset.office ?? "—"}</td>
                      <td className="font-mono">{asset.disposedOn ?? "—"}</td>
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
