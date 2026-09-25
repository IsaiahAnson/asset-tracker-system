CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  parent_group_id uuid REFERENCES groups(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  email text NOT NULL UNIQUE,
  personal_email text,
  display_name text NOT NULL,
  group_id uuid NOT NULL REFERENCES groups(id),
  firearm_access boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE asset_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  high_sensitivity boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag text NOT NULL UNIQUE,
  category_id uuid NOT NULL REFERENCES asset_categories(id),
  group_id uuid NOT NULL REFERENCES groups(id),
  serial_number text,
  manufacturer text,
  model text,
  status text NOT NULL CHECK (status IN ('available', 'assigned', 'in_transfer', 'in_repair', 'pending_approval', 'retired', 'lost')),
  current_custodian_id uuid REFERENCES app_users(id),
  office text,
  high_sensitivity boolean NOT NULL DEFAULT false,
  acquired_on date,
  disposed_on date,
  expected_return_on date,
  notes text,
  -- Data lineage placeholders for later integrations (legacy-system migration cutover and MuleSoft sync).
  -- Nullable text so we can backfill without a schema migration. Out of scope to populate via the app today.
  migration_id text,
  mulesoft_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE custody_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  from_user_id uuid REFERENCES app_users(id),
  to_user_id uuid REFERENCES app_users(id),
  event_type text NOT NULL CHECK (event_type IN ('issue', 'transfer', 'return', 'disposition', 'missing_report')),
  event_at timestamptz NOT NULL DEFAULT now(),
  performed_by uuid NOT NULL REFERENCES app_users(id),
  notes text
);

CREATE TABLE workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_number text NOT NULL UNIQUE,
  group_id uuid NOT NULL REFERENCES groups(id),
  workflow_type text NOT NULL CHECK (workflow_type IN ('onboarding', 'offboarding', 'transfer', 'disposition', 'access_request')),
  subject_user_id uuid REFERENCES app_users(id),
  owner_user_id uuid NOT NULL REFERENCES app_users(id),
  status text NOT NULL CHECK (status IN ('draft', 'in_review', 'ready', 'at_risk', 'completed', 'cancelled')),
  stage text NOT NULL,
  due_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_number text NOT NULL UNIQUE,
  workflow_id uuid REFERENCES workflows(id) ON DELETE CASCADE,
  approver_user_id uuid NOT NULL REFERENCES app_users(id),
  request_summary text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'denied', 'escalated', 'cancelled')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decision_notes text
);

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_number text NOT NULL UNIQUE,
  actor_user_id uuid REFERENCES app_users(id),
  actor_label text NOT NULL,
  action text NOT NULL,
  record_type text NOT NULL,
  record_id text NOT NULL,
  result text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE file_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type text NOT NULL,
  record_id uuid NOT NULL,
  s3_bucket text NOT NULL,
  s3_key text NOT NULL,
  file_name text NOT NULL,
  content_type text,
  uploaded_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE migration_validation_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_record_id text NOT NULL,
  table_name text NOT NULL,
  issue_type text NOT NULL,
  issue_detail text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX idx_app_users_group_id ON app_users(group_id);
CREATE INDEX idx_assets_group_status ON assets(group_id, status);
CREATE INDEX idx_assets_category_id ON assets(category_id);
CREATE INDEX idx_assets_asset_tag_trgm ON assets USING gin (asset_tag gin_trgm_ops);
CREATE INDEX idx_custody_events_asset_id ON custody_events(asset_id, event_at DESC);
CREATE INDEX idx_workflows_group_status ON workflows(group_id, status);
CREATE INDEX idx_approvals_status ON approvals(status, submitted_at DESC);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_record ON audit_log(record_type, record_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER app_users_set_updated_at
BEFORE UPDATE ON app_users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER assets_set_updated_at
BEFORE UPDATE ON assets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER workflows_set_updated_at
BEFORE UPDATE ON workflows
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
