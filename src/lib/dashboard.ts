import { getPool } from "@/lib/db";

export type StatCard = {
  label: string;
  value: string;
  detail: string;
  tone?: "success" | "warn" | "danger";
};

export type CategoryRollupRow = {
  category: string;
  count: string;
  status: string;
  tone: "green" | "red" | "yellow" | "gray" | "cyan";
};

export type WorkflowRow = {
  id: string;
  title: string;
  person: string;
  stage: string;
  status: string;
  due: string;
};

const WORKFLOW_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_review: "In review",
  ready: "Ready",
  at_risk: "At risk",
  completed: "Completed",
  cancelled: "Cancelled"
};

// Narrative posture per category. The DB owns the *count*; release sequencing
// is a project decision that lives outside the schema.
const CATEGORY_POSTURE: Record<string, { status: string; tone: CategoryRollupRow["tone"]; label: string }> = {
  computers: { label: "Computers", status: "In build", tone: "green" },
  firearms: { label: "Firearms", status: "Access gated", tone: "red" },
  vehicles: { label: "Vehicles", status: "Pilot backlog", tone: "yellow" },
  radios: { label: "Radios", status: "Pilot backlog", tone: "yellow" },
  cell_phones: { label: "Cell phones", status: "Pilot backlog", tone: "gray" },
  investigative_equipment: { label: "Investigative equipment", status: "Pilot backlog", tone: "cyan" }
};

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

