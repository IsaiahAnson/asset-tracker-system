import { cookies } from "next/headers";
import { getPool } from "@/lib/db";

// DEV-ONLY pseudo-session. Real access resolves through PIV/CAC + Active
// Directory groups (out of scope for the v1 prototype, issue #32). Until then a
// single cookie records which seeded user you are "acting as" so that role
// behavior and audit attribution can be exercised. There is no password check
// and this must not ship to production as-is.
const ACTING_USER_COOKIE = "ats-acting-user";

export type ActingUser = {
  id: string;
  displayName: string;
  roleCode: string | null;
  roleName: string;
};

export type SelectableUser = {
  id: string;
  displayName: string;
  email: string;
  roleCode: string | null;
  roleName: string;
};

export async function getActingUserId(): Promise<string | null> {
  // cookies() throws outside a request scope (e.g. unit/integration tests that
  // call into the lib directly). Treat that as "no acting user" so callers fall
  // back to their default behavior instead of crashing.
  try {
    return (await cookies()).get(ACTING_USER_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

// Resolves the current acting user: the cookie's user if present and active,
// otherwise the default (an Asset Manager, falling back to any active user) so
// the header and audit attribution always have someone to show.
export async function getActingUser(): Promise<ActingUser | null> {
  const cookieId = await getActingUserId();
  const pool = getPool();

  if (cookieId) {
    const r = await pool.query<{ id: string; display_name: string; role_code: string | null; role_name: string | null }>(
      `SELECT u.id, u.display_name, r.code AS role_code, r.name AS role_name
         FROM app_users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
        WHERE u.id = $1 AND u.active = true
        LIMIT 1`,
      [cookieId]
    );
    if (r.rowCount && r.rows[0]) {
      return {
        id: r.rows[0].id,
        displayName: r.rows[0].display_name,
        roleCode: r.rows[0].role_code,
        roleName: r.rows[0].role_name ?? "No role"
      };
    }
  }

  const fallback = await pool.query<{ id: string; display_name: string; role_code: string | null; role_name: string | null }>(
    `SELECT u.id, u.display_name, r.code AS role_code, r.name AS role_name
       FROM app_users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.active = true
      ORDER BY (r.code = 'asset_manager') DESC NULLS LAST, u.display_name
      LIMIT 1`
  );
  if (fallback.rowCount && fallback.rows[0]) {
    return {
      id: fallback.rows[0].id,
      displayName: fallback.rows[0].display_name,
      roleCode: fallback.rows[0].role_code,
      roleName: fallback.rows[0].role_name ?? "No role"
    };
  }
  return null;
}

// Active users (with their role) for the "Sign in as" picker.
export async function listSelectableUsers(): Promise<SelectableUser[]> {
  const result = await getPool().query<{
    id: string;
    display_name: string;
    email: string;
    role_code: string | null;
    role_name: string | null;
  }>(
    // Dev login picker: show only the role-test accounts (users that carry a
    // system role), one row each. Plain employees and simulated new hires have
    // no role and are excluded, so creating mock people never clutters the
    // login dropdown. DISTINCT ON keeps a single row per user, preferring their
    // primary role when they hold more than one (e.g. Asset Manager over a
    // secondary Firearms Coordinator role).
    `SELECT s.id, s.display_name, s.email, s.role_code, s.role_name
       FROM (
         SELECT DISTINCT ON (u.id)
                u.id, u.display_name, u.email, r.code AS role_code, r.name AS role_name
           FROM app_users u
           JOIN user_roles ur ON ur.user_id = u.id
           JOIN roles r ON r.id = ur.role_id
          WHERE u.active = true AND u.is_entity = false
          ORDER BY u.id,
                   CASE r.code
                     WHEN 'admin' THEN 1
                     WHEN 'asset_manager' THEN 2
                     WHEN 'approver' THEN 3
                     WHEN 'office_asset_manager' THEN 4
                     WHEN 'read_only' THEN 5
                     ELSE 6
                   END
       ) s
      ORDER BY s.role_name NULLS LAST, s.display_name`
  );
  return result.rows.map((r) => ({
    id: r.id,
    displayName: r.display_name,
    email: r.email,
    roleCode: r.role_code,
    roleName: r.role_name ?? "No role"
  }));
}

export async function setActingUser(userId: string): Promise<void> {
  (await cookies()).set(ACTING_USER_COOKIE, userId, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function clearActingUser(): Promise<void> {
  (await cookies()).delete(ACTING_USER_COOKIE);
}
