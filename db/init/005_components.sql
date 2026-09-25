-- Components (Snipe-IT-parity, clean-room: field concepts only).
-- Quantity-tracked parts that are checked out TO assets (e.g., RAM into a
-- laptop), with a quantity per assignment. available = qty - sum(assigned_qty).
-- Low stock is flagged when available is at or below min_amt.

CREATE TABLE IF NOT EXISTS components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  manufacturer text,
  model_number text,
  serial text,
  qty integer NOT NULL DEFAULT 0 CHECK (qty >= 0),
  min_amt integer NOT NULL DEFAULT 0,
  location text,
  supplier text,
  purchase_date date,
  purchase_cost numeric(12,2),
  order_number text,
  group_id uuid REFERENCES groups(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS component_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id uuid NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  assigned_qty integer NOT NULL DEFAULT 1 CHECK (assigned_qty > 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_component_assignments_component ON component_assignments(component_id);
CREATE INDEX IF NOT EXISTS idx_component_assignments_asset ON component_assignments(asset_id);

DROP TRIGGER IF EXISTS components_set_updated_at ON components;
CREATE TRIGGER components_set_updated_at
BEFORE UPDATE ON components
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
