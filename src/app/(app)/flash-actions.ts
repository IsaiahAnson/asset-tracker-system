"use server";

import { clearFlash } from "@/lib/flash";

export async function clearFlashAction(): Promise<void> {
  await clearFlash();
}
