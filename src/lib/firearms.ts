import { getPool } from "@/lib/db";
import { writeAuditLog, resolveActor, formatEastern } from "@/lib/audit";

// ============================================================================
// Firearms module library. Extends the original read-only inventory query to
// also surface body armor, warehouse-entity custodians, mandatory verification
// checks, and multi-stage approval stages — the workflow vocabulary
// firearms coordinators use for sensitive-asset custody.
//
// The page-level access gate is still actingUserHasFirearmAccess() in
// authz.ts. The lib layer enforces the same boundary by virtue of every
// query joining asset_categories on the high_sensitivity = true category
// codes (firearms, body_armor).
// ============================================================================

// ---------------------------------------------------------------------------
// Listing: firearms + body armor
// ---------------------------------------------------------------------------

export type FirearmRow = {
  id: string;
  assetTag: string;
  make: string;
  model: string;
  serialNumber: string | null;
  status: string;
  custodian: string;
  custodianIsEntity: boolean;
  office: string | null;
  acquiredOn: string | null;
  verifications: { passed: number; pending: number; failed: number; expired: number; total: number };
};

// Latest verification-state summary per asset, computed in SQL so the listing
// can show "3/3 checks passed" badges without an N+1 round-trip per row.
const VERIFICATION_SUMMARY_SQL = `
  COALESCE((
    SELECT jsonb_build_object(
      'passed',  count(*) FILTER (WHERE status = 'passed'),
      'pending', count(*) FILTER (WHERE status = 'pending'),
      'failed',  count(*) FILTER (WHERE status = 'failed'),
      'expired', count(*) FILTER (WHERE status = 'expired'),
      'total',   count(*)
    )
    FROM sensitive_asset_verifications v WHERE v.asset_id = a.id
  ), '{"passed":0,"pending":0,"failed":0,"expired":0,"total":0}'::jsonb) AS verifications
`;

async function listSensitiveCategory(categoryCode: "firearms" | "body_armor"): Promise<FirearmRow[]> {
  const r = await getPool().query<{
    id: string;
    asset_tag: string;
    manufacturer: string | null;
    model: string | null;
    serial_number: string | null;
    status: string;
    custodian: string | null;
    custodian_is_entity: boolean | null;
    office: string | null;
    acquired_on: string | null;
    verifications: {
      passed: number;
      pending: number;
      failed: number;
      expired: number;
      total: number;
    };
  }>(
    `SELECT a.id, a.asset_tag, a.manufacturer, a.model, a.serial_number, a.status,
            u.display_name AS custodian, u.is_entity AS custodian_is_entity, a.office,
            to_char(a.acquired_on, 'YYYY-MM-DD') AS acquired_on,
            ${VERIFICATION_SUMMARY_SQL}
       FROM assets a
       JOIN asset_categories c ON c.id = a.category_id
       LEFT JOIN app_users u ON u.id = a.current_custodian_id
      WHERE c.code = $1 AND a.status <> 'retired'
      ORDER BY a.asset_tag`,
    [categoryCode]
  );
  return r.rows.map((row) => ({
    id: row.id,
    assetTag: row.asset_tag,
    make: row.manufacturer ?? "Unknown",
    model: row.model ?? "",
    serialNumber: row.serial_number,
    status: row.status,
    custodian: row.custodian ?? "Unassigned",
    custodianIsEntity: Boolean(row.custodian_is_entity),
    office: row.office,
    acquiredOn: row.acquired_on,
    verifications: row.verifications
  }));
}

export async function listFirearms(): Promise<FirearmRow[]> {
  return listSensitiveCategory("firearms");
}

