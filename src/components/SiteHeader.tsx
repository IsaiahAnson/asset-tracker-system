import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getActingUser } from "@/lib/session";
import { signOutAction } from "@/app/session-actions";

export async function SiteHeader() {
  const actingUser = await getActingUser();
  return (
    <header className="usa-header">
      <Link href="/dashboard" className="usa-header__title" aria-label="Asset Management home">
        <img
          className="usa-header__seal"
          src="/favicon.svg"
          width="48"
          height="48"
          alt=""
        />
        <span className="usa-header__branding">
          <span className="usa-header__agency">Northwind Agency</span>
          <span className="usa-header__app-name">Asset Management</span>
        </span>
      </Link>

      <form className="usa-header__search" method="get" action="/search" role="search">
        <label className="sr-only" htmlFor="global-search">
          Search assets and people
        </label>
        <input
          id="global-search"
          name="q"
          className="usa-input usa-header__search-input"
          type="search"
          placeholder="Search assets, people"
          aria-label="Search assets and people"
        />
        <button className="usa-header__search-button" type="submit" aria-label="Search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </button>
      </form>

      <div className="usa-header__user">
        <ThemeToggle />
        <span className="usa-header__user-name">{actingUser?.displayName ?? "Not signed in"}</span>
        <span className="usa-header__user-role">{actingUser?.roleName ?? "No role"}</span>
        <form action={signOutAction}>
          <button className="usa-header__logout" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
