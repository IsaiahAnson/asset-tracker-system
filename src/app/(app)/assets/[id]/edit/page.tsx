import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getComputerAsset } from "@/lib/assets";
import { updateComputerAssetAction } from "../../actions";

export default async function EditAssetPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const asset = await getComputerAsset(id);

  if (!asset) {
    return (
      <div className="usa-page">
        <div className="usa-page-header">
          <h1 className="usa-page-title">Asset not found</h1>
        </div>
        <Link className="usa-button usa-button--outline" href="/assets">
          Back to assets
        </Link>
      </div>
    );
  }

  return (
    <div className="usa-page">
      <div className="usa-page-header">
        <div>
          <Breadcrumbs
            items={[
              { label: "Assets", href: "/assets" },
              { label: asset.assetTag },
              { label: "Edit" }
            ]}
          />
          <h1 className="usa-page-title">Edit asset</h1>
          <p className="usa-page-subtitle font-mono">{asset.assetTag}</p>
        </div>
      </div>

      <section className="usa-card">
        <div className="usa-card__header">
          <span className="usa-card__header-title">Asset details</span>
        </div>
        <div className="usa-card__body">
          <form action={updateComputerAssetAction} className="asset-form-grid">
            <input type="hidden" name="id" value={asset.id} />
            <div className="usa-form-group">
              <label className="usa-label" htmlFor="edit-model">
                Model / type
              </label>
              <input
                id="edit-model"
                name="model"
                className="usa-input"
                type="text"
                defaultValue={asset.model ?? ""}
                placeholder="e.g. Latitude 7440 or Laptop"
              />
            </div>
            <div className="usa-form-group">
              <label className="usa-label" htmlFor="edit-serial">
                Serial number
              </label>
              <input
                id="edit-serial"
                name="serial"
                className="usa-input"
                type="text"
                required
                defaultValue={asset.serial ?? ""}
              />
            </div>
            <div className="usa-form-group">
              <label className="usa-label" htmlFor="edit-office">
                Office
              </label>
              <input
                id="edit-office"
                name="office"
                className="usa-input"
                type="text"
                required
                defaultValue={asset.office ?? ""}
              />
            </div>
            <div className="asset-form-grid__full flex-end gap-2">
              <Link className="usa-button usa-button--secondary" href={`/assets/${asset.id}`}>
                Cancel
              </Link>
              <button className="usa-button usa-button--primary" type="submit">
                Save changes
              </button>
            </div>
          </form>
        </div>
      </section>

      <p className="usa-hint mt-2">
        Custody and status (check out, check in, transfer, dispose) are managed from the Assets list,
        not edited here.
      </p>
    </div>
  );
}
