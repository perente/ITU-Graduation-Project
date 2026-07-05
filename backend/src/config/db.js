const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const env = require('./env');

let dbPromise;

const runStatement = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({
        lastID: this.lastID,
        changes: this.changes,
      });
    });
  });

const getRows = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows || []);
    });
  });

const ensureColumnExists = async (db, tableName, columnName, definition) => {
  const columns = await getRows(db, `PRAGMA table_info(${tableName})`);
  const hasColumn = columns.some((column) => column.name === columnName);

  if (!hasColumn) {
    await runStatement(
      db,
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`
    );
  }
};

const seedDemoCompanies = async (db) => {
  const timestamp = new Date().toISOString();

  await runStatement(
    db,
    `
      INSERT OR IGNORE INTO companies (
        company_id,
        username,
        company_name,
        company_address,
        company_phone_number,
        company_fax_number,
        company_email,
        is_public_institution,
        company_title,
        company_iban,
        company_bank_name,
        company_bank_branch_code,
        company_bank_branch_name,
        company_registration_number,
        company_tax_identification_number,
        is_active,
        fabric_identity,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      'companyB',
      'companyb',
      'Company B',
      'Maslak, Istanbul',
      '+90 212 000 00 01',
      '+90 212 000 00 02',
      'companyb@company.com',
      0,
      'Technology Company',
      'TR000000000000000000000001',
      'Demo Bank',
      '001',
      'Maslak Branch',
      '1234567890123456',
      null,
      1,
      'companyB',
      timestamp,
      timestamp,
    ]
  );

};

const initializeSchema = async (db) => {
  await runStatement(
    db,
    `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        entity_id TEXT NOT NULL UNIQUE,
        fabric_identity TEXT NOT NULL UNIQUE,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `
  );

  await ensureColumnExists(db, 'users', 'username', 'TEXT');
  await ensureColumnExists(db, 'users', 'name', 'TEXT');
  await ensureColumnExists(db, 'users', 'surname', 'TEXT');
  await ensureColumnExists(db, 'users', 'faculty_id', 'TEXT');
  await ensureColumnExists(db, 'users', 'faculty_name', 'TEXT');
  await ensureColumnExists(db, 'users', 'department_code', 'TEXT');
  await ensureColumnExists(db, 'users', 'department_name', 'TEXT');
  await ensureColumnExists(db, 'users', 'completed_credits', 'INTEGER');
  await runStatement(
    db,
    `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique
      ON users(username)
      WHERE username IS NOT NULL
    `
  );

  await runStatement(
    db,
    `
      CREATE TABLE IF NOT EXISTS agreement_metadata (
        agreement_id TEXT PRIMARY KEY,
        internship_type TEXT NOT NULL,
        internship_field TEXT NOT NULL,
        working_days TEXT NOT NULL,
        weekly_schedule TEXT,
        weekly_working_day_count INTEGER NOT NULL,
        total_working_days INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `
  );
  await ensureColumnExists(db, 'agreement_metadata', 'weekly_schedule', 'TEXT');

  await runStatement(
    db,
    `
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL UNIQUE,
        company_name TEXT NOT NULL,
        company_address TEXT NOT NULL,
        company_phone_number TEXT NOT NULL,
        company_fax_number TEXT NOT NULL,
        company_email TEXT NOT NULL,
        is_public_institution INTEGER NOT NULL,
        company_title TEXT NOT NULL,
        company_iban TEXT NOT NULL,
        company_bank_name TEXT NOT NULL,
        company_bank_branch_code TEXT NOT NULL,
        company_bank_branch_name TEXT NOT NULL,
        company_registration_number TEXT,
        company_tax_identification_number TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        fabric_identity TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `
  );

  await runStatement(
    db,
    `
      CREATE TABLE IF NOT EXISTS company_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name TEXT NOT NULL,
        company_address TEXT NOT NULL,
        company_phone_number TEXT NOT NULL,
        company_fax_number TEXT NOT NULL,
        company_email TEXT NOT NULL,
        is_public_institution INTEGER NOT NULL,
        company_title TEXT NOT NULL,
        company_iban TEXT NOT NULL,
        company_bank_name TEXT NOT NULL,
        company_bank_branch_code TEXT NOT NULL,
        company_bank_branch_name TEXT NOT NULL,
        company_registration_number TEXT,
        company_tax_identification_number TEXT,
        requested_by_student_id TEXT NOT NULL,
        request_status TEXT NOT NULL,
        rejection_reason TEXT,
        reviewed_by_central_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `
  );

  await runStatement(
    db,
    `
      CREATE INDEX IF NOT EXISTS idx_company_requests_status_updated_at
      ON company_requests(request_status, updated_at)
    `
  );

  await seedDemoCompanies(db);
};

const createDatabase = () => {
  fs.mkdirSync(path.dirname(env.dbPath), { recursive: true });

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(env.dbPath, (error) => {
      if (error) {
        reject(error);
        return;
      }

      initializeSchema(db)
        .then(() => resolve(db))
        .catch(reject);
    });
  });
};

const initDb = async () => {
  if (!dbPromise) {
    dbPromise = createDatabase();
  }

  return dbPromise;
};

const getDb = async () => {
  return initDb();
};

const run = async (sql, params = []) => {
  const db = await getDb();

  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({
        lastID: this.lastID,
        changes: this.changes,
      });
    });
  });
};

const get = async (sql, params = []) => {
  const db = await getDb();

  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row || null);
    });
  });
};

const all = async (sql, params = []) => {
  const db = await getDb();

  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows || []);
    });
  });
};

const withTransaction = async (work) => {
  const db = await getDb();

  await runStatement(db, 'BEGIN IMMEDIATE TRANSACTION');

  try {
    const result = await work();
    await runStatement(db, 'COMMIT');
    return result;
  } catch (error) {
    try {
      await runStatement(db, 'ROLLBACK');
    } catch (rollbackError) {
      console.error(`DB rollback failed: ${rollbackError.message}`);
    }

    throw error;
  }
};

module.exports = {
  initDb,
  getDb,
  run,
  get,
  all,
  withTransaction,
};
