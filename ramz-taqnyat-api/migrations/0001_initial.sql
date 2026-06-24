PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  email TEXT COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 100000,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin','manager','accountant','maintenance','employee','viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  source_id TEXT UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'building',
  usage TEXT,
  city TEXT,
  district TEXT,
  address TEXT,
  deed_number TEXT,
  owner_name TEXT,
  owner_id TEXT,
  owner_phone TEXT,
  total_units INTEGER NOT NULL DEFAULT 0 CHECK (total_units >= 0),
  area_sqm REAL CHECK (area_sqm IS NULL OR area_sqm >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','under_maintenance')),
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_properties_deed ON properties(deed_number) WHERE deed_number IS NOT NULL AND deed_number <> '' AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_properties_fingerprint ON properties(fingerprint) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_search ON properties(city,district,type,status,deleted_at);

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  source_id TEXT UNIQUE,
  property_id TEXT NOT NULL,
  unit_number TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'apartment',
  floor TEXT,
  area_sqm REAL CHECK (area_sqm IS NULL OR area_sqm >= 0),
  monthly_rent REAL NOT NULL DEFAULT 0 CHECK (monthly_rent >= 0),
  annual_rent REAL NOT NULL DEFAULT 0 CHECK (annual_rent >= 0),
  electricity_meter TEXT,
  water_meter TEXT,
  status TEXT NOT NULL DEFAULT 'vacant' CHECK (status IN ('vacant','rented','reserved','maintenance','inactive')),
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_units_property_number ON units(property_id,unit_number) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_units_fingerprint ON units(fingerprint) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_units_property ON units(property_id,status,deleted_at);

CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  source_id TEXT UNIQUE,
  contract_number TEXT NOT NULL,
  ejar_number TEXT,
  property_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  owner_name TEXT,
  owner_id TEXT,
  tenant_name TEXT NOT NULL,
  tenant_id_number TEXT,
  tenant_phone TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  monthly_rent REAL NOT NULL DEFAULT 0 CHECK (monthly_rent >= 0),
  annual_rent REAL NOT NULL DEFAULT 0 CHECK (annual_rent >= 0),
  security_deposit REAL NOT NULL DEFAULT 0 CHECK (security_deposit >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','expired','terminated','cancelled')),
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT,
  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE RESTRICT,
  CHECK (end_date >= start_date)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_contracts_number ON contracts(contract_number) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_contracts_ejar ON contracts(ejar_number) WHERE ejar_number IS NOT NULL AND ejar_number <> '' AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_contracts_fingerprint ON contracts(fingerprint) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_links ON contracts(property_id,unit_id,status,deleted_at);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  source_id TEXT UNIQUE,
  invoice_number TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  installment_number TEXT,
  due_date TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount >= 0),
  tax_amount REAL NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount REAL NOT NULL CHECK (total_amount >= 0),
  paid_amount REAL NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  remaining_amount REAL NOT NULL DEFAULT 0 CHECK (remaining_amount >= 0),
  paid_date TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','partial','overdue','cancelled')),
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_number ON invoices(invoice_number) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_installment ON invoices(contract_id,installment_number) WHERE installment_number IS NOT NULL AND installment_number <> '' AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_fingerprint ON invoices(fingerprint) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_contract ON invoices(contract_id,status,due_date,deleted_at);

CREATE TABLE IF NOT EXISTS property_images (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  ip_address TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_expiry ON rate_limits(expires_at);

INSERT OR IGNORE INTO users (
  id, username, email, name, password_salt, password_hash, password_iterations, role, status
) VALUES (
  'admin-aliayashi', 'AliAyashi', 'info@ramzabdae.com', 'مدير النظام',
  'qyqETzHrT6u25zyMLro+Lw==', 'lHgEFTMaUP0r5R8+kKIVSzIz+Xtg4xMSsSYdqRrsE58=', 100000, 'admin', 'active'
);
