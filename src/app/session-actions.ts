"use server";

import { redirect } from "next/navigation";
import { setActingUser, clearActingUser } from "@/lib/session";

// DEV-ONLY: records which seeded user you are acting as, then lands on the
// dashboard. No credential check (see lib/session.ts).
export async function signInAsAction(formData: FormData): Promise<void> {
  const userId = String(formData.get("userId") ?? "").trim();
  if (userId) {
    await setActingUser(userId);
  }
  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  await clearActingUser();
  redirect("/login");
}
