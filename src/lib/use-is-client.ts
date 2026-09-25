"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// True after hydration on the client, false during server render. Used to gate
// createPortal(…, document.body) without a setState-in-effect "mounted" flag.
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
