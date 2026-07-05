const { get, run } = require('../config/db');

const userSelectFields = `
  id,
  email,
  username,
  password_hash,
  role,
  entity_id,
  fabric_identity,
  is_active,
  name,
  surname,
  faculty_id,
  faculty_name,
  department_code,
  department_name,
  completed_credits,
  created_at,
  updated_at
`;

const mapUser = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role,
    entityId: row.entity_id,
    fabricIdentity: row.fabric_identity,
    isActive: Boolean(row.is_active),
    name: row.name,
    surname: row.surname,
    facultyId: row.faculty_id,
    facultyName: row.faculty_name,
    departmentCode: row.department_code,
    departmentName: row.department_name,
    completedCredits:
      row.completed_credits === null || row.completed_credits === undefined
        ? null
        : Number(row.completed_credits),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const findUserByEmail = async (email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const row = await get(
    `
      SELECT
        ${userSelectFields}
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [normalizedEmail]
  );

  return mapUser(row);
};

const findUserByLoginIdentifier = async (identifier) => {
  const normalizedIdentifier = String(identifier || '').trim().toLowerCase();

  const row = await get(
    `
      SELECT
        ${userSelectFields}
      FROM users
      WHERE email = ? OR username = ?
      LIMIT 1
    `,
    [normalizedIdentifier, normalizedIdentifier]
  );

  return mapUser(row);
};

const findUserByIdentityFields = async ({
  email,
  username,
  entityId,
  fabricIdentity,
}) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedUsername = username
    ? String(username).trim().toLowerCase()
    : null;

  const row = await get(
    `
      SELECT
        ${userSelectFields}
      FROM users
      WHERE email = ?
        OR entity_id = ?
        OR fabric_identity = ?
        OR (? IS NOT NULL AND username = ?)
      LIMIT 1
    `,
    [
      normalizedEmail,
      entityId,
      fabricIdentity,
      normalizedUsername,
      normalizedUsername,
    ]
  );

  return mapUser(row);
};

const findUserByEntityId = async (entityId) => {
  const normalizedEntityId = String(entityId || '').trim();

  const row = await get(
    `
      SELECT
        ${userSelectFields}
      FROM users
      WHERE entity_id = ?
      LIMIT 1
    `,
    [normalizedEntityId]
  );

  return mapUser(row);
};

const createUser = async ({
  email,
  username = null,
  passwordHash,
  role,
  entityId,
  fabricIdentity,
  isActive = true,
  name = null,
  surname = null,
  facultyId = null,
  facultyName = null,
  departmentCode = null,
  departmentName = null,
  completedCredits = null,
}) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedUsername = username
    ? String(username).trim().toLowerCase()
    : null;
  const timestamp = new Date().toISOString();

  const result = await run(
    `
      INSERT OR IGNORE INTO users (
        email,
        username,
        password_hash,
        role,
        entity_id,
        fabric_identity,
        is_active,
        name,
        surname,
        faculty_id,
        faculty_name,
        department_code,
        department_name,
        completed_credits,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      normalizedEmail,
      normalizedUsername,
      passwordHash,
      role,
      entityId,
      fabricIdentity,
      isActive ? 1 : 0,
      name,
      surname,
      facultyId,
      facultyName,
      departmentCode,
      departmentName,
      completedCredits,
      timestamp,
      timestamp,
    ]
  );

  return {
    inserted: result.changes > 0,
    user: await findUserByIdentityFields({
      email: normalizedEmail,
      username: normalizedUsername,
      entityId,
      fabricIdentity,
    }),
  };
};

const upsertUser = async ({
  email,
  username = null,
  passwordHash,
  role,
  entityId,
  fabricIdentity,
  isActive = true,
  name = null,
  surname = null,
  facultyId = null,
  facultyName = null,
  departmentCode = null,
  departmentName = null,
  completedCredits = null,
}) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedUsername = username
    ? String(username).trim().toLowerCase()
    : null;
  const timestamp = new Date().toISOString();

  await run(
    `
      INSERT INTO users (
        email,
        username,
        password_hash,
        role,
        entity_id,
        fabric_identity,
        is_active,
        name,
        surname,
        faculty_id,
        faculty_name,
        department_code,
        department_name,
        completed_credits,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        username = excluded.username,
        password_hash = excluded.password_hash,
        role = excluded.role,
        entity_id = excluded.entity_id,
        fabric_identity = excluded.fabric_identity,
        is_active = excluded.is_active,
        name = excluded.name,
        surname = excluded.surname,
        faculty_id = excluded.faculty_id,
        faculty_name = excluded.faculty_name,
        department_code = excluded.department_code,
        department_name = excluded.department_name,
        completed_credits = excluded.completed_credits,
        updated_at = excluded.updated_at
    `,
    [
      normalizedEmail,
      normalizedUsername,
      passwordHash,
      role,
      entityId,
      fabricIdentity,
      isActive ? 1 : 0,
      name,
      surname,
      facultyId,
      facultyName,
      departmentCode,
      departmentName,
      completedCredits,
      timestamp,
      timestamp,
    ]
  );

  return findUserByEmail(normalizedEmail);
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserByEntityId,
  findUserByLoginIdentifier,
  findUserByIdentityFields,
  upsertUser,
};
