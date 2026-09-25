-- ============================================================================
-- 009_custom_fields.sql (2026-05-28) — Custom Field Admin ("Customize Form").
--
-- Lets site administrators define their own fields on app entities (starting
-- with the computer asset form) WITHOUT an engineering change. Inspired by the
-- ERPNext "Customize Form" pattern, built clean-room as a native schema:
--   - custom_field_definitions: the field metadata an admin manages (label,
--     type, options, required, order, active).
--   - asset_custom_field_value: the per-asset value for each defined field.
--
-- Forward-looking (per Monday-demo constraints): no tenant_id yet but the
-- `entity` column keeps the door open for per-entity (and later per-tenant)
-- field sets; every admin mutation writes an audit_log row (FedRAMP-friendly);
-- the values table is keyed by definition id so renaming a field's label never
-- orphans data.
-- ============================================================================

-- Field metadata managed by admins. `entity` scopes a field to a form/area
-- (today: 'asset'); `field_key` is the stable machine name (unique per entity)
-- so a label can change without breaking stored values.
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL DEFAULT 'asset',
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN (
    'text', 'textarea', 'number', 'date', 'select', 'checkbox'
  )),
  -- For 'select': a JSON array of option strings, e.g. '["Low","Moderate"]'.
  -- Empty array for every other type.
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  help_text text,
  default_value text,
  required boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity, field_key)
);

CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_entity
  ON custom_field_definitions(entity, active, display_order);

-- Per-asset values. One row per (asset, definition); upserted on save. Values
-- are stored as text and interpreted per the definition's field_type at read
-- time (checkbox -> 'true'/'false', number -> numeric string, etc.).
CREATE TABLE IF NOT EXISTS asset_custom_field_value (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  field_definition_id uuid NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, field_definition_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_custom_field_value_asset
  ON asset_custom_field_value(asset_id);

-- Keep updated_at fresh via the shared trigger function from 001_schema.sql.
DROP TRIGGER IF EXISTS custom_field_definitions_set_updated_at ON custom_field_definitions;
CREATE TRIGGER custom_field_definitions_set_updated_at
BEFORE UPDATE ON custom_field_definitions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS asset_custom_field_value_set_updated_at ON asset_custom_field_value;
CREATE TRIGGER asset_custom_field_value_set_updated_at
BEFORE UPDATE ON asset_custom_field_value
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Seed: example custom fields so the demo has content out of the box ──────

INSERT INTO custom_field_definitions (entity, field_key, label, field_type, options, help_text, default_value, required, display_order)
VALUES
  ('asset', 'property_pass_number', 'Property Pass Number', 'text', '[]'::jsonb,
   'Property pass control number carried over from the legacy system.', NULL, false, 1),
  ('asset', 'lifecycle_status', 'Lifecycle Status', 'select',
   '["In Service","Spare","Surplus","Pending Disposal"]'::jsonb,
   'Operational lifecycle stage for this unit.', 'In Service', false, 2),
  ('asset', 'fisma_system', 'FISMA System Categorization', 'select',
   '["Low","Moderate","High","N/A"]'::jsonb,
   'Security categorization of the system this asset supports.', 'Moderate', false, 3),
  ('asset', 'warranty_expiration', 'Warranty Expiration', 'date', '[]'::jsonb,
   'Manufacturer or contract warranty end date.', NULL, false, 4),
  ('asset', 'encryption_verified', 'Encryption Verified', 'checkbox', '[]'::jsonb,
   'Full-disk encryption confirmed present and active.', 'false', false, 5)
ON CONFLICT (entity, field_key) DO NOTHING;

-- Seed values on two real seeded assets so the detail page shows populated
-- custom fields immediately.
INSERT INTO asset_custom_field_value (asset_id, field_definition_id, value)
SELECT a.id, d.id, v.value
FROM (VALUES
  ('NWA-CMP-10001',   'property_pass_number', 'PP-2024-0098'),
  ('NWA-CMP-10001',   'lifecycle_status',     'In Service'),
  ('NWA-CMP-10001',   'fisma_system',         'Moderate'),
  ('NWA-CMP-10001',   'encryption_verified',  'true'),
  ('NWA-CMP-10482', 'lifecycle_status',     'Spare'),
  ('NWA-CMP-10482', 'fisma_system',         'Low'),
  ('NWA-CMP-10482', 'warranty_expiration',  '2027-03-31')
) AS v(asset_tag, field_key, value)
JOIN assets a ON a.asset_tag = v.asset_tag
JOIN custom_field_definitions d ON d.entity = 'asset' AND d.field_key = v.field_key
ON CONFLICT (asset_id, field_definition_id) DO NOTHING;

-- ── Grant: make the new objects usable by the app role ──────────────────────
-- reset-db.sh / manual psql applies migrations as the shell superuser, so the
-- new tables are owned by that user; the app connects as the project role and
-- needs explicit privileges. Role-guarded so a fresh laptop without the role
-- still applies the migration cleanly.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'asset_tracker') THEN
    EXECUTE 'GRANT ALL ON custom_field_definitions TO asset_tracker';
    EXECUTE 'GRANT ALL ON asset_custom_field_value TO asset_tracker';
  END IF;
END
$$;
