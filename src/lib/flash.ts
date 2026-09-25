import { cookies } from "next/headers";

export type FlashType = "success" | "error" | "info";
export type Flash = { type: FlashType; message: string };

const FLASH_COOKIE = "ats-flash";

// Sets a short-lived flash message that the next rendered page surfaces as a
// toast. Call from a Server Action after a mutation succeeds (or fails).
export async function setFlash(type: FlashType, message: string): Promise<void> {
  const store = await cookies();
  store.set(FLASH_COOKIE, JSON.stringify({ type, message }), {
    maxAge: 10,
    path: "/",
    httpOnly: false,
    sameSite: "lax"
  });
}

// Reads the flash message (if any) for the current request. Safe to call from a
// Server Component during render.
export async function readFlash(): Promise<Flash | null> {
  const raw = (await cookies()).get(FLASH_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Flash;
    if (parsed && typeof parsed.message === "string" && parsed.type) {
      return { type: parsed.type, message: parsed.message };
    }
  } catch {
    // Ignore malformed cookie values.
  }
  return null;
}

// Clears the flash cookie. Invoked by the client toast once it has shown the
// message so it does not reappear on the next navigation.
export async function clearFlash(): Promise<void> {
  (await cookies()).delete(FLASH_COOKIE);
}
