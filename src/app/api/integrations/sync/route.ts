import { createSimulatedOnboarding } from "@/lib/onboarding";

export const runtime = "nodejs";

// MuleSoft / HRIS connection status and pull feed.
//
// Live MuleSoft subscription is a later Phase, so the "pull" here is
// simulated. To make the first pull tangible for the demo, POST opens a real
// (clearly simulated) onboarding workflow for a new hire, then logs that event
// to the in-memory feed. The feed resets on server restart; the onboarding
// workflow it creates persists in the DB (visible on the Workflows page) until
// reset-db.sh wipes it.

type SyncStatus = "ok" | "info" | "pending";

type SyncEvent = {
  id: string;
  at: string;
  kind: string;
  detail: string;
  status: SyncStatus;
};

const MAX_EVENTS = 40;

function seedEvents(): SyncEvent[] {
  const now = Date.now();
  const ago = (mins: number) => new Date(now - mins * 60_000).toISOString();
  return [
    {
      id: "seed-3",
      at: ago(4),
      kind: "Personnel delta",
      detail: "Pulled 12 HRIS personnel records through MuleSoft (simulated).",
      status: "ok"
    },
    {
      id: "seed-2",
      at: ago(36),
      kind: "Onboarding event",
      detail: "Received new-hire event at the HR webhook receiver; onboarding workflow opened.",
      status: "info"
    },
    {
      id: "seed-1",
      at: ago(95),
      kind: "Connection check",
      detail: "MuleSoft boundary reachable. Live HR subscription pending.",
      status: "pending"
    }
  ];
}

const events: SyncEvent[] = seedEvents();
let lastSyncedAt: string = events[0]?.at ?? new Date().toISOString();

function snapshot() {
  return {
    connection: {
      label: "Simulated",
      tone: "cyan",
      detail:
        "MuleSoft boundary stubbed. The HR webhook receiver contract is locked; live HRIS pull begins once HRIS subscribes this endpoint."
    },
    lastSyncedAt,
    events: events.slice(0, MAX_EVENTS)
  };
}

export async function GET() {
  return Response.json(snapshot(), { status: 200 });
}

export async function POST() {
  const at = new Date().toISOString();

  // The visible result of a pull: a simulated new hire arrives and their
  // onboarding workflow opens. If the DB write fails for any reason, still log
  // a sync attempt so the feed never lies about what happened.
  let event: SyncEvent;
  try {
    const hire = await createSimulatedOnboarding();
    event = {
      id: `sync-${at}`,
      at,
      kind: "Onboarding event",
      detail: `Simulated new hire ${hire.hireName} received from HRIS; onboarding workflow ${hire.workflowNumber} opened (start ${hire.startDate}). See Workflows.`,
      status: "ok"
    };
  } catch {
    event = {
      id: `sync-${at}`,
      at,
      kind: "Connection check",
      detail: "Sync attempted, but the simulated onboarding workflow could not be created.",
      status: "pending"
    };
  }

  events.unshift(event);
  if (events.length > MAX_EVENTS) {
    events.length = MAX_EVENTS;
  }
  lastSyncedAt = at;
  return Response.json(snapshot(), { status: 200 });
}
