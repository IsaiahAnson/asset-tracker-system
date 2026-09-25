import { getActingUser, getActingUserId } from "@/lib/session";
import { setFlash } from "@/lib/flash";
import { getPool } from "@/lib/db";

// Roles that may not perform any mutation. This is a minimal write/no-write
// gate; a full role/permission matrix (per-action, group-scoped, sensitivity)
// is the larger access-control work (issues #29/#31). Enforced server-side in
// every mutating action so UI visibility never grants access.
const READ_ONLY_ROLES = new Set(["read_only"]);

export async function canActingUserWrite(): Promise<boolean> {
  const user = await getActingUser();
  if (user?.roleCode && READ_ONLY_ROLES.has(user.roleCode)) {
    return false;
  }
  return true;
}

// Checks the acting user's firearms-access flag. Used to gate the /firearms
// page (and, later, query-layer filtering on every list that touches sensitive
// records, per issue #29). Returns false on any error or missing user, which
// is the safe default for a high-sensitivity gate.
export async function actingUserHasFirearmAccess(): Promise<boolean> {
  const id = await getActingUserId();
  if (!id) return false;
  try {
    const r = await getPool().query<{ firearm_access: boolean }>(
      "SELECT firearm_access FROM app_users WHERE id = $1 AND active = true LIMIT 1",
      [id]
    );
    return Boolean(r.rows[0]?.firearm_access);
  } catch {
    return false;
  }
}

// Roles that may MANAGE firearms records (record verifications, surrender to
// entities, etc.) beyond just viewing them. The firearm_access flag still
// gates VIEW; this gate is the stricter MANAGE check —
// national firearms coordinator (org-wide) or division firearms coordinator
// (per field office), plus admins.
const FIREARMS_COORDINATOR_ROLES = new Set([
  "admin",
  "national_firearms_coordinator",
  "division_firearms_coordinator"
]);

export async function actingUserCanCoordinateFirearms(): Promise<boolean> {
  const id = await getActingUserId();
  if (!id) return false;
  try {
    const r = await getPool().query<{ role_code: string }>(
      `SELECT r.code AS role_code
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = $1`,
      [id]
    );
    return r.rows.some((row) => FIREARMS_COORDINATOR_ROLES.has(row.role_code));
  } catch {
    return false;
  }
}

// Sensitive-asset write guard. Layered on top of guardWrite(): the user must
// (a) not be read-only, and (b) hold a firearms-coordinator role. Sets a
// flash on failure and returns false so the caller can short-circuit.
export async function guardFirearmsCoordinator(): Promise<boolean> {
  if (!(await canActingUserWrite())) {
    await setFlash("error", "Your role is Read-Only and cannot make changes.");
    return false;
  }
  if (!(await actingUserCanCoordinateFirearms())) {
    await setFlash(
      "error",
      "Only national or division firearms coordinators (or admins) can record firearms changes."
    );
    return false;
  }
  return true;
}

// Returns true if the current acting user may perform a write. When it returns
// false it has already set an error flash explaining why, so callers should
// simply stop (and revalidate so the toast surfaces).
export async function guardWrite(): Promise<boolean> {
  if (await canActingUserWrite()) {
    return true;
  }
  await setFlash("error", "Your role is Read-Only and cannot make changes.");
  return false;
}

// Site administrators. The Custom Field builder ("Customize Form") is admin-
// only: it changes the field set every user sees, so it sits above the normal
// asset-manager write gate.
export async function actingUserIsAdmin(): Promise<boolean> {
  const user = await getActingUser();
  return user?.roleCode === "admin";
}

// Roles that may DECIDE approvals (approve/deny routed requests). Per the role
// matrix this is the Approver's job; Asset Managers create, transfer, and
// dispose of assets but do NOT approve. Admins can act as an override.
const APPROVER_ROLES = new Set(["approver", "admin"]);

export async function actingUserCanApprove(): Promise<boolean> {
  const id = await getActingUserId();
  if (!id) return false;
  try {
    const r = await getPool().query<{ role_code: string }>(
      `SELECT r.code AS role_code
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = $1`,
      [id]
    );
    return r.rows.some((row) => APPROVER_ROLES.has(row.role_code));
  } catch {
    return false;
  }
}

// Approval-decision guard. The user must not be read-only AND must hold an
// Approver (or Admin) role. Sets an error flash on failure so the caller can
// short-circuit and surface the reason.
export async function guardApprover(): Promise<boolean> {
  if (!(await canActingUserWrite())) {
    await setFlash("error", "Your role is Read-Only and cannot make changes.");
    return false;
  }
  if (!(await actingUserCanApprove())) {
    await setFlash("error", "Only the Approver or Admin role can approve or deny requests.");
    return false;
  }
  return true;
}

// Admin write guard for the Custom Field builder. Sets an error flash and
// returns false when the acting user is not an admin.
export async function guardAdmin(): Promise<boolean> {
  if (await actingUserIsAdmin()) {
    return true;
  }
  await setFlash("error", "Only administrators can manage custom fields.");
  return false;
}
