-- ============================================================================
-- 008_firearms.sql — Firearms module expansion. Extends the read-only
-- /firearms page into a workflow-aware module for sensitive-asset custody.
--
-- New concepts added here:
--   1. Entity assignees (non-person custodians like "Operations Division
--      Warehouse"). Surrendered firearms are assigned to an entity rather
--      than a person between assignments. Modeled as app_users rows with
--      is_entity = true so the existing custody / current_custodian_id
--      pipeline doesn't fork.
--   2. Body armor as a tracked category (high-sensitivity), surrendered
--      together with firearms.
--   3. Mandatory Verification Checks (NCIC, armor inspection, deployment
--      justification, etc.) gating sensitive-asset issuance. Drives the
--      Verification Checklist on the firearm detail page.
--   4. Multi-stage approvals — a sensitive-asset issuance has 4 stages
--      (Requested → Division Lead → Internal Affairs → Authorization)
--      stored as ordered rows in the existing approvals table. Drives the
--      Approval Stepper on the firearm detail page.
--   5. Firearms-coordinator roles — national firearms coordinator (org-
--      wide oversight) and division firearms coordinator (per field
--      office). The existing firearm_access flag still gates VIEW; the
--      coordinator roles gate MANAGE within scope.
-- ============================================================================

-- 1. Schema additions --------------------------------------------------------

-- Non-person custodians. is_entity = true marks the row as a warehouse/
-- armory/evidence-room destination rather than an employee. Defaults to
-- false so all existing rows remain people.
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS is_entity boolean NOT NULL DEFAULT false;

-- Body armor lives alongside firearms in the high-sensitivity inventory.
INSERT INTO asset_categories (code, name, high_sensitivity)
VALUES ('body_armor', 'Body Armor', true)
ON CONFLICT (code) DO NOTHING;

-- Mandatory verification checks. One row per (asset_id, check_type) holding
-- the current state; renewals UPDATE the existing row rather than insert a
-- new one. (Full historical audit lives in audit_log via library writes.)
CREATE TABLE IF NOT EXISTS sensitive_asset_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  check_type text NOT NULL CHECK (check_type IN (
    'ncic_background',
    'armor_inspection',
    'deployment_justification',
    'qualification',
    'medical_clearance'
  )),
  status text NOT NULL CHECK (status IN ('passed', 'pending', 'failed', 'expired')),
  verified_by_user_id uuid REFERENCES app_users(id),
  verified_at timestamptz,
  expires_on date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, check_type)
);

CREATE INDEX IF NOT EXISTS idx_sensitive_asset_verifications_asset
  ON sensitive_asset_verifications(asset_id);

CREATE INDEX IF NOT EXISTS idx_sensitive_asset_verifications_expiring
  ON sensitive_asset_verifications(expires_on)
  WHERE expires_on IS NOT NULL;

-- Multi-stage approval tracking. The existing approvals table holds one row
-- per stage; stage_index orders them and stage_name is the human label
-- rendered in the stepper. Nullable so existing approval rows remain valid.
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS stage_index int;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS stage_name text;

-- Firearms-specific coordinator roles. Coexist with the existing
-- firearm_access boolean (which gates VIEW); these roles gate MANAGE.
INSERT INTO roles (code, name, description)
VALUES
  ('national_firearms_coordinator',
   'National Firearms Coordinator',
   'Org-wide oversight for firearms inventory, qualifications, and surrender flows.'),
  ('division_firearms_coordinator',
   'Division Firearms Coordinator',
   'Manages firearms records and surrender flows within a specific division or field office.')
ON CONFLICT (code) DO NOTHING;

-- 2. Seed: warehouse entities ------------------------------------------------

-- Operations Division Warehouse (org-wide pool for duty weapons between
-- assignments). firearm_access is irrelevant for entities (they are
-- destinations, not viewers); set false to avoid surfacing the warehouse
-- as a person who can see restricted records.
INSERT INTO app_users (external_id, email, display_name, group_id, firearm_access, is_entity)
SELECT 'entity:opdiv-warehouse', 'entity-opdiv-warehouse@northwind.example',
       'Operations Division Warehouse', g.id, false, true
  FROM groups g WHERE g.code = 'NWA'
ON CONFLICT (email) DO NOTHING;

