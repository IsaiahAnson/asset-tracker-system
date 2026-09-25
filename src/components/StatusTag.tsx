import type { ReactNode } from "react";

export function StatusTag({
  children,
  tone = "gray",
  title
}: {
  children: ReactNode;
  tone?: string;
  title?: string;
}) {
  return (
    <span className={`usa-tag usa-tag--${tone}`} title={title}>
      {children}
    </span>
  );
}
