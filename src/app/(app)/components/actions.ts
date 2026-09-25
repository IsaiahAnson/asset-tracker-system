"use server";

import { revalidatePath } from "next/cache";
import { assignComponentToAsset, unassignComponent } from "@/lib/components";
import { guardWrite } from "@/lib/authz";

export async function assignComponentAction(formData: FormData): Promise<void> {
  if (!(await guardWrite())) { revalidatePath("/components"); return; }
  const componentId = String(formData.get("componentId") ?? "").trim();
  const assetId = String(formData.get("assetId") ?? "").trim();
  const qty = Number(formData.get("qty") ?? 1);
  if (!componentId || !assetId) return;
  await assignComponentToAsset(componentId, assetId, qty);
  revalidatePath(`/components/${componentId}`);
  revalidatePath("/components");
}

export async function unassignComponentAction(formData: FormData): Promise<void> {
  if (!(await guardWrite())) { revalidatePath("/components"); return; }
  const assignmentId = String(formData.get("assignmentId") ?? "").trim();
  const componentId = String(formData.get("componentId") ?? "").trim();
  if (!assignmentId) return;
  await unassignComponent(assignmentId);
  if (componentId) revalidatePath(`/components/${componentId}`);
  revalidatePath("/components");
}
