"use server";

import { revalidatePath } from "next/cache";
import { logMaintenance, completeMaintenance } from "@/lib/maintenance";
import { guardWrite } from "@/lib/authz";

export async function logMaintenanceAction(formData: FormData): Promise<void> {
  if (!(await guardWrite())) { revalidatePath("/maintenance"); return; }
  const assetId = String(formData.get("assetId") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const supplier = String(formData.get("supplier") ?? "").trim() || null;
  const costRaw = String(formData.get("cost") ?? "").trim();
  const cost = costRaw ? Number(costRaw) : null;
  if (!assetId || !type || !title) return;
  await logMaintenance({ assetId, type, title, supplier, cost });
  revalidatePath("/maintenance");
}

export async function completeMaintenanceAction(formData: FormData): Promise<void> {
  if (!(await guardWrite())) { revalidatePath("/maintenance"); return; }
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  await completeMaintenance(id);
  revalidatePath("/maintenance");
}
