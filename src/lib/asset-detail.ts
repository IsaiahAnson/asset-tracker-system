import { getPool } from "@/lib/db";
import { formatEastern } from "@/lib/audit";

export type AssetDetail = {
  id: string;
  assetTag: string;
  model: string;
  manufacturer: string | null;
  serial: string | null;
  category: string | null;
  categoryCode: string | null;
  office: string | null;
  group: string | null;
  status: string;
  custodianId: string | null;
  custodian: string | null;
  highSensitivity: boolean;
  acquiredOn: string | null;
  disposedOn: string | null;
  expectedReturn: string | null;
  notes: string | null;
  createdAt: string;
};

export async function getAssetDetail(id: string): Promise<AssetDetail | null> {
  const result = await getPool().query<{
    id: string;
    asset_tag: string;
    manufacturer: string | null;
    model: string | null;
    serial_number: string | null;
    category: string | null;
    category_code: string | null;
    office: string | null;
    group_name: string | null;
    status: string;
    custodian_id: string | null;
    custodian: string | null;
    high_sensitivity: boolean;
    acquired_on: string | null;
    disposed_on: string | null;
    expected_return: string | null;
    notes: string | null;
    created_at: string;
  }>(
    `SELECT a.id, a.asset_tag, a.manufacturer, a.model, a.serial_number,
            c.name AS category, c.code AS category_code,
            a.office, g.name AS group_name, a.status,
            a.current_custodian_id AS custodian_id, u.display_name AS custodian,
            a.high_sensitivity,
            to_char(a.acquired_on, 'YYYY-MM-DD') AS acquired_on,
            to_char(a.disposed_on, 'YYYY-MM-DD') AS disposed_on,
            to_char(a.expected_return_on, 'YYYY-MM-DD') AS expected_return,
            a.notes,
            to_char(a.created_at, 'YYYY-MM-DD') AS created_at
       FROM assets a
       JOIN asset_categories c ON c.id = a.category_id
       LEFT JOIN groups g ON g.id = a.group_id
       LEFT JOIN app_users u ON u.id = a.current_custodian_id
      WHERE a.id = $1`,
    [id]
  );
  if (result.rowCount === 0) return null;
  const r = result.rows[0];
  return {
    id: r.id,
    assetTag: r.asset_tag,
    model: [r.manufacturer, r.model].filter(Boolean).join(" ") || "Computer",
    manufacturer: r.manufacturer,
    serial: r.serial_number,
    category: r.category,
    categoryCode: r.category_code,
    office: r.office,
    group: r.group_name,
    status: r.status,
    custodianId: r.custodian_id,
    custodian: r.custodian,
    highSensitivity: r.high_sensitivity,
    acquiredOn: r.acquired_on,
    disposedOn: r.disposed_on,
    expectedReturn: r.expected_return,
    notes: r.notes,
    createdAt: r.created_at
  };
}

export type CustodyEvent = {
  id: string;
  eventType: string;
  eventAt: string;
  fromUser: string | null;
  fromUserId: string | null;
  toUser: string | null;
  toUserId: string | null;
  performedBy: string;
  performedById: string;
  notes: string | null;
};

const EVENT_LABELS: Record<string, string> = {
  issue: "Issued",
  transfer: "Transferred",
  return: "Checked in",
  disposition: "Dispositioned",
  missing_report: "Reported missing"
};

export function custodyEventLabel(type: string): string {
  return EVENT_LABELS[type] ?? type;
}

export async function listAssetCustodyEvents(assetId: string): Promise<CustodyEvent[]> {
  const result = await getPool().query<{
    id: string;
    event_type: string;
    event_at: string;
    from_user: string | null;
    from_user_id: string | null;
    to_user: string | null;
    to_user_id: string | null;
    performed_by: string;
    performed_by_id: string;
    notes: string | null;
  }>(
    `SELECT e.id, e.event_type, e.event_at,
            fu.display_name AS from_user, e.from_user_id,
            tu.display_name AS to_user, e.to_user_id,
            pb.display_name AS performed_by, e.performed_by AS performed_by_id,
            e.notes
       FROM custody_events e
       LEFT JOIN app_users fu ON fu.id = e.from_user_id
       LEFT JOIN app_users tu ON tu.id = e.to_user_id
       JOIN app_users pb ON pb.id = e.performed_by
      WHERE e.asset_id = $1
      ORDER BY e.event_at DESC`,
    [assetId]
  );
  return result.rows.map((r) => ({
    id: r.id,
    eventType: r.event_type,
    eventAt: formatEastern(r.event_at),
    fromUser: r.from_user,
    fromUserId: r.from_user_id,
    toUser: r.to_user,
    toUserId: r.to_user_id,
    performedBy: r.performed_by,
    performedById: r.performed_by_id,
    notes: r.notes
  }));
}

export type AssetComponent = {
  assignmentId: string;
  componentId: string;
  name: string;
  qty: number;
  assignedOn: string;
};

export async function listAssetComponents(assetId: string): Promise<AssetComponent[]> {
  const result = await getPool().query<{
    assignment_id: string;
    component_id: string;
    name: string;
    assigned_qty: number;
    assigned_on: string;
  }>(
    `SELECT ca.id AS assignment_id, ca.component_id, c.name,
            ca.assigned_qty, to_char(ca.created_at, 'YYYY-MM-DD') AS assigned_on
       FROM component_assignments ca
       JOIN components c ON c.id = ca.component_id
      WHERE ca.asset_id = $1
      ORDER BY ca.created_at DESC`,
    [assetId]
  );
  return result.rows.map((r) => ({
    assignmentId: r.assignment_id,
    componentId: r.component_id,
    name: r.name,
    qty: r.assigned_qty,
    assignedOn: r.assigned_on
  }));
}

export type AssetAuditEntry = {
  id: string;
  timestamp: string;
  actor: string;
  actorUserId: string | null;
  action: string;
  result: string;
};

export async function listAssetAuditEntries(assetTag: string): Promise<AssetAuditEntry[]> {
  const result = await getPool().query<{
    audit_number: string;
    actor_label: string;
    actor_user_id: string | null;
    action: string;
    result: string;
    created_at: string;
  }>(
    `SELECT audit_number, actor_label, actor_user_id, action, result, created_at
       FROM audit_log
      WHERE record_type = 'asset' AND record_id = $1
      ORDER BY created_at DESC`,
    [assetTag]
  );
  return result.rows.map((r) => ({
    id: r.audit_number,
    timestamp: formatEastern(r.created_at),
    actor: r.actor_label,
    actorUserId: r.actor_user_id,
    action: r.action,
    result: r.result
  }));
}
