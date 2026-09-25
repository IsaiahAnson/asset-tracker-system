import { getPool } from "@/lib/db";
import { writeAuditLog, resolveActor, formatEastern } from "@/lib/audit";

export type RequestDetail = {
  id: string;
  requestNumber: string;
  requesterId: string | null;
  requester: string;
  requesterEmail: string | null;
  itemLabel: string;
  category: string | null;
  status: string;
  notes: string | null;
  createdOn: string;
  decidedOn: string | null;
};

export async function getRequestDetail(id: string): Promise<RequestDetail | null> {
  const result = await getPool().query<{
    id: string; request_number: string; requested_by: string | null; requester: string | null;
    requester_email: string | null; item_label: string; category: string | null; status: string;
    notes: string | null; created_on: string; decided_on: string | null;
  }>(
    `SELECT r.id, r.request_number, r.requested_by, u.display_name AS requester,
            u.email AS requester_email, r.item_label, r.category, r.status, r.notes,
            to_char(r.created_at, 'YYYY-MM-DD') AS created_on,
            to_char(r.decided_at, 'YYYY-MM-DD') AS decided_on
       FROM asset_requests r
       LEFT JOIN app_users u ON u.id = r.requested_by
      WHERE r.id = $1`,
    [id]
  );
  if (result.rowCount === 0) return null;
  const r = result.rows[0];
  return {
    id: r.id,
    requestNumber: r.request_number,
    requesterId: r.requested_by,
    requester: r.requester ?? "Unknown",
    requesterEmail: r.requester_email,
    itemLabel: r.item_label,
    category: r.category,
    status: r.status,
    notes: r.notes,
    createdOn: r.created_on,
    decidedOn: r.decided_on
  };
}

export type RequestActivity = { id: string; timestamp: string; actor: string; action: string; result: string };

export async function listRequestActivity(requestNumber: string): Promise<RequestActivity[]> {
  const result = await getPool().query<{
    audit_number: string; actor_label: string; action: string; result: string; created_at: string;
  }>(
    `SELECT audit_number, actor_label, action, result, created_at
       FROM audit_log
      WHERE record_type = 'request' AND record_id = $1
      ORDER BY created_at DESC`,
    [requestNumber]
  );
  return result.rows.map((r) => ({
    id: r.audit_number,
    timestamp: formatEastern(r.created_at),
    actor: r.actor_label,
    action: r.action,
    result: r.result
  }));
}

export type RequestRow = {
  id: string;
  requestNumber: string;
  requester: string;
  itemLabel: string;
  category: string | null;
  status: string;
  createdOn: string;
};

export function requestTone(status: string): "yellow" | "green" | "red" | "blue" | "gray" {
  switch (status) {
    case "pending":
      return "yellow";
    case "approved":
      return "green";
    case "denied":
      return "red";
    case "fulfilled":
      return "blue";
    default:
      return "gray";
  }
}

export async function listRequests(): Promise<RequestRow[]> {
  const result = await getPool().query<{
    id: string; request_number: string; requester: string | null; item_label: string;
    category: string | null; status: string; created_at: string;
  }>(
    `SELECT r.id, r.request_number, u.display_name AS requester, r.item_label,
            r.category, r.status, to_char(r.created_at, 'YYYY-MM-DD') AS created_at
       FROM asset_requests r
       LEFT JOIN app_users u ON u.id = r.requested_by
      ORDER BY (r.status = 'pending') DESC, r.created_at DESC`
  );
  return result.rows.map((r) => ({
    id: r.id,
    requestNumber: r.request_number,
    requester: r.requester ?? "Unknown",
    itemLabel: r.item_label,
    category: r.category,
    status: r.status,
    createdOn: r.created_at
  }));
}

export type RequestStats = { total: number; pending: number; approved: number; denied: number };

export async function getRequestStats(): Promise<RequestStats> {
  const result = await getPool().query<{ total: string; pending: string; approved: string; denied: string }>(
    `SELECT count(*)::text AS total,
            count(*) FILTER (WHERE status = 'pending')::text AS pending,
            count(*) FILTER (WHERE status IN ('approved', 'fulfilled'))::text AS approved,
            count(*) FILTER (WHERE status = 'denied')::text AS denied
       FROM asset_requests`
  );
  const r = result.rows[0];
  return {
    total: Number(r.total),
    pending: Number(r.pending),
    approved: Number(r.approved),
    denied: Number(r.denied)
  };
}

// Records an approve/deny decision on a pending request, with an audit entry.
export async function decideRequest(id: string, decision: "approved" | "denied"): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const req = await client.query<{ request_number: string; status: string }>(
      "SELECT request_number, status FROM asset_requests WHERE id = $1 FOR UPDATE",
      [id]
    );
    if (req.rowCount === 0) throw new Error("Request not found.");
    if (req.rows[0].status !== "pending") throw new Error("Request has already been decided.");
    const actor = await resolveActor(client);
    await client.query(
      "UPDATE asset_requests SET status = $1, decided_at = now() WHERE id = $2",
      [decision, id]
    );
    await writeAuditLog(
      {
        actorUserId: actor.id, actorLabel: actor.label,
        action: decision === "approved" ? "Approved asset request" : "Denied asset request",
        recordType: "request", recordId: req.rows[0].request_number,
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