export async function listBodyArmor(): Promise<FirearmRow[]> {
  return listSensitiveCategory("body_armor");
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export type FirearmDetail = {
  id: string;
  assetTag: string;
  category: "firearms" | "body_armor";
  categoryLabel: string;
  manufacturer: string | null;
  model: string | null;
  serial: string | null;
  status: string;
  office: string | null;
  group: string | null;
  custodian: string | null;
  custodianId: string | null;
  custodianIsEntity: boolean;
  acquiredOn: string | null;
  notes: string | null;
};

export async function getFirearmDetail(id: string): Promise<FirearmDetail | null> {
  const r = await getPool().query<{
    id: string;
    asset_tag: string;
    category_code: string;
    category_name: string;
    manufacturer: string | null;
    model: string | null;
    serial_number: string | null;
    status: string;
    office: string | null;
    group_name: string | null;
    custodian: string | null;
    custodian_id: string | null;
    custodian_is_entity: boolean | null;
    acquired_on: string | null;
    notes: string | null;
  }>(
    `SELECT a.id, a.asset_tag, c.code AS category_code, c.name AS category_name,
            a.manufacturer, a.model, a.serial_number, a.status, a.office,
            g.name AS group_name,
            u.display_name AS custodian, u.id AS custodian_id, u.is_entity AS custodian_is_entity,
            to_char(a.acquired_on, 'YYYY-MM-DD') AS acquired_on, a.notes
       FROM assets a
       JOIN asset_categories c ON c.id = a.category_id
       LEFT JOIN groups g ON g.id = a.group_id
       LEFT JOIN app_users u ON u.id = a.current_custodian_id
      WHERE a.id = $1
        AND c.code IN ('firearms', 'body_armor')`,
    [id]
  );
  if (r.rowCount === 0) return null;
  const row = r.rows[0];
  const category = row.category_code === "body_armor" ? "body_armor" : "firearms";
  return {
    id: row.id,
    assetTag: row.asset_tag,
    category,
    categoryLabel: row.category_name,
    manufacturer: row.manufacturer,
    model: row.model,
    serial: row.serial_number,
    status: row.status,
    office: row.office,
    group: row.group_name,
    custodian: row.custodian,
    custodianId: row.custodian_id,
    custodianIsEntity: Boolean(row.custodian_is_entity),
    acquiredOn: row.acquired_on,
    notes: row.notes
  };
}

// ---------------------------------------------------------------------------
// Verifications (NCIC, armor inspection, etc.)
// ---------------------------------------------------------------------------

export const VERIFICATION_LABELS: Record<string, string> = {
  ncic_background: "Federal Background Check (NCIC) Cleared",
  armor_inspection: "Bi-Annual Armor Inspection Passed",
  deployment_justification: "Deployment Justification Validated",
  qualification: "Range Qualification Current",
  medical_clearance: "Medical Clearance on File"
};

export function verificationLabel(checkType: string): string {
  return VERIFICATION_LABELS[checkType] ?? checkType;
}

export type VerificationStatus = "passed" | "pending" | "failed" | "expired";

export type FirearmVerification = {
  id: string;
  checkType: string;
  label: string;
  status: VerificationStatus;
  verifiedBy: string | null;
  verifiedByUserId: string | null;
  verifiedAt: string | null;
  expiresOn: string | null;
  expiringSoon: boolean;
  notes: string | null;
};

// Mandatory checks every sensitive-asset record is expected to have, rendered
// in this order on the detail page. If a check is missing we still show its
// row with status "missing" so the gap is visible (rather than silently
// passing). Order matches the approval flow.
export const MANDATORY_CHECKS: { code: string; label: string }[] = [
  { code: "ncic_background", label: VERIFICATION_LABELS.ncic_background },
  { code: "armor_inspection", label: VERIFICATION_LABELS.armor_inspection },
  { code: "deployment_justification", label: VERIFICATION_LABELS.deployment_justification }
];

export async function listFirearmVerifications(assetId: string): Promise<FirearmVerification[]> {
  const r = await getPool().query<{
    id: string;
    check_type: string;
    status: VerificationStatus;
    verified_by: string | null;
    verified_by_user_id: string | null;
    verified_at: string | null;
    expires_on: string | null;
    notes: string | null;
  }>(
    `SELECT v.id, v.check_type, v.status,
            u.display_name AS verified_by, v.verified_by_user_id,
            v.verified_at,
            to_char(v.expires_on, 'YYYY-MM-DD') AS expires_on,
            v.notes
       FROM sensitive_asset_verifications v
       LEFT JOIN app_users u ON u.id = v.verified_by_user_id
      WHERE v.asset_id = $1
      ORDER BY
        CASE v.check_type
          WHEN 'ncic_background' THEN 1
          WHEN 'armor_inspection' THEN 2
          WHEN 'deployment_justification' THEN 3
          WHEN 'qualification' THEN 4
          WHEN 'medical_clearance' THEN 5
          ELSE 99
        END`,
    [assetId]
  );
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  return r.rows.map((row) => {
    const expiresMs = row.expires_on ? Date.parse(row.expires_on) : null;
    return {
      id: row.id,
      checkType: row.check_type,
      label: verificationLabel(row.check_type),
      status: row.status,
      verifiedBy: row.verified_by,
      verifiedByUserId: row.verified_by_user_id,
      verifiedAt: row.verified_at ? formatEastern(row.verified_at) : null,
      expiresOn: row.expires_on,
      expiringSoon:
        row.status === "passed" &&
        expiresMs !== null &&
        expiresMs - now > 0 &&
        expiresMs - now < ninetyDaysMs,
      notes: row.notes
    };
  });
}

// Returns the gating decision: can this sensitive asset be issued/transferred?
// All MANDATORY_CHECKS must be present and currently 'passed'.
export type ClearanceState = {
  cleared: boolean;
  missing: string[]; // check_type codes
  failing: string[]; // check_type codes
};

export function evaluateClearance(verifications: FirearmVerification[]): ClearanceState {
  const byType = new Map(verifications.map((v) => [v.checkType, v]));
  const missing: string[] = [];
  const failing: string[] = [];
  for (const check of MANDATORY_CHECKS) {
    const v = byType.get(check.code);
    if (!v) {
      missing.push(check.code);
    } else if (v.status !== "passed") {
      failing.push(check.code);
    }
  }
  return {
    cleared: missing.length === 0 && failing.length === 0,
    missing,
    failing
  };
}

// ---------------------------------------------------------------------------
// Multi-stage approval (the stepper)
// ---------------------------------------------------------------------------

export type ApprovalStage = {
  id: string;
  approvalNumber: string;
  stageIndex: number;
  stageName: string;
  status: "pending" | "approved" | "denied" | "escalated" | "cancelled";
  approver: string | null;
  decidedAt: string | null;
  notes: string | null;
};

export type FirearmApprovalWorkflow = {
  workflowId: string;
  workflowNumber: string;
  workflowType: string;
  currentStage: string;
  subject: string | null;
  owner: string | null;
  stages: ApprovalStage[];
};

// Pulls the most-recent in-flight (or recently-completed) sensitive-asset
// approval workflow tied to a given asset by matching the asset_tag inside
// the approval request_summary. (Workflows currently don't carry an explicit
// asset_id; reusing request_summary keeps this lib drop-in without further
// schema migration. A dedicated workflow_subject_asset_id column is in the
// follow-on backlog.)
export async function getFirearmApprovalWorkflow(
  assetTag: string
): Promise<FirearmApprovalWorkflow | null> {
  const pool = getPool();
  const wfRes = await pool.query<{
    id: string;
    workflow_number: string;
    workflow_type: string;
    stage: string;
    subject: string | null;
    owner: string | null;
  }>(
    `SELECT w.id, w.workflow_number, w.workflow_type, w.stage,
            subj.display_name AS subject, own.display_name AS owner
       FROM workflows w
       LEFT JOIN app_users subj ON subj.id = w.subject_user_id
       LEFT JOIN app_users own  ON own.id  = w.owner_user_id
       JOIN approvals ap ON ap.workflow_id = w.id
      WHERE ap.request_summary ILIKE '%' || $1 || '%'
      ORDER BY w.updated_at DESC NULLS LAST, w.created_at DESC
      LIMIT 1`,
    [assetTag]
  );
  if (wfRes.rowCount === 0) return null;
  const wf = wfRes.rows[0];

  const stagesRes = await pool.query<{
    id: string;
    approval_number: string;
    stage_index: number | null;
    stage_name: string | null;
    status: ApprovalStage["status"];
    approver: string | null;
    decided_at: string | null;
    notes: string | null;
  }>(
    `SELECT a.id, a.approval_number, a.stage_index, a.stage_name, a.status,
            u.display_name AS approver, a.decided_at, a.decision_notes AS notes
       FROM approvals a
       LEFT JOIN app_users u ON u.id = a.approver_user_id
      WHERE a.workflow_id = $1
      ORDER BY a.stage_index NULLS LAST, a.submitted_at`,
    [wf.id]
  );

  return {
    workflowId: wf.id,
    workflowNumber: wf.workflow_number,
    workflowType: wf.workflow_type,
    currentStage: wf.stage,
    subject: wf.subject,
    owner: wf.owner,
    stages: stagesRes.rows.map((row) => ({
      id: row.id,
      approvalNumber: row.approval_number,
      stageIndex: row.stage_index ?? 0,
      stageName: row.stage_name ?? "Stage",
      status: row.status,
      approver: row.approver,
      decidedAt: row.decided_at ? formatEastern(row.decided_at) : null,
      notes: row.notes
    }))
  };
}

// ---------------------------------------------------------------------------
// Custody log (alias around the existing asset-detail query, but filtered
// to sensitive categories so this lib stays self-contained for the firearm
// detail page).
// ---------------------------------------------------------------------------

export type FirearmCustodyEvent = {
  id: string;
  eventType: string;
  eventAt: string;
  from: string | null;
  fromId: string | null;
  fromIsEntity: boolean;
  to: string | null;
  toId: string | null;
  toIsEntity: boolean;
  performedBy: string;
  performedById: string;
  notes: string | null;
};

export async function listFirearmCustodyEvents(assetId: string): Promise<FirearmCustodyEvent[]> {
  const r = await getPool().query<{
    id: string;
    event_type: string;
    event_at: string;
    from_name: string | null;
    from_id: string | null;
    from_is_entity: boolean | null;
    to_name: string | null;
    to_id: string | null;
    to_is_entity: boolean | null;
    performed_by_name: string;
    performed_by_id: string;
    notes: string | null;
  }>(
    `SELECT e.id, e.event_type, e.event_at,
            fu.display_name AS from_name, e.from_user_id AS from_id, fu.is_entity AS from_is_entity,
            tu.display_name AS to_name,   e.to_user_id   AS to_id,   tu.is_entity AS to_is_entity,
            pb.display_name AS performed_by_name, e.performed_by AS performed_by_id,
            e.notes
       FROM custody_events e
       LEFT JOIN app_users fu ON fu.id = e.from_user_id
       LEFT JOIN app_users tu ON tu.id = e.to_user_id
       JOIN app_users pb ON pb.id = e.performed_by
      WHERE e.asset_id = $1
      ORDER BY e.event_at DESC`,
    [assetId]
  );
  return r.rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    eventAt: formatEastern(row.event_at),
    from: row.from_name,
    fromId: row.from_id,
    fromIsEntity: Boolean(row.from_is_entity),
    to: row.to_name,
    toId: row.to_id,
    toIsEntity: Boolean(row.to_is_entity),
    performedBy: row.performed_by_name,
    performedById: row.performed_by_id,
    notes: row.notes
  }));
}

