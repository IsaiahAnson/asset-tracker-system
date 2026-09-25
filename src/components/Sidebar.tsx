"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavLink = { href: string; label: string; exact?: boolean };
type NavGroup = { id: string; label: string; links: NavLink[] };

const dashboardLink: NavLink = { href: "/dashboard", label: "Dashboard" };

const groups: NavGroup[] = [
  {
    id: "inventory",
    label: "Inventory",
    links: [
      { href: "/assets", label: "Assets" },
      { href: "/firearms", label: "Firearms" },
      { href: "/accessories", label: "Accessories" },
      { href: "/consumables", label: "Consumables" },
      { href: "/components", label: "Components" },
      { href: "/maintenance", label: "Maintenance" },
      { href: "/procurement", label: "Procurement" }
    ]
  },
  {
    id: "people",
    label: "People & Requests",
    links: [
      { href: "/people", label: "People" },
      { href: "/requests", label: "Requests" },
      { href: "/workflows", label: "Workflows" },
      { href: "/approvals", label: "Approvals" }
    ]
  },
  {
    id: "system",
    label: "System",
    links: [
      { href: "/settings", label: "Administration", exact: true },
      { href: "/settings/custom-fields", label: "Customize Form" },
      { href: "/audit", label: "Audit Log" },
      { href: "/integrations", label: "Integrations" },
      { href: "/reference", label: "Reference data" }
    ]
  },
  {
    id: "help",
    label: "Help & guidance",
    links: [
      { href: "/help", label: "Overview" },
      { href: "/help/asset-managers", label: "Asset manager guide" },
      { href: "/help/admins", label: "Admin & staff guide" },
      { href: "/help/mulesoft-flow", label: "MuleSoft data flow" }
    ]
  }
];

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`sidenav-group__chevron${open ? " sidenav-group__chevron--open" : ""}`}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

export function Sidebar({ badges = {} }: { badges?: Record<string, number> }) {
  const pathname = usePathname();
  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const activeGroupId = groups.find((g) => g.links.some((l) => isActive(l.href, l.exact)))?.id ?? null;

  // Groups the user has explicitly toggled open. The active group is always
  // expanded (you are on one of its pages). Expansion is click-only.
  const [pinned, setPinned] = useState<Set<string>>(() =>
    activeGroupId ? new Set([activeGroupId]) : new Set()
  );

  function togglePinned(id: string) {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <nav className="usa-sidenav-container" aria-label="Primary navigation">
      <div className="sidenav-section">
        <ul className="usa-sidenav">
          <li className="usa-sidenav__item">
            <Link href={dashboardLink.href} className={isActive(dashboardLink.href) ? "usa-current" : undefined}>
              <span>{dashboardLink.label}</span>
            </Link>
          </li>
        </ul>
      </div>

      <div className="sidenav-section">
        <p className="sidenav-section-label">Asset operations</p>
        <ul className="usa-sidenav">
          {groups.map((group) => {
            const expanded = group.id === activeGroupId || pinned.has(group.id);
            const groupBadge = group.links.reduce((sum, l) => sum + (badges[l.href] ?? 0), 0);
            return (
              <li className="usa-sidenav__item sidenav-group" key={group.id}>
                <button
                  type="button"
                  className="nav-btn sidenav-group__toggle"
                  aria-expanded={expanded}
                  aria-controls={`sidenav-group-${group.id}`}
                  onClick={() => togglePinned(group.id)}
                >
                  <span>{group.label}</span>
                  <span className="sidenav-group__meta">
                    {!expanded && groupBadge > 0 ? (
                      <span className="usa-sidenav__badge" aria-label={`${groupBadge} need attention`}>
                        {groupBadge}
                      </span>
                    ) : null}
                    <Chevron open={expanded} />
                  </span>
                </button>
                {expanded ? (
                  <ul className="usa-sidenav__sublist" id={`sidenav-group-${group.id}`}>
                    {group.links.map((link) => (
                      <li className="usa-sidenav__item" key={link.href}>
                        <Link href={link.href} className={isActive(link.href, link.exact) ? "usa-current" : undefined}>
                          <span>{link.label}</span>
                          {badges[link.href] ? (
                            <span className="usa-sidenav__badge" aria-label={`${badges[link.href]} need attention`}>
                              {badges[link.href]}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="sidenav-footer">
        Development prototype
        <br />
        Group scope: NWA
      </div>
    </nav>
  );
}
