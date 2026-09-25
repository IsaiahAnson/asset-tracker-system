"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createComputerAsset,
  transferCustody,
  dispositionAsset,
  checkInAsset,
  updateComputerAsset
} from "@/lib/assets";
import { setFlash } from "@/lib/flash";
import { guardWrite } from "@/lib/authz";
import { listActiveFieldDefinitions, validateCustomValues } from "@/lib/custom-fields";

// Collects admin-defined custom field values from the form. Inputs are named
// `cf_<fieldKey>`; this strips the prefix back to the bare key the lib expects.
function collectCustomValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("cf_")) {
      out[key.slice(3)] = typeof value === "string" ? value : "";
    }
  }
  return out;
}

export async function createComputerAssetAction(formData: FormData): Promise<void> {
  if (!(await guardWrite())) { revalidatePath("/assets"); return; }
  const type = String(formData.get("type") ?? "").trim();
  const serial = String(formData.get("serial") ?? "").trim();
  const office = String(formData.get("office") ?? "").trim();

  if (!serial || !office) {
    await setFlash("error", "Serial number and office are required.");
    revalidatePath("/assets");
    return;
  }

  // Validate custom field values against the active definitions before insert.
  const customValues = collectCustomValues(formData);
  const definitions = await listActiveFieldDefinitions("asset");
  const problems = validateCustomValues(definitions, customValues);
  if (problems.length > 0) {
    await setFlash("error", problems.join(" "));
    revalidatePath("/assets");
    return;
  }

  const model = type ? type.charAt(0).toUpperCase() + type.slice(1) : "Computer";

  const { assetTag } = await createComputerAsset({ model, serial, office, customValues });
  await setFlash("success", `Created computer asset ${assetTag}.`);
  revalidatePath("/assets");
}

export async function transferCustodyAction(formData: FormData): Promise<void> {
  if (!(await guardWrite())) { revalidatePath("/assets"); return; }
  const assetTag = String(formData.get("assetTag") ?? "").trim();
  const toUserId = String(formData.get("toUserId") ?? "").trim();
  const rawReturn = String(formData.get("expectedReturn") ?? "").trim();
  const expectedReturn = /^\d{4}-\d{2}-\d{2}$/.test(rawReturn) ? rawReturn : null;

  if (!assetTag || !toUserId) {
    return;
  }

  await transferCustody(assetTag, toUserId, expectedReturn);
  await setFlash("success", `Checked out ${assetTag}.`);
  revalidatePath("/assets");
}

export async function checkInAssetAction(formData: FormData): Promise<void> {
  if (!(await guardWrite())) { revalidatePath("/assets"); return; }
  const assetTag = String(formData.get("assetTag") ?? "").trim();

  if (!assetTag) {
    return;
  }

  await checkInAsset(assetTag);
  await setFlash("success", `Checked in ${assetTag}.`);
  revalidatePath("/assets");
}

export async function updateComputerAssetAction(formData: FormData): Promise<void> {
  if (!(await guardWrite())) { revalidatePath("/assets"); return; }
  const id = String(formData.get("id") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const serial = String(formData.get("serial") ?? "").trim();
  const office = String(formData.get("office") ?? "").trim();
  if (!id || !serial || !office) {
    return;
  }
  await updateComputerAsset(id, { model: model || "Computer", serial, office });
  await setFlash("success", "Asset details updated.");
  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  redirect(`/assets/${id}`);
}


export async function dispositionAssetAction(formData: FormData): Promise<void> {
  if (!(await guardWrite())) { revalidatePath("/assets"); return; }
  const assetTag = String(formData.get("assetTag") ?? "").trim();

  if (!assetTag) {
    return;
  }

  await dispositionAsset(assetTag);
  await setFlash("success", `Dispositioned ${assetTag}.`);
  revalidatePath("/assets");
}
