const { all, get, run } = require('../config/db');

const companyRequestSelectFields = `
  id,
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
  requested_by_student_id,
  request_status,
  rejection_reason,
  reviewed_by_central_id,
  created_at,
  updated_at
`;

const mapCompanyRequest = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
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
    requestedByStudentId: row.requested_by_student_id,
    requestStatus: row.request_status,
    rejectionReason: row.rejection_reason,
    reviewedByCentralId: row.reviewed_by_central_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const createCompanyRequest = async ({
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
  requestedByStudentId,
}) => {
  const timestamp = new Date().toISOString();

  const result = await run(
    `
      INSERT INTO company_requests (
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
        requested_by_student_id,
        request_status,
        rejection_reason,
        reviewed_by_central_id,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL, NULL, ?, ?)
    `,
    [
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
      requestedByStudentId,
      timestamp,
      timestamp,
    ]
  );

  return findCompanyRequestById(result.lastID);
};

const listCompanyRequestsByStatus = async (status = 'PENDING') => {
  const rows = await all(
    `
      SELECT ${companyRequestSelectFields}
      FROM company_requests
      WHERE request_status = ?
      ORDER BY created_at ASC
    `,
    [status]
  );

  return rows.map(mapCompanyRequest);
};

const findCompanyRequestById = async (id) => {
  const row = await get(
    `
      SELECT ${companyRequestSelectFields}
      FROM company_requests
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return mapCompanyRequest(row);
};

const updateCompanyRequestReview = async ({
  id,
  requestStatus,
  rejectionReason = null,
  reviewedByCentralId,
}) => {
  const timestamp = new Date().toISOString();

  await run(
    `
      UPDATE company_requests
      SET
        request_status = ?,
        rejection_reason = ?,
        reviewed_by_central_id = ?,
        updated_at = ?
      WHERE id = ?
    `,
    [requestStatus, rejectionReason, reviewedByCentralId, timestamp, id]
  );

  return findCompanyRequestById(id);
};

const deleteRejectedCompanyRequestsUpdatedBefore = async (cutoffIso) => {
  return run(
    `
      DELETE FROM company_requests
      WHERE request_status = 'REJECTED'
        AND updated_at < ?
    `,
    [cutoffIso]
  );
};

module.exports = {
  createCompanyRequest,
  deleteRejectedCompanyRequestsUpdatedBefore,
  findCompanyRequestById,
  listCompanyRequestsByStatus,
  updateCompanyRequestReview,
};
