-- Maintenance records + Asset requests (Snipe-IT-parity, clean-room).
-- maintenances: a log of maintenance/repair/upgrade events against an asset.
-- asset_requests: a queue of user requests for items, with a decision status.

CREATE TABLE IF NOT EXISTS maintenances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  maintenance_type text NOT NULL
    CHECK (maintenance_type IN ('repair', 'upgrade', 'calibration', 'inspection', 'warranty', 'other')),
  title text NOT NULL,
  supplier text,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  completion_date date,
  cost numeric(12,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE,
  requested_by uuid REFERENCES app_users(id),
  item_label text NOT NULL,
  category text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'fulfilled')),
  notes text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maintenances_asset ON maintenances(asset_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_asset_requests_status ON asset_requests(status, created_at DESC);
