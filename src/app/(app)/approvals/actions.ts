"use server";

import { revalidatePath } from "next/cache";
import { decideApproval } from "@/lib/approvals";
import { setFlash } from "@/lib/flash";
import { guardApprover } from "@/lib/authz";

export async function decideApprovalAction(formData: FormData): Promise<void> {
  if (!(await guardApprover())) { revalidatePath("/approvals"); return; }
  const id = String(formData.get("id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  if (!id || (decision !== "approved" && decision !== "denied")) {
    return;
  }
  try {
    await decideApproval(id, decision);
    await setFlash("success", decision === "approved" ? "Request approved." : "Request denied.");
  } catch (error) {
    await setFlash("error", error instanceof Error ? error.message : "Could not record the decision.");
  }
  revalidatePath("/approvals");
}
