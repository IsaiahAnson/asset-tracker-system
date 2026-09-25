import type { ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import { SiteHeader } from "@/components/SiteHeader";
import { FlashToast } from "@/components/FlashToast";
import { MainScrollArea } from "@/components/MainScrollArea";
import type { Flash } from "@/lib/flash";

export function AppLayout({
  children,
  badges,
  flash,
  readOnly
}: {
  children: ReactNode;
  badges?: Record<string, number>;
  flash?: Flash | null;
  readOnly?: boolean;
}) {
  return (
    <div className="app-shell">
      <a className="usa-skipnav" href="#main-content">
        Skip to main content
      </a>
      <SiteHeader />
      <div className="app-body">
        <Sidebar badges={badges} />
        <MainScrollArea>
          {readOnly ? (
            <div className="readonly-banner" role="status">
              <strong>Read-Only mode.</strong> Your role can view records but cannot make changes.
            </div>
          ) : null}
          {children}
        </MainScrollArea>
      </div>
      <FlashToast flash={flash ?? null} />
    </div>
  );
}
