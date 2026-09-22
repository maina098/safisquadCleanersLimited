CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'active',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(80) NOT NULL DEFAULT 'Member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  tracking_code VARCHAR(20) UNIQUE NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(255),
  address TEXT NOT NULL,
  preferred_date DATE NOT NULL,
  service VARCHAR(120) NOT NULL,
  service_details TEXT,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  estimated_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  deposit_paid NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status VARCHAR(40) NOT NULL DEFAULT 'Pending',
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS order_events (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status VARCHAR(40) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_tracking_code_idx ON orders (tracking_code);
CREATE INDEX IF NOT EXISTS order_events_order_id_idx ON order_events (order_id);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(40) NOT NULL CHECK (role IN ('ADMIN', 'SUPER_ADMIN', 'MANAGEMENT', 'SECRETARIAT', 'FINANCE', 'FINANCE_OFFICER', 'PROMOTIONS', 'TECHNICAL', 'MEMBER', 'CUSTOMER')),
  phone VARCHAR(40),
  name VARCHAR(120),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  token_version INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED')),
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) UNIQUE NOT NULL,
  pricing_rule VARCHAR(40) NOT NULL CHECK (pricing_rule IN ('FIXED', 'PER_KG', 'PER_SQM', 'MONTHLY')),
  price NUMERIC(10, 2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status VARCHAR(40) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  actor_id INTEGER REFERENCES users(id),
  note TEXT
);

CREATE TABLE IF NOT EXISTS order_photos (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  photo_type VARCHAR(20) NOT NULL CHECK (photo_type IN ('BEFORE', 'AFTER')),
  url TEXT NOT NULL,
  uploaded_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  type VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  provider_reference VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mpesa_requests (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  checkout_request_id VARCHAR(120) UNIQUE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_provider_reference_unique') THEN
    ALTER TABLE payments ADD CONSTRAINT payments_provider_reference_unique UNIQUE (provider_reference);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS staff_hours (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  week_start DATE NOT NULL,
  hours NUMERIC(8, 2) NOT NULL CHECK (hours >= 0),
  UNIQUE (user_id, week_start)
);

CREATE TABLE IF NOT EXISTS business_settings (
  key VARCHAR(80) PRIMARY KEY,
  value NUMERIC(10, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_hours (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  week_start DATE NOT NULL,
  hours NUMERIC(8, 2) NOT NULL CHECK (hours >= 0),
  UNIQUE (user_id, week_start)
);

CREATE TABLE IF NOT EXISTS payouts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  week_start DATE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW',
  approved_by INTEGER REFERENCES users(id),
  provider_reference VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settlement_runs (
  id SERIAL PRIMARY KEY,
  week_start DATE NOT NULL,
  revenue NUMERIC(10, 2) NOT NULL,
  restock_allocation NUMERIC(10, 2) NOT NULL,
  contingency_buffer NUMERIC(10, 2) NOT NULL,
  growth_fund NUMERIC(10, 2) NOT NULL,
  distributable_amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  actor_id INTEGER REFERENCES users(id),
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE transactions ALTER COLUMN amount TYPE NUMERIC(12, 2) USING amount::NUMERIC(12, 2);

ALTER TABLE orders
  ALTER COLUMN estimated_cost TYPE NUMERIC(12, 2) USING estimated_cost::NUMERIC(12, 2),
  ALTER COLUMN deposit_paid TYPE NUMERIC(12, 2) USING deposit_paid::NUMERIC(12, 2);
ALTER TABLE payments ALTER COLUMN amount TYPE NUMERIC(12, 2) USING amount::NUMERIC(12, 2);
ALTER TABLE mpesa_requests ALTER COLUMN amount TYPE NUMERIC(12, 2) USING amount::NUMERIC(12, 2);

CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_immutable ON audit_logs;
CREATE TRIGGER audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

CREATE TABLE IF NOT EXISTS inter_dept_messages (
  id SERIAL PRIMARY KEY,
  from_dept VARCHAR(40) NOT NULL,
  to_dept VARCHAR(40) NOT NULL,
  subject VARCHAR(160) NOT NULL,
  body TEXT NOT NULL,
  related_type VARCHAR(80),
  related_id VARCHAR(80),
  priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  status VARCHAR(20) NOT NULL DEFAULT 'UNREAD',
  created_by INTEGER REFERENCES users(id),
  assigned_to INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS inter_dept_messages_recipient_idx ON inter_dept_messages (to_dept, status);
