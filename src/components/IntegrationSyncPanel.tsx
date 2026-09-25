"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusTag } from "@/components/StatusTag";

type SyncEvent = {
  id: string;
  at: string;
  kind: string;
  detail: string;
  status: "ok" | "info" | "pending";
};

type Snapshot = {
  connection: { label: string; tone: string; detail: string };
  lastSyncedAt: string;
  events: SyncEvent[];
};

const eventTone: Record<SyncEvent["status"], string> = {
  ok: "green",
  info: "cyan",
  pending: "yellow"
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function IntegrationSyncPanel() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/sync", { cache: "no-store" });
      if (!res.ok) throw new Error("status");
      setSnap(await res.json());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 8_000);
    return () => clearInterval(id);
  }, [load]);

  async function sync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/integrations/sync", { method: "POST", cache: "no-store" });
      if (!res.ok) throw new Error("status");
      setSnap(await res.json());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="sync-panel">
      <div className="sync-panel__status">
        <div className="sync-panel__indicator">
          <span className={`sync-dot sync-dot--${snap?.connection.tone ?? "gray"}`} aria-hidden="true" />
          <div>
            <div className="sync-panel__label">
              MuleSoft / HRIS
              {snap ? <StatusTag tone={snap.connection.tone}>{snap.connection.label}</StatusTag> : null}
            </div>
            <p className="sync-panel__detail">
              {error
                ? "Unable to reach the integration status feed."
                : snap?.connection.detail ?? "Checking connection..."}
            </p>
          </div>
        </div>
        <div className="sync-panel__actions">
          {snap ? (
            <span className="sync-panel__last">Last sync {relativeTime(snap.lastSyncedAt)}</span>
          ) : null}
          <button
            type="button"
            className="usa-button usa-button--primary"
            onClick={sync}
            disabled={syncing}
            aria-busy={syncing}
          >
            {syncing ? "Syncing..." : "Sync now"}
          </button>
        </div>
      </div>

      <div className="sync-feed" aria-label="Live integration feed" aria-live="polite">
        <div className="sync-feed__header">
          <span className="sync-feed__title">Live feed</span>
          <span className="sync-feed__hint">Auto-refreshing</span>
        </div>
        {snap?.events.length ? (() => {
          const kinds = Array.from(new Set(snap.events.map((e) => e.kind)));
          return (
            <div className="sync-feed__filters" role="tablist" aria-label="Filter live feed by kind">
              <button
                type="button"
                role="tab"
                aria-selected={filter === "all"}
                className={`sync-feed__chip${filter === "all" ? " sync-feed__chip--active" : ""}`}
                onClick={() => setFilter("all")}
              >
                All ({snap.events.length})
              </button>
              {kinds.map((k) => {
                const count = snap.events.filter((e) => e.kind === k).length;
                return (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={filter === k}
                    className={`sync-feed__chip${filter === k ? " sync-feed__chip--active" : ""}`}
                    onClick={() => setFilter(k)}
                  >
                    {k} ({count})
                  </button>
                );
              })}
            </div>
          );
        })() : null}
        <ul className="sync-feed__list">
          {(() => {
            const filtered = (snap?.events ?? []).filter((e) => filter === "all" || e.kind === filter);
            if (filtered.length === 0 && snap?.events.length) {
              return <li className="sync-feed__item sync-feed__item--empty">No {filter} events.</li>;
            }
            return filtered.length ? (
              filtered.map((ev) => (
                <li className="sync-feed__item" key={ev.id}>
                  <StatusTag tone={eventTone[ev.status]}>{ev.kind}</StatusTag>
                  <span className="sync-feed__detail">{ev.detail}</span>
                  <span className="sync-feed__time">{relativeTime(ev.at)}</span>
                </li>
              ))
            ) : (
              <li className="sync-feed__item sync-feed__item--empty">No sync activity yet.</li>
            );
          })()}
        </ul>
      </div>
    </div>
  );
}
