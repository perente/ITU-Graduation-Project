const crypto = require('crypto');

const AppError = require('../utils/AppError');
const ROLES = require('../constants/roles');
const {
  createCompany,
  findActiveCompanyByCompanyId,
  findCompanyByUsername,
  listApprovedCompanies,
} = require('../repositories/companyRepository');
const {
  createCompanyRequest,
  findCompanyRequestById,
  listCompanyRequestsByStatus,
  updateCompanyRequestReview,
} = require('../repositories/companyRequestRepository');
const {
  createUser,
  findUserByIdentityFields,
} = require('../repositories/userRepository');
const { hashPassword } = require('../utils/password');
const { withTransaction } = require('../config/db');
const {
  cleanupProvisionedIdentity,
  provisionCompanyIdentity,
} = require('./companyIdentityProvisioningService');
const { fabricIdentityExists } = require('./fabricGatewayService');

const ensureRole = (user, allowedRoles, message) => {
  if (!allowedRoles.includes(user.role)) {
    throw new AppError(message, 403);
  }
};

const createSlug = (value, fallback) => {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();

  return slug || fallback;
};

const generateUniqueCompanyId = async (companyName) => {
  const base = createSlug(companyName, 'company');

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = attempt === 0 ? '' : crypto.randomBytes(2).toString('hex');
    const companyId = `${base}${suffix}`;
    const existingCompany = await findActiveCompanyByCompanyId(companyId);

    if (!existingCompany) {
      return companyId;
    }
  }

  return `company${Date.now()}`;
};

const generateUniqueUsername = async (companyName) => {
  const base = createSlug(companyName, 'companyuser');

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = attempt === 0 ? '' : crypto.randomBytes(2).toString('hex');
    const username = `${base}${suffix}`;
    const existingCompany = await findCompanyByUsername(username);

    if (!existingCompany) {
      return username;
    }
  }

  return `company${Date.now()}`;
};

const generateTemporaryPassword = () => {
  return crypto.randomBytes(6).toString('base64url');
};

const getApprovedCompanies = async (user, query = {}) => {
  ensureRole(
    user,
    [ROLES.STUDENT, ROLES.COMPANY, ROLES.FACULTY, ROLES.CENTRAL],
    'You are not authorized to view companies.'
  );

  const companies = await listApprovedCompanies({ search: query.q });

  return companies.filter((company) => fabricIdentityExists(company.fabricIdentity));
};

const submitCompanyRequest = async (user, payload) => {
  ensureRole(user, [ROLES.STUDENT], 'Only students can submit company requests.');

  return createCompanyRequest({
    ...payload,
    requestedByStudentId: user.entityId,
  });
};

const getPendingCompanyRequests = async (user) => {
  ensureRole(user, [ROLES.CENTRAL], 'Only central can view company requests.');

  return listCompanyRequestsByStatus('PENDING');
};

const getCompanyRequestById = async (user, id) => {
  ensureRole(user, [ROLES.CENTRAL], 'Only central can view company requests.');

  const companyRequest = await findCompanyRequestById(id);

  if (!companyRequest) {
    throw new AppError('Company request not found.', 404);
  }

  return companyRequest;
};

const approveCompanyRequest = async (user, id) => {
  ensureRole(user, [ROLES.CENTRAL], 'Only central can approve company requests.');

  const companyRequest = await findCompanyRequestById(id);

  if (!companyRequest) {
    throw new AppError('Company request not found.', 404);
  }

  if (companyRequest.requestStatus !== 'PENDING') {
    throw new AppError('Only pending company requests can be approved.', 409);
  }

  const companyId = await generateUniqueCompanyId(companyRequest.companyName);
  const username = await generateUniqueUsername(companyRequest.companyName);
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const { fabricIdentity } = await provisionCompanyIdentity({ companyId });

  const existingUser = await findUserByIdentityFields({
    email: companyRequest.companyEmail,
    username,
    entityId: companyId,
    fabricIdentity,
  });

  if (existingUser) {
    await cleanupProvisionedIdentity(fabricIdentity);
    throw new AppError('A user account already exists for this company.', 409);
  }

  try {
    return await withTransaction(async () => {
      const company = await createCompany({
        companyId,
        username,
        companyName: companyRequest.companyName,
        companyAddress: companyRequest.companyAddress,
        companyPhoneNumber: companyRequest.companyPhoneNumber,
        companyFaxNumber: companyRequest.companyFaxNumber,
        companyEmail: companyRequest.companyEmail,
        isPublicInstitution: companyRequest.isPublicInstitution,
        companyTitle: companyRequest.companyTitle,
        companyIban: companyRequest.companyIban,
        companyBankName: companyRequest.companyBankName,
        companyBankBranchCode: companyRequest.companyBankBranchCode,
        companyBankBranchName: companyRequest.companyBankBranchName,
        companyRegistrationNumber: companyRequest.companyRegistrationNumber,
        companyTaxIdentificationNumber: companyRequest.companyTaxIdentificationNumber,
        isActive: true,
        fabricIdentity,
      });

      await createUser({
        email: companyRequest.companyEmail,
        username,
        passwordHash,
        role: ROLES.COMPANY,
        entityId: companyId,
        fabricIdentity,
        isActive: true,
      });

      const reviewedRequest = await updateCompanyRequestReview({
        id,
        requestStatus: 'APPROVED',
        reviewedByCentralId: user.entityId,
      });

      return {
        request: reviewedRequest,
        company,
        credentials: {
          username,
          temporaryPassword,
        },
        fabricIdentity,
      };
    });
  } catch (error) {
    await cleanupProvisionedIdentity(fabricIdentity);
    throw error;
  }
};

const rejectCompanyRequest = async (user, id, rejectionReason) => {
  ensureRole(user, [ROLES.CENTRAL], 'Only central can reject company requests.');

  const companyRequest = await findCompanyRequestById(id);

  if (!companyRequest) {
    throw new AppError('Company request not found.', 404);
  }

  if (companyRequest.requestStatus !== 'PENDING') {
    throw new AppError('Only pending company requests can be rejected.', 409);
  }

  return updateCompanyRequestReview({
    id,
    requestStatus: 'REJECTED',
    rejectionReason,
    reviewedByCentralId: user.entityId,
  });
};

module.exports = {
  approveCompanyRequest,
  getApprovedCompanies,
  getCompanyRequestById,
  getPendingCompanyRequests,
  rejectCompanyRequest,
  submitCompanyRequest,
};
