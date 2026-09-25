"use server";

import { revalidatePath } from "next/cache";
import {
  surrenderToEntity,
  recordVerification,
  type VerificationStatus
} from "@/lib/firearms";
import { setFlash } from "@/lib/flash";
import { guardFirearmsCoordinator } from "@/lib/authz";

const ALLOWED_CHECK_TYPES = new Set([
  "ncic_background",
  "armor_inspection",
  "deployment_justification",
  "qualification",
  "medical_clearance"
]);

const ALLOWED_STATUSES = new Set<VerificationStatus>(["passed", "pending", "failed", "expired"]);

export async function surrenderToEntityAction(formData: FormData): Promise<void> {
  if (!(await guardFirearmsCoordinator())) {
    revalidatePath("/firearms");
    return;
  }

  const assetTag = String(formData.get("assetTag") ?? "").trim();
  const toEntityId = String(formData.get("toEntityId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || undefined;
  if (!assetTag || !toEntityId) {
    await setFlash("error", "Asset tag and destination entity are required.");
    revalidatePath("/firearms");
    return;
  }

  try {
    await surrenderToEntity(assetTag, toEntityId, reason);
    await setFlash("success", `${assetTag} surrendered to selected entity.`);
  } catch (error) {
    await setFlash("error", error instanceof Error ? error.message : "Surrender failed.");
  }
  revalidatePath("/firearms");
  revalidatePath(`/firearms`);
}

export async function recordVerificationAction(formData: FormData): Promise<void> {
  if (!(await guardFirearmsCoordinator())) {
    revalidatePath("/firearms");
    return;
  }

  const assetTag = String(formData.get("assetTag") ?? "").trim();
  const checkType = String(formData.get("checkType") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim() as VerificationStatus;
  const rawExpires = String(formData.get("expiresOn") ?? "").trim();
  const expiresOn = /^\d{4}-\d{2}-\d{2}$/.test(rawExpires) ? rawExpires : null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!assetTag || !checkType || !ALLOWED_CHECK_TYPES.has(checkType)) {
    await setFlash("error", "Asset tag and a recognized check type are required.");
    revalidatePath("/firearms");
    return;
  }
  if (!ALLOWED_STATUSES.has(statusRaw)) {
    await setFlash("error", "Verification status must be passed, pending, failed, or expired.");
    revalidatePath("/firearms");
    return;
  }

  try {
    await recordVerification({
      assetTag,
      checkType,
      status: statusRaw,
      expiresOn,
      notes
    });
    await setFlash("success", `Recorded ${checkType.replace(/_/g, " ")} for ${assetTag}.`);
  } catch (error) {
    await setFlash("error", error instanceof Error ? error.message : "Verification update failed.");
  }
  revalidatePath("/firearms");
}
