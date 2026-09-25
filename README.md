# Asset Tracker System

A full-stack asset lifecycle and custody management app for public-sector organizations.
It tracks who holds every piece of equipment, how it moved between people and offices, and who
approved each change. Every write is recorded in an audit log.

All organizations, people, asset tags and serial numbers in the seed data are fictional
("Northwind Agency").

## Features

- **Computer assets, end to end**: create, edit, check out, check in, transfer custody, dispose.
  Every change writes a custody event and an audit-log row in the same transaction.
- **Firearms and body armor**: a restricted module with access flags, coordinator roles,
  non-person custodians (warehouses, armories), a mandatory verification checklist, and a
  four-stage approval stepper.
- **Custom Field Admin ("Customize Form")**: admins add, reorder and group their own fields
  (text, select, date, checkbox) and they appear on asset forms without a code change.
- **Licenses, accessories, consumables and components**, with seat, checkout and issue tracking.
- **Requests, approvals and workflows** (onboarding, offboarding, transfer, disposition) with SLA tracking.
- **Procurement and suppliers**: purchase orders linked to the assets they bought.
- **Dashboard** with needs-attention items and a recent-activity feed. Also global search,
  sortable and paginated tables, breadcrumbs, toasts, and a light/dark theme.
- **Audit log** with CSV export.
- **HR webhook receiver** (`POST /api/integrations/hr/intake`): HMAC-SHA256 signature
  verification and idempotency-key dedupe, plus a simulated HRIS sync panel.
- **Role-based access**: admin, approver, asset manager, office-scoped asset manager,
  firearms coordinators, and read-only, with a development login picker for switching roles.

## Stack

- Next.js (App Router, Server Actions, Route Handlers), React, TypeScript
- PostgreSQL through `node-postgres`, using raw parameterized SQL (no ORM)
- USWDS-based styling
- Vitest unit tests and database integration tests
- Docker Compose for Postgres and the app

## Quickstart

```bash
cp .env.example .env
npm install
npm run db:up        # starts Postgres in Docker and applies db/init/*.sql on first start
npm run dev          # http://localhost:3000
```

Sign in from the `/login` picker as any seeded user. Each one has a different role. The featured
demo asset is `NWA-CMP-10001`.

To start over with a clean seeded database:

```bash
npm run db:reset
```

`scripts/reset-db.sh` does the same against a locally installed Postgres (no Docker). It drops
and recreates the database and applies `db/init/*.sql` in order.

The database health check is at `/api/health/db`.

## Tests

```bash
npm test                  # unit tests
DATABASE_URL=... npm test # also runs the database integration tests
```

Integration tests skip automatically when `DATABASE_URL` is not set.

## Docker

```bash
docker compose up --build
```

If Docker runs behind SSL inspection, put the inspecting root CA in `docker/certs/` as a `.crt`
file, or build with `--build-arg NPM_CONFIG_STRICT_SSL=false` for local use only.

## Project layout

```text
db/init/            schema, migrations and seed data (applied in filename order)
src/app/(app)/      authenticated pages and server actions
src/app/api/        route handlers (audit export, health check, integrations)
src/components/     shared UI components
src/lib/            data access, authorization and domain logic
src/lib/__tests__/  Vitest suites
```

## License

Copyright (c) 2026 Isaiah Anson. All rights reserved. The source is published for viewing and
evaluation only. See [LICENSE](LICENSE) for details.
