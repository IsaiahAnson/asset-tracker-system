import { getPool } from "@/lib/db";
import { formatEastern } from "@/lib/audit";

// ============================================================================
// Workflow detail + step path.
//
// Every workflow has a step-by-step path. Where the workflow carries staged
// approvals (stage_index set, e.g. the sensitive-asset chain), the path is
// built from those approvals so each point shows its approver and decision.
// Otherwise the path is the canonical sequence for the workflow type, with the
// current point derived from the workflow's stage. This drives the stepper on
// the workflow detail page, which updates as stages complete.
// ============================================================================

export type StepState = "done" | "current" | "pending" | "denied";
export type WorkflowStep = { label: string; caption?: string; state: StepState };

export type WorkflowApprovalRow = {
  approvalNumber: string;
  stageName: string | null;
  approver: string | null;
  status: string;
  decidedAt: string | null;
  notes: string | null;
};

export type WorkflowDetail = {
  id: string;
  workflowNumber: string;
  type: string;
  typeLabel: string;
  statusLabel: string;
  status: string;
  stage: string;
  subject: string | null;
  owner: string | null;
  office: string | null;
  dueOn: string | null;
  steps: WorkflowStep[];
  currentStep: string | null;
  nextStep: string | null;
  approvals: WorkflowApprovalRow[];
};

const TYPE_LABELS: Record<string, string> = {
  onboarding: "Onboarding",
  offboarding: "Offboarding",
  transfer: "Transfer",
  disposition: "Disposition",
  access_request: "Access request"
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_review: "In review",
  ready: "Ready",
  at_risk: "At risk",
  completed: "Completed",
  cancelled: "Cancelled"
};

// Canonical step path per workflow type. The workflow's free-text `stage` is
// matched against these (case-insensitive, either direction) to find the
// current point.
const CANONICAL_STAGES: Record<string, string[]> = {
  onboarding: ["New hire received", "Equipment provisioning", "Approval", "Issued"],
  offboarding: ["Initiated", "Equipment return", "Verification", "Closed"],
  transfer: ["Requested", "Approver review", "Reassigned", "Complete"],
  disposition: ["Requested", "Escalated review", "Authorization", "Disposed"],
  access_request: ["Requested", "Division Lead", "Internal Affairs", "Authorization"]
};

function matchStageIndex(stages: string[], stage: string): number {
  const s = stage.trim().toLowerCase();
  for (let i = 0; i < stages.length; i += 1) {
    const c = stages[i].toLowerCase();
    if (s.includes(c) || c.includes(s)) return i;
  }
  return 0;
}

export async function getWorkflowDetail(id: string): Promise<WorkflowDetail | null> {
  const pool = getPool();
  const wf = await pool.query<{
    id: string;
    workflow_number: string;
    workflow_type: string;
    status: string;
    stage: string;
    due_on: string | null;
    subject: string | null;
    owner: string | null;
    office: string | null;
  }>(
    `SELECT w.id, w.workflow_number, w.workflow_type, w.status, w.stage,
            to_char(w.due_on, 'YYYY-MM-DD') AS due_on,
            subj.display_name AS subject, own.display_name AS owner, g.name AS office
       FROM workflows w
       LEFT JOIN app_users subj ON subj.id = w.subject_user_id
       LEFT JOIN app_users own  ON own.id  = w.owner_user_id
       LEFT JOIN groups g ON g.id = w.group_id
      WHERE w.id = $1`,
    [id]
  );
  if (wf.rowCount === 0) return null;
  const row = wf.rows[0];

  const apprRes = await pool.query<{
    approval_number: string;
    stage_index: number | null;
    stage_name: string | null;
    approver: string | null;
    status: string;
    decided_at: string | null;
    decision_notes: string | null;
  }>(
    `SELECT a.approval_number, a.stage_index, a.stage_name, a.status,
            u.display_name AS approver, a.decided_at, a.decision_notes
       FROM approvals a
       LEFT JOIN app_users u ON u.id = a.approver_user_id
      WHERE a.workflow_id = $1
      ORDER BY a.stage_index NULLS LAST, a.submitted_at`,
    [id]
  );

  const approvals: WorkflowApprovalRow[] = apprRes.rows.map((a) => ({
    approvalNumber: a.approval_number,
    stageName: a.stage_name,
    approver: a.approver,
    status: a.status,
    decidedAt: a.decided_at ? formatEastern(a.decided_at) : null,
    notes: a.decision_notes
  }));

  const staged = apprRes.rows.filter((a) => a.stage_index !== null);
  let steps: WorkflowStep[];

  if (staged.length > 0) {
    // Build the path from the staged approval chain.
    const firstPending = staged.findIndex((a) => a.status === "pending" || a.status === "escalated");
    steps = staged.map((a, i) => {
      let state: StepState;
      if (a.status === "approved") state = "done";
      else if (a.status === "denied" || a.status === "cancelled") state = "denied";
      else if (i === firstPending) state = "current";
      else state = "pending";
      const caption =
        a.status === "approved"
          ? `Approved by ${a.approver ?? "approver"}`
          : a.status === "denied"
            ? `Denied by ${a.approver ?? "approver"}`
            : a.approver
              ? `Assigned to ${a.approver}`
              : undefined;
      return { label: a.stage_name ?? `Stage ${i + 1}`, caption, state };
    });
  } else {
    // Build the path from the canonical sequence for this workflow type.
    const seq = CANONICAL_STAGES[row.workflow_type] ?? ["Requested", "In review", "Complete"];
    const completed = row.status === "completed";
    const cancelled = row.status === "cancelled";
    const current = completed ? seq.length : matchStageIndex(seq, row.stage);
    steps = seq.map((label, i) => {
      let state: StepState;
      if (completed || i < current) state = "done";
      else if (i === current) state = cancelled ? "denied" : "current";
      else state = "pending";
      return { label, state };
    });
  }

  const currentStep = steps.find((s) => s.state === "current")?.label ?? null;
  const firstPendingAfter = steps.find((s) => s.state === "pending");
  const nextStep = currentStep
    ? firstPendingAfter?.label ?? "Complete"
    : steps.every((s) => s.state === "done")
      ? "Complete"
      : null;

  return {
    id: row.id,
    workflowNumber: row.workflow_number,
    type: row.workflow_type,
    typeLabel: TYPE_LABELS[row.workflow_type] ?? row.workflow_type,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] ?? row.status,
    stage: row.stage,
    subject: row.subject,
    owner: row.owner,
    office: row.office,
    dueOn: row.due_on,
    steps,
    currentStep,
    nextStep,
    approvals
  };
}
