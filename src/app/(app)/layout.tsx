import type { ReactNode } from "react";
import { AppLayout } from "@/components/AppLayout";
import { getNavBadges } from "@/lib/dashboard";
import { readFlash } from "@/lib/flash";
import { canActingUserWrite } from "@/lib/authz";

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const [badges, flash, canWrite] = await Promise.all([
    getNavBadges(),
    readFlash(),
    canActingUserWrite()
  ]);
  return (
    <AppLayout badges={badges} flash={flash} readOnly={!canWrite}>
      {children}
    </AppLayout>
  );
}
