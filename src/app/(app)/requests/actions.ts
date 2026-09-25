"use server";

import { revalidatePath } from "next/cache";
import { decideRequest } from "@/lib/requests";
import { guardWrite } from "@/lib/authz";

export async function decideRequestAction(formData: FormData): Promise<void> {
  if (!(await guardWrite())) { revalidatePath("/requests"); return; }
  const id = String(formData.get("id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  if (!id || (decision !== "approved" && decision !== "denied")) return;
  await decideRequest(id, decision);
  revalidatePath("/requests");
  revalidatePath(`/requests/${id}`);
}