export async function getDashboardStats(): Promise<StatCard[]> {
  const pool = getPool();

  const [tracked, computers, offboarding, sensitive] = await Promise.all([
    pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM assets WHERE status <> 'retired'"
    ),
    pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM assets a
         JOIN asset_categories c ON c.id = a.category_id
        WHERE c.code = 'computers' AND a.status <> 'retired'`
    ),
    pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM workflows
        WHERE workflow_type = 'offboarding'
          AND status NOT IN ('completed', 'cancelled')`
    ),
    pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM assets a
         JOIN asset_categories c ON c.id = a.category_id
        WHERE a.status <> 'retired'
          AND (a.high_sensitivity OR c.high_sensitivity)`
    )
  ]);

  return [
    {
      label: "Tracked assets",
      value: fmt(Number(tracked.rows[0].n)),
      detail: "Active inventory across all categories"
    },
    {
      label: "Computer assets",
      value: fmt(Number(computers.rows[0].n)),
      detail: "Active end-to-end module",
      tone: "success"
    },
    {
      label: "Pending returns",
      value: fmt(Number(offboarding.rows[0].n)),
      detail: "Offboarding workflows awaiting recovery",
      tone: "warn"
    },
    {
      label: "High sensitivity",
      value: fmt(Number(sensitive.rows[0].n)),
      detail: "Firearms access flag required",
      tone: "danger"
    }
  ];
}

export async function getCategoryRollup(): Promise<CategoryRollupRow[]> {
  const result = await getPool().query<{ code: string; n: string }>(
    `SELECT c.code,
            count(a.*) FILTER (WHERE a.status <> 'retired')::text AS n
       FROM asset_categories c
       LEFT JOIN assets a ON a.category_id = c.id
      GROUP BY c.code
      ORDER BY c.code`
  );

  return result.rows
    .map((row) => {
      const posture = CATEGORY_POSTURE[row.code];
      if (!posture) {
        return null;
      }
      return {
        category: posture.label,
        count: fmt(Number(row.n)),
        status: posture.status,
        tone: posture.tone
      };
    })
    .filter((row): row is CategoryRollupRow => row !== null);
}

const DUE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "short",
  day: "numeric"
});

export async function listActiveWorkflows(): Promise<WorkflowRow[]> {
  const result = await getPool().query<{
    workflow_number: string;
    workflow_type: string;
    status: string;
    stage: string;
    due_on: Date | null;
    subject: string | null;
    office: string | null;
  }>(
    `SELECT w.workflow_number,
            w.workflow_type,
            w.status,
            w.stage,
            w.due_on,
            s.display_name AS subject,
            g.name AS office
       FROM workflows w
       LEFT JOIN app_users s ON s.id = w.subject_user_id
       LEFT JOIN groups g ON g.id = w.group_id
      WHERE w.status NOT IN ('completed', 'cancelled')
      ORDER BY w.due_on NULLS LAST, w.created_at DESC
      LIMIT 10`
  );

  return result.rows.map((row) => {
    const typeTitle =
      row.workflow_type === "onboarding"
        ? "Onboarding"
        : row.workflow_type === "offboarding"
          ? "Offboarding"
          : row.workflow_type === "transfer"
            ? "Transfer"
            : row.workflow_type === "disposition"
              ? "Disposition"
              : "Access request";
    // Person-centric workflows read as "Onboarding for Sarah Lindgren". Asset
    // workflows like disposition have no subject person, so we label them by
    // office ("Disposition, Atlanta Field Office") instead of the awkward
    // "for Unassigned".
    const title = row.subject
      ? `${typeTitle} for ${row.subject}`
      : row.office
        ? `${typeTitle}, ${row.office}`
        : typeTitle;
    return {
      id: row.workflow_number,
      title,
      person: row.subject ?? "Unassigned",
      stage: row.stage,
      status: WORKFLOW_STATUS_LABELS[row.status] ?? row.status,
      due: row.due_on ? DUE_FORMATTER.format(new Date(row.due_on)) : "Not scheduled"
    };
  });
}

export type BarDatum = { label: string; value: number; tone?: string };

const STATUS_DISPLAY: Record<string, string> = {
  available: "Available",
  assigned: "Assigned",
  in_transfer: "In transfer",
  in_repair: "In-Repair",
  pending_approval: "Needs approval",
  retired: "Retired",
  disposed: "Disposed",
  lost: "Lost"
};

const STATUS_TONE: Record<string, string> = {
  available: "green",
  assigned: "blue",
  pending_approval: "yellow",
  in_transfer: "cyan",
  in_repair: "yellow",
  retired: "gray",
  disposed: "gray",
  lost: "red"
};

// Asset count grouped by lifecycle status (drives the status distribution chart).
export async function getAssetsByStatus(): Promise<BarDatum[]> {
  const result = await getPool().query<{ status: string; n: number }>(
    "SELECT status, count(*)::int AS n FROM assets GROUP BY status ORDER BY n DESC"
  );
  return result.rows.map((r) => ({
    label: STATUS_DISPLAY[r.status] ?? r.status,
    value: r.n,
    tone: STATUS_TONE[r.status] ?? "gray"
  }));
}

// Unit counts across the tracked inventory modules (cross-module snapshot chart).
export async function getModuleInventory(): Promise<BarDatum[]> {
  const result = await getPool().query<{
    assets: number;
    accessories: number;
    consumables: number;
    components: number;
  }>(
    `SELECT (SELECT count(*) FROM assets WHERE status <> 'retired')::int AS assets,
            (SELECT COALESCE(sum(qty), 0) FROM accessories)::int AS accessories,
            (SELECT COALESCE(sum(qty), 0) FROM consumables)::int AS consumables,
            (SELECT COALESCE(sum(qty), 0) FROM components)::int AS components`
  );
  const r = result.rows[0];
  return [
    { label: "Assets (active)", value: r.assets, tone: "blue" },
    { label: "Accessory units", value: r.accessories, tone: "green" },
    { label: "Consumable units", value: r.consumables, tone: "yellow" },
    { label: "Component units", value: r.components, tone: "gray" }
  ];
}

export type AttentionItem = {
  label: string;
  href: string;
  tone: "danger" | "warn" | "cyan";
};

// Aggregates items that need a user's attention into a single list for the
// dashboard. Only non-zero categories are returned.
export async function getAttentionItems(): Promise<AttentionItem[]> {
  const pool = getPool();
  const [overdue, lowStock, pending] = await Promise.all([
    pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM assets WHERE status = 'assigned' AND expected_return_on IS NOT NULL AND expected_return_on < CURRENT_DATE"
    ),
    pool.query<{ n: number }>(
      `SELECT (
         (SELECT count(*) FROM (SELECT a.qty - count(co.*) AS av, a.min_amt AS m FROM accessories a LEFT JOIN accessory_checkouts co ON co.accessory_id = a.id GROUP BY a.id) s WHERE s.av <= s.m)
       + (SELECT count(*) FROM (SELECT c.qty - count(ci.*) AS av, c.min_amt AS m FROM consumables c LEFT JOIN consumable_issues ci ON ci.consumable_id = c.id GROUP BY c.id) s WHERE s.av <= s.m)
       + (SELECT count(*) FROM (SELECT k.qty - COALESCE(sum(ka.assigned_qty), 0) AS av, k.min_amt AS m FROM components k LEFT JOIN component_assignments ka ON ka.component_id = k.id GROUP BY k.id) s WHERE s.av <= s.m)
       )::int AS n`
    ),
    pool.query<{ n: number }>("SELECT count(*)::int AS n FROM asset_requests WHERE status = 'pending'")
  ]);

  const items: AttentionItem[] = [];
  const o = overdue.rows[0].n;
  const l = lowStock.rows[0].n;
  const p = pending.rows[0].n;
  if (o > 0) items.push({ label: `${o} overdue asset checkout${o === 1 ? "" : "s"}`, href: "/assets?status=assigned", tone: "danger" });
  if (p > 0) items.push({ label: `${p} asset request${p === 1 ? "" : "s"} awaiting decision`, href: "/requests", tone: "warn" });
  if (l > 0) items.push({ label: `${l} item${l === 1 ? "" : "s"} at or below minimum stock`, href: "/accessories", tone: "cyan" });
  return items;
}

// Live counts for sidebar nav badges, keyed by nav href. Only non-zero.
export async function getNavBadges(): Promise<Record<string, number>> {
  const pool = getPool();
  const [requests, overdue, approvals] = await Promise.all([
    pool.query<{ n: number }>("SELECT count(*)::int AS n FROM asset_requests WHERE status = 'pending'"),
    pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM assets WHERE status = 'assigned' AND expected_return_on IS NOT NULL AND expected_return_on < CURRENT_DATE"
    ),
    pool.query<{ n: number }>("SELECT count(*)::int AS n FROM approvals WHERE status = 'pending'")
  ]);
  const badges: Record<string, number> = {};
  if (requests.rows[0].n > 0) badges["/requests"] = requests.rows[0].n;
  if (overdue.rows[0].n > 0) badges["/assets"] = overdue.rows[0].n;
  if (approvals.rows[0].n > 0) badges["/approvals"] = approvals.rows[0].n;
  return badges;
}
