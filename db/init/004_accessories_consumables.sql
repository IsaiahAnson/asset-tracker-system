-- Accessories and Consumables (Snipe-IT-parity, clean-room: field concepts only).
-- Both are quantity-tracked (not individually serialized like assets).
--   Accessories are checked out to users and returnable: available = qty - active checkouts.
--   Consumables are issued and consumed (not returned): remaining = qty - issues.
-- Low stock is flagged when the available/remaining count is at or below min_amt.

CREATE TABLE IF NOT EXISTS accessories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  manufacturer text,
  model_number text,
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

CREATE TABLE IF NOT EXISTS accessory_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accessory_id uuid NOT NULL REFERENCES accessories(id) ON DELETE CASCADE,
  assigned_user_id uuid NOT NULL REFERENCES app_users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consumables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  manufacturer text,
  model_number text,
  item_no text,
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

CREATE TABLE IF NOT EXISTS consumable_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumable_id uuid NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
  assigned_user_id uuid NOT NULL REFERENCES app_users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accessory_checkouts_accessory ON accessory_checkouts(accessory_id);
CREATE INDEX IF NOT EXISTS idx_consumable_issues_consumable ON consumable_issues(consumable_id);

DROP TRIGGER IF EXISTS accessories_set_updated_at ON accessories;
CREATE TRIGGER accessories_set_updated_at
BEFORE UPDATE ON accessories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS consumables_set_updated_at ON consumables;
CREATE TRIGGER consumables_set_updated_at
BEFORE UPDATE ON consumables
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
