const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'aal_voz.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    age INTEGER,
    id_number TEXT UNIQUE,
    phone TEXT,
    condition TEXT,
    medications TEXT,
    allergies TEXT,
    blood_type TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    special_instructions TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS service_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    crew_name TEXT,
    eta_minutes INTEGER DEFAULT 30,
    call_interval_minutes INTEGER DEFAULT 10,
    calls_completed INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    completed_at TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(id)
  );

  CREATE TABLE IF NOT EXISTS call_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    call_number INTEGER DEFAULT 1,
    transcript TEXT DEFAULT '[]',
    summary TEXT,
    urgent_flag INTEGER DEFAULT 0,
    started_at TEXT DEFAULT (datetime('now', 'localtime')),
    ended_at TEXT,
    FOREIGN KEY (order_id) REFERENCES service_orders(id)
  );
`);

module.exports = db;