INSERT INTO app_users (external_id, email, display_name, group_id, firearm_access, is_entity)
SELECT 'entity:atl-armory', 'entity-atl-armory@northwind.example',
       'Atlanta Field Office Armory', g.id, false, true
  FROM groups g WHERE g.code = 'NWA-ATL'
ON CONFLICT (email) DO NOTHING;

-- 3. Seed: body armor units --------------------------------------------------

-- Jordan Rivera carries an issued Point Blank vest paired with the assigned
-- Sig Sauer (NWA-FRM-00471). Two additional vests sit in inventory.
INSERT INTO assets (asset_tag, category_id, group_id, serial_number, manufacturer, model, status, current_custodian_id, office, high_sensitivity, acquired_on)
SELECT 'NWA-ARM-00121', c.id, g.id, 'BAE-2024-00121', 'Point Blank', 'Vision IIIA',
       'assigned', u.id, 'Northwind Security Operations', true, DATE '2024-03-08'
  FROM asset_categories c
  CROSS JOIN groups g
  CROSS JOIN app_users u
 WHERE c.code = 'body_armor'
   AND g.code = 'NWA'
   AND u.email = 'jordan.rivera@northwind.example'
ON CONFLICT (asset_tag) DO NOTHING;

INSERT INTO assets (asset_tag, category_id, group_id, serial_number, manufacturer, model, status, office, high_sensitivity, acquired_on)
SELECT 'NWA-ARM-00122', c.id, g.id, 'BAE-2024-00122', 'Point Blank', 'Vision IIIA',
       'available', 'Northwind Security Operations', true, DATE '2024-03-08'
  FROM asset_categories c CROSS JOIN groups g
 WHERE c.code = 'body_armor' AND g.code = 'NWA'
ON CONFLICT (asset_tag) DO NOTHING;

INSERT INTO assets (asset_tag, category_id, group_id, serial_number, manufacturer, model, status, office, high_sensitivity, acquired_on)
SELECT 'NWA-ARM-00145', c.id, g.id, 'SAF-2023-00145', 'Safariland', 'Summit IIIA Concealable',
       'available', 'Northwind Security Operations - Atlanta', true, DATE '2023-11-22'
  FROM asset_categories c CROSS JOIN groups g
 WHERE c.code = 'body_armor' AND g.code = 'NWA-ATL'
ON CONFLICT (asset_tag) DO NOTHING;

-- 4. Seed: an Atlanta firearm parked at the warehouse so the entity-as-
--    custodian pattern is visible on the inventory page out of the box.

INSERT INTO assets (asset_tag, category_id, group_id, serial_number, manufacturer, model, status, current_custodian_id, office, high_sensitivity, acquired_on)
SELECT 'NWA-FRM-00613', c.id, g.id, 'DEMO-FRM-64', 'Smith & Wesson', 'M&P9 M2.0',
       'assigned', u.id, 'Northwind Security Operations - Atlanta', true, DATE '2024-09-18'
  FROM asset_categories c
  CROSS JOIN groups g
  CROSS JOIN app_users u
 WHERE c.code = 'firearms'
   AND g.code = 'NWA-ATL'
   AND u.email = 'entity-atl-armory@northwind.example'
ON CONFLICT (asset_tag) DO NOTHING;

-- 5. Seed: verifications for existing firearms -------------------------------

