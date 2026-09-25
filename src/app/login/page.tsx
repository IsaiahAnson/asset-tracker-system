import { listSelectableUsers } from "@/lib/session";
import { signInAsAction } from "@/app/session-actions";

export default async function LoginPage() {
  const users = await listSelectableUsers();

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__banner">
          <span>Demo environment with fictional sample data</span>
        </div>
        <div className="login-card__header">
          <div className="login-card__agency">Northwind Agency</div>
          <div className="login-card__title">Asset Tracker System</div>
          <div className="login-card__subtitle">Sign in to manage assets, custody and approvals</div>
        </div>
        <div className="login-card__mock-banner" role="status" aria-label="Development notice">
          <strong>SSO/PIV mock:</strong> this is the development login picker only. Production sign-in via SSO or PIV/CAC with HRIS groups is a later milestone.
        </div>
        <div className="login-card__body">
          <form action={signInAsAction}>
            <div className="usa-form-group">
              <label className="usa-label" htmlFor="userId">
                Sign in as
              </label>
              <select id="userId" name="userId" className="usa-select" defaultValue={users[0]?.id ?? ""}>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} — {u.roleName}
                  </option>
                ))}
              </select>
              <div className="usa-hint">
                Development sign-in. Production access resolves through SSO or PIV/CAC and HRIS groups.
              </div>
            </div>
            <button className="usa-button usa-button--primary login-card__button" type="submit">
              Continue
            </button>
          </form>
        </div>
        <div className="login-card__footer">For access issues, contact your system administrator.</div>
      </div>
    </div>
  );
}
