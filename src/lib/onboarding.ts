import { getPool } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

// ============================================================================
// Onboarding intake — the start of the asset lifecycle.
//
// In production an HRIS new-hire event arrives through MuleSoft and
// opens an onboarding workflow automatically. That live pull is a later Phase.
// For the demo, the Integrations "Sync now" button calls
// createSimulatedOnboarding() so the client can SEE the first pull land: a new
// hire appears and their onboarding workflow opens, which then flows into
// provisioning and issuing a laptop.
//
// Everything created here is clearly a SIMULATION: the workflow number is
// prefixed WF-SIM- and the person carries a sim: external_id, so it is easy to
// identify and is wiped by reset-db.sh.
// ============================================================================

const FIRST_NAMES = [
  "Priya", "Marcus", "Elena", "Devon", "Aisha",
  "Caleb", "Nina", "Omar", "Rosa", "Theo"
];
const LAST_NAMES = [
  "Nair", "Webb", "Ortiz", "Brooks", "Khan",
  "Reyes", "Cole", "Hassan", "Flynn", "Park"
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export type SimulatedOnboarding = {
  workflowNumber: string;
  hireName: string;
  personalEmail: string;
  office: string;
  startDate: string;
};

// Creates a simulated new hire + their onboarding workflow in one transaction.
// Returns the details so the caller (the sync route) can describe the event.
export async function createSimulatedOnboarding(): Promise<SimulatedOnboarding> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Default group for the simulated hire (fall back to any group).
    const group = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM groups
        ORDER BY (code = 'NWA-HQ') DESC, name
        LIMIT 1`
    );
    if (group.rowCount === 0) {
      throw new Error("No group available to attach the simulated hire to.");
    }

    // Owner = a seeded asset manager (the person responsible for provisioning),
    // falling back to any active person.
    const owner = await client.query<{ id: string }>(
      `SELECT u.id
         FROM app_users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
        WHERE u.active = true AND u.is_entity = false
        ORDER BY (r.code = 'asset_manager') DESC NULLS LAST, u.display_name
        LIMIT 1`
    );
    if (owner.rowCount === 0) {
      throw new Error("No active user available to own the onboarding workflow.");
    }

    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const hireName = `${first} ${last}`;
    // Unique suffix so the gov email (UNIQUE) and identifiers never collide.
    const suffix = `${Date.now().toString(36)}${Math.floor(100 + Math.random() * 900)}`;
    const slug = `${first}.${last}.${suffix}`.toLowerCase();
    const personalEmail = `${first}.${last}.${suffix}@example.com`.toLowerCase();
    const govEmail = `${slug}@northwind.example`;

    // Start date a few days out, mirroring the P4P "2 to 5 days before start"
    // lead time the asset team works against.
    const start = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    const startDate = start.toISOString().slice(0, 10);

    const person = await client.query<{ id: string }>(
      `INSERT INTO app_users (external_id, email, personal_email, display_name, group_id, firearm_access, active)
       VALUES ($1, $2, $3, $4, $5, false, true)
       RETURNING id`,
      [`sim:${suffix}`, govEmail, personalEmail, hireName, group.rows[0].id]
    );

    const workflowNumber = `WF-SIM-${suffix.toUpperCase()}`;
    await client.query(
      `INSERT INTO workflows
         (workflow_number, group_id, workflow_type, subject_user_id, owner_user_id, status, stage, due_on)
       VALUES ($1, $2, 'onboarding', $3, $4, 'in_review', 'Equipment provisioning', $5)`,
      [workflowNumber, group.rows[0].id, person.rows[0].id, owner.rows[0].id, startDate]
    );

    await writeAuditLog(
      {
        actorLabel: "HRIS intake (simulated)",
        action: "Opened onboarding workflow",
        recordType: "workflow",
        recordId: workflowNumber,
        metadata: { hire: hireName, personalEmail, startDate, simulated: true }
      },
      client
    );

    await client.query("COMMIT");
    return { workflowNumber, hireName, personalEmail, office: group.rows[0].name, startDate };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type OnboardingIntakeRow = {
  id: string;
  workflowNumber: string;
  hireName: string;
  personalEmail: string | null;
  office: string | null;
  startDate: string | null;
  stage: string;
  status: string;
  simulated: boolean;
};

// Lists onboarding workflows from the DB, newest first. Simulated pulls
// (WF-SIM-*) sort to the top because they are freshly created.
export async function listOnboardingIntake(limit = 8): Promise<OnboardingIntakeRow[]> {
  const r = await getPool().query<{
    id: string;
    workflow_number: string;
    hire_name: string | null;
    personal_email: string | null;
    office: string | null;
    start_date: string | null;
    stage: string;
    status: string;
  }>(
    `SELECT w.id,
            w.workflow_number,
            s.display_name AS hire_name,
            s.personal_email,
            g.name AS office,
            to_char(w.due_on, 'YYYY-MM-DD') AS start_date,
            w.stage,
            w.status
       FROM workflows w
       LEFT JOIN app_users s ON s.id = w.subject_user_id
       LEFT JOIN groups g ON g.id = w.group_id
      WHERE w.workflow_type = 'onboarding'
      ORDER BY w.created_at DESC
      LIMIT $1`,
    [limit]
  );
  return r.rows.map((row) => ({
    id: row.id,
    workflowNumber: row.workflow_number,
    hireName: row.hire_name ?? "Unassigned",
    personalEmail: row.personal_email,
    office: row.office,
    startDate: row.start_date,
    stage: row.stage,
    status: row.status,
    simulated: row.workflow_number.startsWith("WF-SIM-")
  }));
}
