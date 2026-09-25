INSERT INTO groups (code, name)
VALUES
  ('NWA', 'Northwind Agency'),
  ('NWA-HQ', 'Northwind Headquarters'),
  ('NWA-ATL', 'Atlanta Field Office'),
  ('NWA-DAL', 'Dallas Field Office')
ON CONFLICT (code) DO NOTHING;

UPDATE groups child
SET parent_group_id = parent.id
FROM groups parent
WHERE parent.code = 'NWA'
  AND child.code IN ('NWA-HQ', 'NWA-ATL', 'NWA-DAL');

INSERT INTO roles (code, name, description)
VALUES
  ('admin', 'Admin', 'Manages users, roles, and platform configuration.'),
  ('asset_manager', 'Asset Manager', 'Creates, transfers, and dispositions assets within a group.'),
  ('office_asset_manager', 'Office-Specific Asset Manager', 'Asset manager scoped to a specific office or sub-group.'),
  ('approver', 'Approver', 'Reviews and approves routed requests.'),
  ('read_only', 'Read-Only', 'Audit and leadership reporting access.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO asset_categories (code, name, high_sensitivity)
VALUES
  ('computers', 'Computers', false),
  ('firearms', 'Firearms', true),
  ('vehicles', 'Vehicles', false),
  ('radios', 'Radios', false),
  ('cell_phones', 'Cell Phones', false),
  ('investigative_equipment', 'Investigative Equipment', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_users (external_id, email, personal_email, display_name, group_id, firearm_access)
SELECT 'hr:cmorgan', 'casey.morgan@northwind.example', 'casey.morgan@example.com', 'Casey Morgan', groups.id, true
FROM groups WHERE groups.code = 'NWA'
ON CONFLICT (email) DO NOTHING;

INSERT INTO app_users (external_id, email, personal_email, display_name, group_id, firearm_access)
SELECT 'hr:rbennett', 'riley.bennett@northwind.example', 'riley.bennett@example.com', 'Riley Bennett', groups.id, false
FROM groups WHERE groups.code = 'NWA-ATL'
ON CONFLICT (email) DO NOTHING;

INSERT INTO app_users (external_id, email, personal_email, display_name, group_id, firearm_access)
SELECT 'hr:jfoster', 'jamie.foster@northwind.example', 'jamie.foster@example.com', 'Jamie Foster', groups.id, false
FROM groups WHERE groups.code = 'NWA-DAL'
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT app_users.id, roles.id
FROM app_users
CROSS JOIN roles
WHERE app_users.email = 'casey.morgan@northwind.example'
  AND roles.code = 'asset_manager'
ON CONFLICT DO NOTHING;

-- Additional seeded users so every role is represented for dev role-switch testing.
INSERT INTO app_users (external_id, email, personal_email, display_name, group_id, firearm_access)
SELECT 'hr:tellis', 'taylor.ellis@northwind.example', 'taylor.ellis@example.com', 'Taylor Ellis', groups.id, false
FROM groups WHERE groups.code = 'NWA'
ON CONFLICT (email) DO NOTHING;

INSERT INTO app_users (external_id, email, personal_email, display_name, group_id, firearm_access)
SELECT 'hr:dcarter', 'drew.carter@northwind.example', 'drew.carter@example.com', 'Drew Carter', groups.id, false
FROM groups WHERE groups.code = 'NWA-ATL'
ON CONFLICT (email) DO NOTHING;

-- Distinct role per user: asset_manager (Casey, above), approver (Riley),
-- read_only (Jamie), admin (Taylor), office_asset_manager (Drew).
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM app_users u
CROSS JOIN roles r
WHERE (u.email = 'riley.bennett@northwind.example'  AND r.code = 'approver')
   OR (u.email = 'jamie.foster@northwind.example' AND r.code = 'read_only')
   OR (u.email = 'taylor.ellis@northwind.example'   AND r.code = 'admin')
   OR (u.email = 'drew.carter@northwind.example'   AND r.code = 'office_asset_manager')
ON CONFLICT DO NOTHING;

INSERT INTO assets (asset_tag, category_id, group_id, serial_number, manufacturer, model, status, current_custodian_id, office)
SELECT 'NWA-CMP-10482', asset_categories.id, groups.id, 'MXC4D73KQ2', 'Dell', 'Latitude 7440', 'assigned', app_users.id, 'Atlanta Field Office'
FROM asset_categories
CROSS JOIN groups
CROSS JOIN app_users
WHERE asset_categories.code = 'computers'
  AND groups.code = 'NWA-ATL'
  AND app_users.email = 'riley.bennett@northwind.example'
ON CONFLICT (asset_tag) DO NOTHING;

INSERT INTO assets (asset_tag, category_id, group_id, serial_number, manufacturer, model, status, office)
SELECT 'NWA-CMP-10811', asset_categories.id, groups.id, 'MXC9Q14LZ8', 'Dell', 'Latitude 7440', 'available', 'Headquarters'
FROM asset_categories
CROSS JOIN groups
WHERE asset_categories.code = 'computers'
  AND groups.code = 'NWA-HQ'
ON CONFLICT (asset_tag) DO NOTHING;

-- Featured demo record migrated from the legacy system. The migration_id is
-- populated to demonstrate the lineage column on a migrated record.
INSERT INTO assets (asset_tag, category_id, group_id, serial_number, manufacturer, model, status, current_custodian_id, office, acquired_on, migration_id)
SELECT 'NWA-CMP-10001', asset_categories.id, groups.id, 'DEMO-SN-10001', 'Logitech', 'BRIO 4K', 'assigned', app_users.id, 'Headquarters', DATE '2024-07-14', 'LEGACY-10001'
FROM asset_categories
CROSS JOIN groups
CROSS JOIN app_users
WHERE asset_categories.code = 'computers'
  AND groups.code = 'NWA'
  AND app_users.email = 'casey.morgan@northwind.example'
ON CONFLICT (asset_tag) DO NOTHING;

-- Firearms (high_sensitivity = true). Read-only on the demo /firearms page;
-- full issue/transfer/qualification workflows are Quick Win 2. Custodians are
-- the seeded users who have the firearm_access flag (casey.morgan) plus a few
-- unassigned for inventory display.
INSERT INTO assets (asset_tag, category_id, group_id, serial_number, manufacturer, model, status, current_custodian_id, office, high_sensitivity, acquired_on)
SELECT 'NWA-FRM-00471', asset_categories.id, groups.id, 'DEMO-FRM-45', 'Sig Sauer', 'P229R DAK', 'assigned', app_users.id, 'Northwind Security Operations', true, DATE '2023-06-12'
FROM asset_categories CROSS JOIN groups CROSS JOIN app_users
WHERE asset_categories.code = 'firearms' AND groups.code = 'NWA' AND app_users.email = 'casey.morgan@northwind.example'
ON CONFLICT (asset_tag) DO NOTHING;

INSERT INTO assets (asset_tag, category_id, group_id, serial_number, manufacturer, model, status, office, high_sensitivity, acquired_on)
SELECT 'NWA-FRM-00472', asset_categories.id, groups.id, 'DEMO-FRM-46', 'Sig Sauer', 'P229R DAK', 'available', 'Northwind Security Operations', true, DATE '2023-06-12'
FROM asset_categories CROSS JOIN groups
WHERE asset_categories.code = 'firearms' AND groups.code = 'NWA'
ON CONFLICT (asset_tag) DO NOTHING;

INSERT INTO assets (asset_tag, category_id, group_id, serial_number, manufacturer, model, status, office, high_sensitivity, acquired_on)
SELECT 'NWA-FRM-00503', asset_categories.id, groups.id, 'DEMO-FRM-52', 'Glock', '22 Gen5', 'available', 'Northwind Security Operations', true, DATE '2024-02-04'
FROM asset_categories CROSS JOIN groups
WHERE asset_categories.code = 'firearms' AND groups.code = 'NWA'
ON CONFLICT (asset_tag) DO NOTHING;

INSERT INTO assets (asset_tag, category_id, group_id, serial_number, manufacturer, model, status, office, high_sensitivity, acquired_on)
SELECT 'NWA-FRM-00504', asset_categories.id, groups.id, 'DEMO-FRM-53', 'Glock', '22 Gen5', 'available', 'Northwind Security Operations', true, DATE '2024-02-04'
FROM asset_categories CROSS JOIN groups
WHERE asset_categories.code = 'firearms' AND groups.code = 'NWA'
ON CONFLICT (asset_tag) DO NOTHING;

INSERT INTO assets (asset_tag, category_id, group_id, serial_number, manufacturer, model, status, office, high_sensitivity, acquired_on)
SELECT 'NWA-FRM-00611', asset_categories.id, groups.id, 'DEMO-FRM-62', 'Smith & Wesson', 'M&P9 M2.0', 'available', 'Northwind Security Operations - Atlanta', true, DATE '2024-09-18'
FROM asset_categories CROSS JOIN groups
WHERE asset_categories.code = 'firearms' AND groups.code = 'NWA-ATL'
ON CONFLICT (asset_tag) DO NOTHING;

INSERT INTO assets (asset_tag, category_id, group_id, serial_number, manufacturer, model, status, office, high_sensitivity, acquired_on)
SELECT 'NWA-FRM-00612', asset_categories.id, groups.id, 'DEMO-FRM-63', 'Smith & Wesson', 'M&P9 M2.0', 'in_repair', 'Northwind Security Operations - Atlanta', true, DATE '2024-09-18'
FROM asset_categories CROSS JOIN groups
WHERE asset_categories.code = 'firearms' AND groups.code = 'NWA-ATL'
ON CONFLICT (asset_tag) DO NOTHING;

INSERT INTO workflows (workflow_number, group_id, workflow_type, subject_user_id, owner_user_id, status, stage, due_on)
SELECT 'WF-2026-0412', subject.group_id, 'onboarding', subject.id, owner.id, 'in_review', 'Supervisor approval', DATE '2026-05-14'
FROM app_users subject
CROSS JOIN app_users owner
WHERE subject.email = 'riley.bennett@northwind.example'
  AND owner.email = 'casey.morgan@northwind.example'
ON CONFLICT (workflow_number) DO NOTHING;

INSERT INTO approvals (approval_number, workflow_id, approver_user_id, request_summary, status)
SELECT 'APR-3381', workflows.id, app_users.id, 'Computer issuance for Riley Bennett', 'pending'
FROM workflows
CROSS JOIN app_users
WHERE workflows.workflow_number = 'WF-2026-0412'
  AND app_users.email = 'casey.morgan@northwind.example'
ON CONFLICT (approval_number) DO NOTHING;

INSERT INTO audit_log (audit_number, actor_user_id, actor_label, action, record_type, record_id, result, metadata)
SELECT 'AUD-900182', app_users.id, app_users.display_name, 'Created custody transfer', 'asset', 'NWA-CMP-10482', 'Logged', '{"source":"seed"}'::jsonb
FROM app_users
WHERE app_users.email = 'casey.morgan@northwind.example'
ON CONFLICT (audit_number) DO NOTHING;

-- Additional workflows + approval-queue rows so the Approvals page has a
-- pending transfer and an escalated disposition to act on during testing.
INSERT INTO workflows (workflow_number, group_id, workflow_type, subject_user_id, owner_user_id, status, stage, due_on)
SELECT 'WF-2026-0413', g.id, 'transfer', subj.id, owner.id, 'in_review', 'Approver review', DATE '2026-05-18'
FROM groups g
JOIN app_users owner ON owner.email = 'casey.morgan@northwind.example'
JOIN app_users subj  ON subj.email  = 'jamie.foster@northwind.example'
WHERE g.code = 'NWA-DAL'
ON CONFLICT (workflow_number) DO NOTHING;

INSERT INTO workflows (workflow_number, group_id, workflow_type, subject_user_id, owner_user_id, status, stage, due_on)
SELECT 'WF-2026-0414', g.id, 'disposition', NULL, owner.id, 'at_risk', 'Escalated review', DATE '2026-05-12'
FROM groups g
JOIN app_users owner ON owner.email = 'casey.morgan@northwind.example'
WHERE g.code = 'NWA-HQ'
ON CONFLICT (workflow_number) DO NOTHING;

INSERT INTO approvals (approval_number, workflow_id, approver_user_id, request_summary, status, submitted_at)
SELECT 'APR-3379', w.id, appr.id, 'Laptop transfer to Jamie Foster', 'pending', TIMESTAMPTZ '2026-05-10 14:00:00-04'
FROM workflows w
JOIN app_users appr ON appr.email = 'drew.carter@northwind.example'
WHERE w.workflow_number = 'WF-2026-0413'
ON CONFLICT (approval_number) DO NOTHING;

INSERT INTO approvals (approval_number, workflow_id, approver_user_id, request_summary, status, submitted_at)
SELECT 'APR-3372', w.id, appr.id, 'Vehicle disposition review', 'escalated', TIMESTAMPTZ '2026-05-09 09:30:00-04'
FROM workflows w
JOIN app_users appr ON appr.email = 'riley.bennett@northwind.example'
WHERE w.workflow_number = 'WF-2026-0414'
ON CONFLICT (approval_number) DO NOTHING;