// ---------------------------------------------------------------------------
// Lookups for action forms
// ---------------------------------------------------------------------------

export type EntityOption = { id: string; displayName: string };

// Returns warehouse/armory entities only — the legitimate destinations for
// surrendered firearms / body armor, which are held by an entity (such as a
// warehouse) rather than a person between assignments.
export async function listEntities(): Promise<EntityOption[]> {
  const r = await getPool().query<{ id: string; display_name: string }>(
    `SELECT id, display_name FROM app_users
      WHERE active = true AND is_entity = true
      ORDER BY display_name`
  );
  return r.rows.map((row) => ({ id: row.id, displayName: row.display_name }));
}

// People (not entities) who carry firearm_access, for issuance.
export async function listFirearmsAuthorizedPeople(): Promise<EntityOption[]> {
  const r = await getPool().query<{ id: string; display_name: string }>(
    `SELECT id, display_name FROM app_users
      WHERE active = true AND is_entity = false AND firearm_access = true
      ORDER BY display_name`
  );
  return r.rows.map((row) => ({ id: row.id, displayName: row.display_name }));
}

// ---------------------------------------------------------------------------
// Server action: surrender to warehouse / armory entity
// ---------------------------------------------------------------------------

// Surrender = transfer a sensitive asset to a non-person entity (warehouse,
// armory, evidence room). Re-uses the existing custody_events flow with
// event_type = 'transfer'; the audit metadata records is_surrender = true
// so the audit log can distinguish operational surrenders from peer-to-
// peer transfers. (The audit log row also captures the entity name, so
// reports filtered by record can show "Returned to Atlanta Armory.")
export async function surrenderToEntity(
  assetTag: string,
  toEntityId: string,
  reason?: string
): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const asset = await client.query<{ id: string; current_custodian_id: string | null; status: string }>(
      `SELECT a.id, a.current_custodian_id, a.status
         FROM assets a
         JOIN asset_categories c ON c.id = a.category_id
        WHERE a.asset_tag = $1 AND c.code IN ('firearms', 'body_armor')
        FOR UPDATE`,
      [assetTag]
    );
    if (asset.rowCount === 0) {
      throw new Error(`Sensitive asset ${assetTag} not found.`);
    }
    if (asset.rows[0].status === "retired") {
      throw new Error(`Asset ${assetTag} is retired and cannot be surrendered.`);
    }

    const entity = await client.query<{ id: string; display_name: string; is_entity: boolean }>(
      "SELECT id, display_name, is_entity FROM app_users WHERE id = $1 AND active = true",
      [toEntityId]
    );
    if (entity.rowCount === 0) {
      throw new Error("Surrender destination not found.");
    }
    if (!entity.rows[0].is_entity) {
      throw new Error("Surrender destination must be a warehouse or armory entity, not a person.");
    }

    const fromUserId = asset.rows[0].current_custodian_id;
    const actor = await resolveActor(client);

    await client.query(
      `UPDATE assets
          SET current_custodian_id = $1, status = 'assigned', expected_return_on = NULL
        WHERE id = $2`,
      [toEntityId, asset.rows[0].id]
    );

    await client.query(
      `INSERT INTO custody_events
         (asset_id, from_user_id, to_user_id, event_type, performed_by, notes)
       VALUES ($1, $2, $3, 'transfer', $4, $5)`,
      [
        asset.rows[0].id,
        fromUserId,
        toEntityId,
        actor.id,
        reason ? `Surrender to ${entity.rows[0].display_name}: ${reason}` : `Surrender to ${entity.rows[0].display_name}`
      ]
    );

    await writeAuditLog(
      {
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: "Surrendered sensitive asset to entity",
        recordType: "asset",
        recordId: assetTag,
        metadata: {
          fromUserId,
          toEntityId,
          toEntityName: entity.rows[0].display_name,
          isSurrender: true,
          reason: reason ?? null
        }
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

// ---------------------------------------------------------------------------
// Server action: record verification result
// ---------------------------------------------------------------------------

export type VerificationInput = {
  assetTag: string;
  checkType: string;
  status: VerificationStatus;
  expiresOn?: string | null;
  notes?: string | null;
};

// Upserts a verification row (one current state per check per asset) and
// audits the change. Caller must be a firearms coordinator (enforced at
// the action wrapper in firearm-actions.ts).
export async function recordVerification(input: VerificationInput): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const asset = await client.query<{ id: string }>(
      `SELECT a.id FROM assets a
         JOIN asset_categories c ON c.id = a.category_id
        WHERE a.asset_tag = $1 AND c.code IN ('firearms', 'body_armor')`,
      [input.assetTag]
    );
    if (asset.rowCount === 0) {
      throw new Error(`Sensitive asset ${input.assetTag} not found.`);
    }

    const actor = await resolveActor(client);

    await client.query(
      `INSERT INTO sensitive_asset_verifications
         (asset_id, check_type, status, verified_by_user_id, verified_at, expires_on, notes)
       VALUES ($1, $2, $3, $4, now(), $5, $6)
       ON CONFLICT (asset_id, check_type) DO UPDATE
         SET status = EXCLUDED.status,
             verified_by_user_id = EXCLUDED.verified_by_user_id,
             verified_at = EXCLUDED.verified_at,
             expires_on = EXCLUDED.expires_on,
             notes = EXCLUDED.notes`,
      [
        asset.rows[0].id,
        input.checkType,
        input.status,
        actor.id,
        input.expiresOn ?? null,
        input.notes ?? null
      ]
    );

    await writeAuditLog(
      {
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: "Recorded sensitive-asset verification",
        recordType: "asset",
        recordId: input.assetTag,
        metadata: {
          checkType: input.checkType,
          status: input.status,
          expiresOn: input.expiresOn ?? null
        }
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
