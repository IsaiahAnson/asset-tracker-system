"use server";

import { revalidatePath } from "next/cache";
import { checkOutAccessory, checkInAccessory } from "@/lib/accessories";
import { setFlash } from "@/lib/flash";
import { guardWrite } from "@/lib/authz";

export async function checkOutAccessoryAction(formData: FormData): Promise<void> {
  if (!(await guardWrite())) { revalidatePath("/accessories"); return; }
  const accessoryId = String(formData.get("accessoryId") ?? "").trim();
  const toUserId = String(formData.get("toUserId") ?? "").trim();
  if (!accessoryId || !toUserId) return;
  await checkOutAccessory(accessoryId, toUserId);
  await setFlash("success", "Accessory checked out.");
  revalidatePath(`/accessories/${accessoryId}`);
  revalidatePath("/accessories");
}

export async function checkInAccessoryAction(formData: FormData): Promise<void> {
  if (!(await guardWrite())) { revalidatePath("/accessories"); return; }
  const checkoutId = String(formData.get("checkoutId") ?? "").trim();
  const accessoryId = String(formData.get("accessoryId") ?? "").trim();
  if (!checkoutId) return;
  await checkInAccessory(checkoutId);
  await setFlash("success", "Accessory checked in.");
  if (accessoryId) revalidatePath(`/accessories/${accessoryId}`);
  revalidatePath("/accessories");
}
