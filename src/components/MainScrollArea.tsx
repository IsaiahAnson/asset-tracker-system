"use client";

import { useLayoutEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";

// The single scroll container for the entire app shell. Body overflow is
// locked in index.css so .usa-main is the only thing that scrolls. Because the
// layout (and this container) persists across client navigations, the inner
// scroll position would otherwise carry over from the previous page.
//
// On every pathname change we reset deterministically:
//   - If the destination URL has a hash (e.g. /assets#asset-create), scroll
//     that element into view. We do this explicitly rather than relying on the
//     browser's native anchor scroll, which races with React rendering the new
//     page and can leave the container wherever it was (the cause of the
//     "Create asset lands at the bottom" bug).
//   - Otherwise scroll the container back to the top.
//
// useLayoutEffect runs after the new page commits but before paint, so there is
// no flash of the wrong scroll position.
export function MainScrollArea({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const main = document.querySelector<HTMLElement>("main.usa-main");
    if (!main) return;

    const hash = window.location.hash;
    if (hash && hash.length > 1) {
      try {
        const target = main.querySelector<HTMLElement>(hash);
        if (target) {
          target.scrollIntoView({ block: "start" });
          return;
        }
      } catch {
        // Invalid selector in hash; fall through to top reset.
      }
    }
    main.scrollTop = 0;
  }, [pathname]);

  return (
    <main key={pathname} id="main-content" className="usa-main">
      {children}
    </main>
  );
}