-- NWA-FRM-00471 (Jordan Rivera's assigned Sig Sauer) — all three mandatory
-- checks PASSED and in date. Demonstrates the "ready to issue" state.
INSERT INTO sensitive_asset_verifications (asset_id, check_type, status, verified_by_user_id, verified_at, expires_on, notes)
SELECT a.id, 'ncic_background', 'passed', v.id, TIMESTAMPTZ '2026-01-15 09:00-05',
       DATE '2027-01-15', 'NCIC III response clean; rerun annually.'
  FROM assets a, app_users v
 WHERE a.asset_tag = 'NWA-FRM-00471' AND v.email = 'jordan.rivera@northwind.example'
ON CONFLICT (asset_id, check_type) DO NOTHING;

INSERT INTO sensitive_asset_verifications (asset_id, check_type, status, verified_by_user_id, verified_at, expires_on, notes)
SELECT a.id, 'armor_inspection', 'passed', v.id, TIMESTAMPTZ '2026-02-12 10:30-05',
       DATE '2026-08-12', 'Bi-annual armor inspection: plates intact, retention straps OK.'
  FROM assets a, app_users v
 WHERE a.asset_tag = 'NWA-FRM-00471' AND v.email = 'jordan.rivera@northwind.example'
ON CONFLICT (asset_id, check_type) DO NOTHING;

INSERT INTO sensitive_asset_verifications (asset_id, check_type, status, verified_by_user_id, verified_at, expires_on, notes)
SELECT a.id, 'deployment_justification', 'passed', v.id, TIMESTAMPTZ '2026-01-20 14:00-05',
       NULL, 'Field investigative duties; approved by division lead.'
  FROM assets a, app_users v
 WHERE a.asset_tag = 'NWA-FRM-00471' AND v.email = 'jordan.rivera@northwind.example'
ON CONFLICT (asset_id, check_type) DO NOTHING;

INSERT INTO sensitive_asset_verifications (asset_id, check_type, status, verified_by_user_id, verified_at, expires_on, notes)
SELECT a.id, 'qualification', 'passed', v.id, TIMESTAMPTZ '2026-03-04 13:00-05',
       DATE '2026-09-04', 'Quarterly range qualification; min score met.'
  FROM assets a, app_users v
 WHERE a.asset_tag = 'NWA-FRM-00471' AND v.email = 'jordan.rivera@northwind.example'
ON CONFLICT (asset_id, check_type) DO NOTHING;

-- NWA-FRM-00472 — armor inspection EXPIRED and deployment justification
-- PENDING. Demonstrates the "blocked from issuance" state on the stepper.
INSERT INTO sensitive_asset_verifications (asset_id, check_type, status, verified_by_user_id, verified_at, expires_on, notes)
SELECT a.id, 'ncic_background', 'passed', v.id, TIMESTAMPTZ '2025-12-04 09:00-05',
       DATE '2026-12-04', 'Clean.'
  FROM assets a, app_users v
 WHERE a.asset_tag = 'NWA-FRM-00472' AND v.email = 'jordan.rivera@northwind.example'
ON CONFLICT (asset_id, check_type) DO NOTHING;

INSERT INTO sensitive_asset_verifications (asset_id, check_type, status, verified_by_user_id, verified_at, expires_on, notes)
SELECT a.id, 'armor_inspection', 'expired', v.id, TIMESTAMPTZ '2024-11-08 10:30-05',
       DATE '2025-05-08', 'EXPIRED: re-inspection required before issuance.'
  FROM assets a, app_users v
 WHERE a.asset_tag = 'NWA-FRM-00472' AND v.email = 'jordan.rivera@northwind.example'
ON CONFLICT (asset_id, check_type) DO NOTHING;

INSERT INTO sensitive_asset_verifications (asset_id, check_type, status, verified_by_user_id, verified_at, expires_on, notes)
SELECT a.id, 'deployment_justification', 'pending', NULL, NULL, NULL,
       'Awaiting SAC sign-off for current detail.'
  FROM assets a
 WHERE a.asset_tag = 'NWA-FRM-00472'
ON CONFLICT (asset_id, check_type) DO NOTHING;

-- NWA-FRM-00503 (Glock 22 Gen5) — partial coverage, NCIC passed, armor
-- inspection passed but expiring within 90 days (warning state).
INSERT INTO sensitive_asset_verifications (asset_id, check_type, status, verified_by_user_id, verified_at, expires_on, notes)
SELECT a.id, 'ncic_background', 'passed', v.id, TIMESTAMPTZ '2026-02-20 10:00-05',
       DATE '2027-02-20', 'Clean.'
  FROM assets a, app_users v
 WHERE a.asset_tag = 'NWA-FRM-00503' AND v.email = 'jordan.rivera@northwind.example'
ON CONFLICT (asset_id, check_type) DO NOTHING;

INSERT INTO sensitive_asset_verifications (asset_id, check_type, status, verified_by_user_id, verified_at, expires_on, notes)
SELECT a.id, 'armor_inspection', 'passed', v.id, TIMESTAMPTZ '2025-12-15 10:00-05',
       DATE '2026-06-15', 'Bi-annual inspection passed; renewal due soon.'
  FROM assets a, app_users v
 WHERE a.asset_tag = 'NWA-FRM-00503' AND v.email = 'jordan.rivera@northwind.example'
ON CONFLICT (asset_id, check_type) DO NOTHING;

-- 6. Seed: multi-stage approval workflow for a firearm issuance --------------

-- "Issue NWA-FRM-00472 to Avery Chen" sits in the Internal Affairs stage
-- (3 of 4), so the stepper shows two done, one current, one pending.
INSERT INTO workflows (workflow_number, group_id, workflow_type, subject_user_id, owner_user_id, status, stage, due_on)
SELECT 'WF-2026-0431', g.id, 'access_request', subj.id, owner.id,
       'in_review', 'Internal Affairs review', DATE '2026-06-01'
  FROM groups g
  JOIN app_users owner ON owner.email = 'jordan.rivera@northwind.example'
  JOIN app_users subj  ON subj.email  = 'avery.chen@northwind.example'
 WHERE g.code = 'NWA-ATL'
ON CONFLICT (workflow_number) DO NOTHING;

INSERT INTO approvals (approval_number, workflow_id, approver_user_id, request_summary, status, submitted_at, decided_at, decision_notes, stage_index, stage_name)
SELECT 'APR-3401', w.id, appr.id,
       'Sensitive asset issuance request: NWA-FRM-00472 (Sig Sauer P229R DAK) to Avery Chen',
       'approved', TIMESTAMPTZ '2026-05-22 09:00-04', TIMESTAMPTZ '2026-05-22 09:15-04',
       'Request submitted with NCIC clearance attached.', 1, 'Requested'
  FROM workflows w
  JOIN app_users appr ON appr.email = 'jordan.rivera@northwind.example'
 WHERE w.workflow_number = 'WF-2026-0431'
ON CONFLICT (approval_number) DO NOTHING;

INSERT INTO approvals (approval_number, workflow_id, approver_user_id, request_summary, status, submitted_at, decided_at, decision_notes, stage_index, stage_name)
SELECT 'APR-3402', w.id, appr.id,
       'Division Lead review: NWA-FRM-00472 issuance to Avery Chen',
       'approved', TIMESTAMPTZ '2026-05-22 11:00-04', TIMESTAMPTZ '2026-05-23 09:00-04',
       'Operational need confirmed; armor inspection flagged for re-verification before final issuance.',
       2, 'Division Lead'
  FROM workflows w
  JOIN app_users appr ON appr.email = 'logan.kim@northwind.example'
 WHERE w.workflow_number = 'WF-2026-0431'
ON CONFLICT (approval_number) DO NOTHING;

INSERT INTO approvals (approval_number, workflow_id, approver_user_id, request_summary, status, submitted_at, stage_index, stage_name)
SELECT 'APR-3403', w.id, appr.id,
       'Internal Affairs review: NWA-FRM-00472 issuance to Avery Chen',
       'pending', TIMESTAMPTZ '2026-05-23 09:30-04', 3, 'Internal Affairs'
  FROM workflows w
  JOIN app_users appr ON appr.email = 'avery.chen@northwind.example'
 WHERE w.workflow_number = 'WF-2026-0431'
ON CONFLICT (approval_number) DO NOTHING;

INSERT INTO approvals (approval_number, workflow_id, approver_user_id, request_summary, status, submitted_at, stage_index, stage_name)
SELECT 'APR-3404', w.id, appr.id,
       'Final Authorization: NWA-FRM-00472 issuance to Avery Chen',
       'pending', TIMESTAMPTZ '2026-05-23 09:30-04', 4, 'Authorization'
  FROM workflows w
  JOIN app_users appr ON appr.email = 'dana.park@northwind.example'
 WHERE w.workflow_number = 'WF-2026-0431'
ON CONFLICT (approval_number) DO NOTHING;

-- 7. Seed: a sample firearms-coordinator role assignment so the role picker
--    in the dev login shows the new role exercised by a real user.
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
  FROM app_users u CROSS JOIN roles r
 WHERE u.email = 'jordan.rivera@northwind.example'
   AND r.code = 'national_firearms_coordinator'
ON CONFLICT DO NOTHING;
