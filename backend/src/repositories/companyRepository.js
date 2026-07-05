const { all, get, run } = require('../config/db');

const companySelectFields = `
  id,
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
`;

const mapCompany = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    companyId: row.company_id,
    username: row.username,
    companyName: row.company_name,
    companyAddress: row.company_address,
    companyPhoneNumber: row.company_phone_number,
    companyFaxNumber: row.company_fax_number,
    companyEmail: row.company_email,
    isPublicInstitution: Boolean(row.is_public_institution),
    companyTitle: row.company_title,
    companyIban: row.company_iban,
    companyBankName: row.company_bank_name,
    companyBankBranchCode: row.company_bank_branch_code,
    companyBankBranchName: row.company_bank_branch_name,
    companyRegistrationNumber: row.company_registration_number,
    companyTaxIdentificationNumber: row.company_tax_identification_number,
    isActive: Boolean(row.is_active),
    fabricIdentity: row.fabric_identity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const listApprovedCompanies = async ({ search } = {}) => {
  const normalizedSearch = String(search || '').trim().toLowerCase();

  const rows = await all(
    `
      SELECT ${companySelectFields}
      FROM companies
      WHERE is_active = 1
        AND (? = '' OR LOWER(company_name) LIKE '%' || ? || '%')
      ORDER BY company_name ASC
    `,
    [normalizedSearch, normalizedSearch]
  );

  return rows.map(mapCompany);
};

const findActiveCompanyByCompanyId = async (companyId) => {
  const row = await get(
    `
      SELECT ${companySelectFields}
      FROM companies
      WHERE company_id = ? AND is_active = 1
      LIMIT 1
    `,
    [String(companyId || '').trim()]
  );

  return mapCompany(row);
};

const findCompanyByUsername = async (username) => {
  const normalizedUsername = String(username || '').trim().toLowerCase();

  const row = await get(
    `
      SELECT ${companySelectFields}
      FROM companies
      WHERE username = ?
      LIMIT 1
    `,
    [normalizedUsername]
  );

  return mapCompany(row);
};

const createCompany = async ({
  companyId,
  username,
  companyName,
  companyAddress,
  companyPhoneNumber,
  companyFaxNumber,
  companyEmail,
  isPublicInstitution,
  companyTitle,
  companyIban,
  companyBankName,
  companyBankBranchCode,
  companyBankBranchName,
  companyRegistrationNumber = null,
  companyTaxIdentificationNumber = null,
  isActive = true,
  fabricIdentity = null,
}) => {
  const timestamp = new Date().toISOString();

  await run(
    `
      INSERT INTO companies (
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
      companyId,
      String(username || '').trim().toLowerCase(),
      companyName,
      companyAddress,
      companyPhoneNumber,
      companyFaxNumber,
      String(companyEmail || '').trim().toLowerCase(),
      isPublicInstitution ? 1 : 0,
      companyTitle,
      companyIban,
      companyBankName,
      companyBankBranchCode,
      companyBankBranchName,
      companyRegistrationNumber,
      companyTaxIdentificationNumber,
      isActive ? 1 : 0,
      fabricIdentity,
      timestamp,
      timestamp,
    ]
  );

  return findActiveCompanyByCompanyId(companyId);
};

module.exports = {
  createCompany,
  findActiveCompanyByCompanyId,
  findCompanyByUsername,
  listApprovedCompanies,
};
