import { getPool } from "@/lib/db";
import { writeAuditLog, resolveActor } from "@/lib/audit";

export type ApprovalRow = {
  id: string;
  approvalNumber: string;
  request: string;
  approver: string;
  office: string;
  type: string;
  submitted: string;
  status: string;
};

const TYPE_LABELS: Record<string, string> = {
  onboarding: "Onboarding",
  offboarding: "Offboarding",
  transfer: "Transfer",
  disposition: "Disposition",
  access_request: "Access request"
};

export function approvalTone(status: string): "yellow" | "green" | "red" | "gray" {
  switch (status) {
    case "pending":
      return "yellow";
    case "escalated":
      return "red";
    case "approved":
      return "green";
    case "denied":
      return "red";
    default:
      return "gray";
  }
}

export function approvalStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// A decision is still actionable while the approval is awaiting review.
export function isActionable(status: string): boolean {
  return status === "pending" || status === "escalated";
}

export async function listApprovals(): Promise<ApprovalRow[]> {
  const result = await getPool().query<{
    id: string;
    approval_number: string;
    request_summary: string;
    approver: string | null;
    office: string | null;
    workflow_type: string | null;
    submitted: string;
    status: string;
  }>(
    `SELECT a.id,
            a.approval_number,
            a.request_summary,
            u.display_name AS approver,
            g.name AS office,
            w.workflow_type,
            to_char(a.submitted_at, 'YYYY-MM-DD') AS submitted,
            a.status
       FROM approvals a
       JOIN app_users u ON u.id = a.approver_user_id
       LEFT JOIN groups g ON g.id = u.group_id
       LEFT JOIN workflows w ON w.id = a.workflow_id
      ORDER BY (a.status IN ('pending', 'escalated')) DESC, a.submitted_at DESC`
  );
  return result.rows.map((r) => ({
    id: r.id,
    approvalNumber: r.approval_number,
    request: r.request_summary,
    approver: r.approver ?? "Unassigned",
    office: r.office ?? "—",
    type: r.workflow_type ? (TYPE_LABELS[r.workflow_type] ?? r.workflow_type) : "—",
    submitted: r.submitted,
    status: r.status
  }));
}

export type ApprovalStats = { pending: number; escalated: number; decidedToday: number };

export async function getApprovalStats(): Promise<ApprovalStats> {
  const result = await getPool().query<{ pending: string; escalated: string; decided_today: string }>(
    `SELECT count(*) FILTER (WHERE status = 'pending')::text AS pending,
            count(*) FILTER (WHERE status = 'escalated')::text AS escalated,
            count(*) FILTER (
              WHERE status IN ('approved', 'denied')
                AND decided_at >= date_trunc('day', now())
            )::text AS decided_today
       FROM approvals`
  );
  const r = result.rows[0];
  return {
    pending: Number(r.pending),
    escalated: Number(r.escalated),
    decidedToday: Number(r.decided_today)
  };
}

// Records an approve/deny decision on an actionable approval, with an audit
// entry, in one transaction.
export async function decideApproval(id: string, decision: "approved" | "denied"): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const row = await client.query<{ approval_number: string; status: string }>(
      "SELECT approval_number, status FROM approvals WHERE id = $1 FOR UPDATE",
      [id]
    );
    if (row.rowCount === 0) throw new Error("Approval not found.");
    if (!isActionable(row.rows[0].status)) {
      throw new Error("Approval has already been decided.");
    }
    const actor = await resolveActor(client);
    await client.query(
      "UPDATE approvals SET status = $1, decided_at = now() WHERE id = $2",
      [decision, id]
    );
    await writeAuditLog(
      {
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: decision === "approved" ? "Approved request" : "Denied request",
        recordType: "approval",
        recordId: row.rows[0].approval_number,
        metadata: { decision }
      },
      client
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
