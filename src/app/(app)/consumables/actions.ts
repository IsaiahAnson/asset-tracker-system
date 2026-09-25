"use server";

import { revalidatePath } from "next/cache";
import { issueConsumable } from "@/lib/consumables";
import { setFlash } from "@/lib/flash";
import { guardWrite } from "@/lib/authz";

export async function issueConsumableAction(formData: FormData): Promise<void> {
  if (!(await guardWrite())) { revalidatePath("/consumables"); return; }
  const consumableId = String(formData.get("consumableId") ?? "").trim();
  const toUserId = String(formData.get("toUserId") ?? "").trim();
  if (!consumableId || !toUserId) return;
  await issueConsumable(consumableId, toUserId);
  await setFlash("success", "Consumable issued.");
  revalidatePath(`/consumables/${consumableId}`);
  revalidatePath("/consumables");
}
