const {
  fabricIdentityExists,
  getContractForIdentity,
} = require('./fabricGatewayService');
const crypto = require('crypto');
const AppError = require('../utils/AppError');
const ROLES = require('../constants/roles');
const { MIN_INTERNSHIP_START_LEAD_DAYS } = require('../constants/agreement');
const { findActiveCompanyByCompanyId } = require('../repositories/companyRepository');
const { findUserByEntityId } = require('../repositories/userRepository');
const {
  findAgreementMetadataByAgreementId,
  findAgreementMetadataByAgreementIds,
  upsertAgreementMetadata,
} = require('../repositories/agreementMetadataRepository');
const {
  getAllowedInternshipFieldsForDepartment,
  WEEKLY_SCHEDULE_DAY_CODES,
} = require('../config/internshipFields');
const {
  getDepartmentInternshipPolicy,
} = require('../config/departmentInternshipPolicies');
const {
  calculateTotalScheduledWorkingDays,
  calculateTotalWorkingDays,
  normalizeWeeklySchedule,
  normalizeWorkingDays,
} = require('../utils/internshipSchedule');

const parseBuffer = (result) => {
  const text = Buffer.from(result).toString('utf8');

  try {
    return JSON.parse(text);
  } catch (err) {
    return text;
  }
};

const AGREEMENT_QUERY_ROLES = [
  ROLES.STUDENT,
  ROLES.COMPANY,
  ROLES.FACULTY,
  ROLES.CENTRAL,
];

const APPROVAL_TX_BY_ROLE = {
  [ROLES.STUDENT]: 'ApproveByStudent',
  [ROLES.COMPANY]: 'ApproveByCompany',
  [ROLES.FACULTY]: 'ApproveByFaculty',
};

const REJECTION_TX_BY_ROLE = {
  [ROLES.STUDENT]: 'RejectByStudent',
  [ROLES.COMPANY]: 'RejectByCompany',
  [ROLES.FACULTY]: 'RejectByFaculty',
};

const PENDING_TX_BY_ROLE = {
  [ROLES.STUDENT]: 'GetPendingAgreementsForStudent',
  [ROLES.COMPANY]: 'GetPendingAgreementsForCompany',
  [ROLES.FACULTY]: 'GetPendingAgreementsForFaculty',
  [ROLES.CENTRAL]: 'GetPendingAgreementsForCentral',
};

const CENTRAL_DIRECT_READ_STATUSES = ['FACULTY_APPROVED', 'ACTIVE', 'COMPLETED'];

const normalizeErrorMessage = (message) => {
  return String(message || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const includesAny = (text, patterns) => {
  return patterns.some((pattern) => text.includes(pattern));
};

const getAgreementId = (agreement) =>
  agreement?.agreementId ||
  agreement?.id ||
  agreement?.AgreementID ||
  agreement?.ID ||
  null;

const getAgreementStatus = (agreement) =>
  agreement?.status ||
  agreement?.agreementStatus ||
  agreement?.currentStatus ||
  agreement?.state ||
  agreement?.Status ||
  'UNKNOWN';

const isInternshipPeriodConflict = (message) => {
  return (
    includesAny(message, [
      'overlapping internship',
      'already has an internship in this period',
      'internship in this period',
      'date conflict',
      'conflict',
      'overlap',
    ]) ||
    (message.includes('internship') && message.includes('period'))
  );
};

const generateAgreementId = () => {
  return `agreement-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
};

const LEGACY_COMPATIBILITY_WORKING_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

const addDaysToIsoDay = (isoDay, days) => {
  const [year, month, day] = String(isoDay || '').split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const isValidDateObject = (value) =>
  value instanceof Date && !Number.isNaN(value.getTime());

const datesOverlap = ({
  startDate,
  endDate,
  existingStartDate,
  existingEndDate,
}) => {
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  const existingStartDateObj = new Date(existingStartDate);
  const existingEndDateObj = new Date(existingEndDate);

  if (
    !isValidDateObject(startDateObj) ||
    !isValidDateObject(endDateObj) ||
    !isValidDateObject(existingStartDateObj) ||
    !isValidDateObject(existingEndDateObj)
  ) {
    return false;
  }

  return startDateObj <= existingEndDateObj && endDateObj >= existingStartDateObj;
};

const getEffectiveInternshipField = ({
  isLegacyCompatibilityCreate,
  allowedInternshipFields,
  completedMandatoryInternshipFields,
  normalizedInternshipField,
}) => {
  if (!isLegacyCompatibilityCreate) {
    return normalizedInternshipField;
  }

  return (
    allowedInternshipFields.find(
      (field) => !completedMandatoryInternshipFields.has(field)
    ) || allowedInternshipFields[0]
  );
};

const getEffectiveWorkingDays = ({
  isLegacyCompatibilityCreate,
  normalizedWorkingDays,
}) => {
  return isLegacyCompatibilityCreate
    ? LEGACY_COMPATIBILITY_WORKING_DAYS
    : normalizedWorkingDays;
};

const validateEffectiveWorkingDays = (effectiveWorkingDays) => {
  if (
    effectiveWorkingDays.length < 3 ||
    effectiveWorkingDays.length > 6
  ) {
    throw new AppError('Weekly working days must be between 3 and 6.', 400);
  }
};

const validateEffectiveWeeklySchedule = (weeklySchedule) => {
  if (!Array.isArray(weeklySchedule) || weeklySchedule.length === 0) {
    throw new AppError('Weekly schedule must contain at least one week.', 400);
  }

  weeklySchedule.forEach((week) => {
    if (!Array.isArray(week) || week.length < 3 || week.length > 6) {
      throw new AppError('Each week must contain between 3 and 6 working days.', 400);
    }

    const uniqueDays = new Set(week);

    if (uniqueDays.size !== week.length) {
      throw new AppError('Duplicate working days are not allowed inside a week.', 400);
    }

    const invalidDay = week.find(
      (dayCode) => !WEEKLY_SCHEDULE_DAY_CODES.includes(dayCode)
    );

    if (invalidDay) {
      throw new AppError(
        `Weekly schedule days must be one of: ${WEEKLY_SCHEDULE_DAY_CODES.join(', ')}.`,
        400
      );
    }
  });
};

const validateEffectiveInternshipField = ({
  allowedInternshipFields,
  effectiveInternshipField,
}) => {
  if (!allowedInternshipFields.includes(effectiveInternshipField)) {
    throw new AppError(
      `Internship field must be one of: ${allowedInternshipFields.join(', ')}.`,
      400
    );
  }
};

const hasOverlappingStudentAgreement = ({
  existingAgreements,
  agreementId,
  normalizedStartDate,
  normalizedEndDate,
}) => {
  return existingAgreements.some((agreement) => {
    const status = getAgreementStatus(agreement);

    if (getAgreementId(agreement) === agreementId) {
      return false;
    }

    if (['REJECTED', 'CANCELLED'].includes(status)) {
      return false;
    }

    return datesOverlap({
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      existingStartDate: agreement.startDate,
      existingEndDate: agreement.endDate,
    });
  });
};

const getCompletedInternshipProgress = (agreements = []) => {
  return agreements.reduce(
    (progress, agreement) => {
      if (getAgreementStatus(agreement) !== 'COMPLETED') {
        return progress;
      }

      const internshipType = agreement?.internshipType;
      const totalWorkingDays = Number(agreement?.totalWorkingDays || 0);

      if (internshipType === 'MANDATORY') {
        progress.completedMandatoryInternshipCount += 1;
        progress.completedMandatoryInternshipDays += totalWorkingDays;

        if (agreement?.internshipField) {
          progress.completedMandatoryInternshipFields.add(
            agreement.internshipField
          );
        }
      }

      if (internshipType === 'VOLUNTARY') {
        progress.completedVoluntaryInternshipDays += totalWorkingDays;
      }

      return progress;
    },
    {
      completedMandatoryInternshipCount: 0,
      completedMandatoryInternshipDays: 0,
      completedVoluntaryInternshipDays: 0,
      completedMandatoryInternshipFields: new Set(),
    }
  );
};

const enforceInternshipTypeRules = ({
  effectiveInternshipType,
  departmentPolicy,
  totalWorkingDays,
  completedProgress,
  effectiveInternshipField,
}) => {
  if (effectiveInternshipType === 'MANDATORY') {
    if (!departmentPolicy) {
      throw new AppError(
        'Student department metadata is missing or unsupported for mandatory internship validation.',
        400
      );
    }

    if (
      totalWorkingDays < departmentPolicy.mandatoryMinDaysPerInternship
    ) {
      throw new AppError(
        `Mandatory internship must be at least ${departmentPolicy.mandatoryMinDaysPerInternship} working days for this department.`,
        400
      );
    }

    if (
      completedProgress.completedMandatoryInternshipCount >=
      departmentPolicy.mandatoryRequiredCount
    ) {
      throw new AppError(
        'Student has already completed the maximum number of mandatory internships for this department.',
        400
      );
    }

    if (
      completedProgress.completedMandatoryInternshipFields.has(
        effectiveInternshipField
      )
    ) {
      throw new AppError(
        'Student cannot create another mandatory internship in the same internship field.',
        400
      );
    }
  }

  if (effectiveInternshipType === 'VOLUNTARY') {
    if (!departmentPolicy) {
      throw new AppError(
        'Student department metadata is missing or unsupported for voluntary internship validation.',
        400
      );
    }

    if (totalWorkingDays < departmentPolicy.voluntaryMinDaysPerInternship) {
      throw new AppError(
        'Voluntary internship must be at least 10 working days.',
        400
      );
    }

    if (
      completedProgress.completedVoluntaryInternshipDays + totalWorkingDays >
      departmentPolicy.voluntaryMaxDays
    ) {
      throw new AppError(
        'Student cannot exceed 50 total voluntary internship days.',
        400
      );
    }
  }
};

const mergeAgreementWithMetadata = (agreement, metadata) => {
  if (!agreement || !metadata) {
    return agreement;
  }

  return {
    ...agreement,
    internshipType: metadata.internshipType,
    internshipField: metadata.internshipField,
    workingDays: metadata.workingDays,
    weeklySchedule: metadata.weeklySchedule,
    weeklyWorkingDayCount: metadata.weeklyWorkingDayCount,
    totalWorkingDays: metadata.totalWorkingDays,
  };
};

const enrichAgreement = async (agreement) => {
  if (!agreement || typeof agreement !== 'object') {
    return agreement;
  }

  const agreementId = getAgreementId(agreement);

  if (!agreementId) {
    return agreement;
  }

  const metadata = await findAgreementMetadataByAgreementId(agreementId);
  return mergeAgreementWithMetadata(agreement, metadata);
};

const enrichAgreementList = async (agreements = []) => {
  const agreementIds = agreements
    .map((agreement) => getAgreementId(agreement))
    .filter(Boolean);
  const metadataByAgreementId = await findAgreementMetadataByAgreementIds(
    agreementIds
  );

  return agreements.map((agreement) => {
    const agreementId = getAgreementId(agreement);
    return mergeAgreementWithMetadata(
      agreement,
      metadataByAgreementId.get(agreementId)
    );
  });
};

const enrichAgreementHistory = async (entries = []) => {
  const agreementIds = entries
    .map((entry) => getAgreementId(entry?.value))
    .filter(Boolean);
  const metadataByAgreementId = await findAgreementMetadataByAgreementIds(
    agreementIds
  );

  return entries.map((entry) => {
    const agreementId = getAgreementId(entry?.value);

    if (!agreementId) {
      return entry;
    }

    return {
      ...entry,
      value: mergeAgreementWithMetadata(
        entry.value,
        metadataByAgreementId.get(agreementId)
      ),
    };
  });
};

const ensureAllowedRole = (role, allowedRoles, message) => {
  if (!allowedRoles.includes(role)) {
    throw new AppError(message || `Unsupported role: ${role}`, 403);
  }
};

const deriveHistoryAction = (entry) => {
  if (entry?.isDelete) {
    return 'Deleted';
  }

  const status = getAgreementStatus(entry?.value);
  const rejectedByRole = entry?.value?.rejectedByRole;

  if (status === 'CREATED') return 'Created';
  if (status === 'STUDENT_APPROVED') return 'Approved';
  if (status === 'COMPANY_APPROVED') return 'Approved';
  if (status === 'FACULTY_APPROVED') return 'Approved';
  if (status === 'ACTIVE') return 'Activated';
  if (status === 'COMPLETED') return 'Completed';
  if (status === 'REJECTED') return 'Rejected';
  if (rejectedByRole) return 'Rejected';

  return 'Updated';
};

const deriveHistoryActor = (entry) => {
  if (entry?.isDelete) return 'system';

  const value = entry?.value || {};
  const status = getAgreementStatus(value);

  if (status === 'CREATED') return 'student';
  if (status === 'STUDENT_APPROVED') return 'student';
  if (status === 'COMPANY_APPROVED') return 'company';
  if (status === 'FACULTY_APPROVED') return 'faculty';
  if (status === 'ACTIVE') return 'central';
  if (status === 'COMPLETED') return 'central';
  if (status === 'REJECTED') return value.rejectedByRole || 'unknown';

  return 'system';
};

const deriveHistoryEventType = (entry) => {
  if (entry?.isDelete) return 'AgreementDeleted';

  const value = entry?.value || {};
  const status = getAgreementStatus(value);

  if (status === 'CREATED') return 'AgreementCreated';
  if (status === 'STUDENT_APPROVED') return 'AgreementApprovedByStudent';
  if (status === 'COMPANY_APPROVED') return 'AgreementApprovedByCompany';
  if (status === 'FACULTY_APPROVED') return 'AgreementApprovedByFaculty';
  if (status === 'ACTIVE') return 'AgreementActivated';
  if (status === 'COMPLETED') return 'AgreementCompleted';
  if (status === 'REJECTED') {
    const rejectedByRole = value.rejectedByRole || 'Unknown';
    return `AgreementRejectedBy${rejectedByRole.charAt(0).toUpperCase()}${rejectedByRole.slice(1)}`;
  }

  return 'AgreementUpdated';
};

const enrichHistoryEntry = (entry) => {
  const resultingStatus = getAgreementStatus(entry?.value);

  return {
    ...entry,
    eventType: deriveHistoryEventType(entry),
    action: deriveHistoryAction(entry),
    actor: deriveHistoryActor(entry),
    resultingStatus,
  };
};

const getCentralAccessibleAgreementMap = async (contract) => {
  const [pendingResult, activeResult] = await Promise.all([
    contract.evaluateTransaction('GetPendingAgreementsForCentral'),
    contract.evaluateTransaction('GetActiveAgreementsForCentral'),
  ]);

  const accessibleAgreements = [
    ...parseBuffer(pendingResult),
    ...parseBuffer(activeResult),
  ];

  return new Map(
    accessibleAgreements
      .map((agreement) => [getAgreementId(agreement), agreement])
      .filter(([agreementId]) => Boolean(agreementId))
  );
};

const ensureCentralCanAccessAgreement = async (contract, agreementId) => {
  const accessibleAgreements = await getCentralAccessibleAgreementMap(contract);
  let agreement = accessibleAgreements.get(agreementId);

  if (!agreement && CENTRAL_DIRECT_READ_STATUSES.includes('COMPLETED')) {
    try {
      const result = await contract.evaluateTransaction('ReadAgreement', agreementId);
      const parsedAgreement = parseBuffer(result);

      if (CENTRAL_DIRECT_READ_STATUSES.includes(getAgreementStatus(parsedAgreement))) {
        agreement = parsedAgreement;
      }
    } catch (error) {
      // Fall through to the shared access-denied error below.
    }
  }

  if (!agreement) {
    throw new AppError(
      `Central can only access agreements in statuses: ${CENTRAL_DIRECT_READ_STATUSES.join(', ')}`,
      403
    );
  }

  return agreement;
};

const translateAgreementError = (error) => {
  if (error instanceof AppError) {
    return error;
  }

  const message = error?.message || 'Internal server error.';
  const normalizedMessage = normalizeErrorMessage(message);
  const mentionsDateOrDuration = includesAny(normalizedMessage, [
    'date',
    'duration',
    'day',
    'days',
    'start date',
    'end date',
  ]);

  if (
    includesAny(normalizedMessage, [
      'unauthorized',
      'not authorized',
      'forbidden',
      'not allowed',
      'access denied',
      'permission denied',
      'entity mismatch',
      'identity mismatch',
      'does not belong to',
    ])
  ) {
    return new AppError(message, 403);
  }

  if (
    includesAny(normalizedMessage, [
      'does not exist',
      'not found',
      'no agreement found',
      'agreement not found',
      'record not found',
      'cannot find',
    ])
  ) {
    return new AppError(message, 404);
  }

  if (
    includesAny(normalizedMessage, [
      'already exists',
      'already approved',
      'already rejected',
      'already active',
      'already completed',
      'invalid state',
      'current state does not allow',
      'state does not allow',
      'maximum mandatory internship',
      'repeat a mandatory internship in the same field',
      '50 total voluntary internship days',
    ]) ||
    isInternshipPeriodConflict(normalizedMessage) ||
    (normalizedMessage.includes('cannot ') &&
      includesAny(normalizedMessage, [
        'approve',
        'reject',
        'activate',
        'complete',
        'create',
        'repeat',
        'exceed',
      ]))
  ) {
    return new AppError(message, 409);
  }

  if (
    includesAny(normalizedMessage, [
      'invalid date',
      'invalid format',
      'invalid rejection reason',
      'invalid reason',
      'invalid internshiptype',
      'invalid internshipfield',
      'invalid totalworkingdays',
      'invalid workingdays format',
      'invalid weeklyschedule format',
      'workingdays must contain between 3 and 6 unique days',
      'workingdays must only include mon, tue, wed, thu, fri, sat',
      'workingdays must only include mon, tue, wed, thu, fri, sat, sun',
      'workingdays cannot contain duplicates',
      'weeklyschedule must contain at least one week',
      'each weeklyschedule week must contain between 3 and 6 unique days',
      'weeklyschedule weeks cannot contain duplicate days',
      'weeklyschedule must only include mon, tue, wed, thu, fri, sat, sun',
      'provided totalworkingdays does not match workingdays and date range',
      'provided totalworkingdays does not match schedule',
      'missing required',
      'required field',
      'required input',
      'missing input',
      'invalid input',
      'bad request',
      'must be at least',
      'minimum',
      'at least 20 day',
      'at least 20 days',
    ])
    || (
      mentionsDateOrDuration &&
      includesAny(normalizedMessage, [
        'must be at least',
        'minimum',
        'less than',
        'too short',
        'must be greater than',
        'must be later than',
      ])
    )
  ) {
    return new AppError(message, 400);
  }

  return error;
};

const getMyAgreements = async (user) => {
  const { role, fabricIdentity } = user;

  ensureAllowedRole(
    role,
    AGREEMENT_QUERY_ROLES,
    `Unsupported role: ${role}`
  );

  const { contract, gateway, client } = await getContractForIdentity(
    fabricIdentity
  );

  try {
    if (role === ROLES.CENTRAL) {
      const pendingResult = await contract.evaluateTransaction(
        'GetPendingAgreementsForCentral'
      );

      const activeResult = await contract.evaluateTransaction(
        'GetActiveAgreementsForCentral'
      );

      return {
        pendingActivation: await enrichAgreementList(parseBuffer(pendingResult)),
        active: await enrichAgreementList(parseBuffer(activeResult)),
      };
    }

    const txNameByRole = {
      [ROLES.STUDENT]: 'GetMyStudentAgreements',
      [ROLES.COMPANY]: 'GetMyCompanyAgreements',
      [ROLES.FACULTY]: 'GetMyFacultyAgreements',
    };

    const result = await contract.evaluateTransaction(txNameByRole[role]);
    return enrichAgreementList(parseBuffer(result));
  } catch (error) {
    throw translateAgreementError(error);
  } finally {
    gateway.close();
    client.close();
  }
};

const getAgreementById = async (user, agreementId) => {
  const { role, fabricIdentity } = user;

  ensureAllowedRole(
    role,
    AGREEMENT_QUERY_ROLES,
    `Unsupported role for reading agreement: ${role}`
  );

  const { contract, gateway, client } = await getContractForIdentity(
    fabricIdentity
  );

  try {
    if (role === ROLES.CENTRAL) {
      await ensureCentralCanAccessAgreement(contract, agreementId);
    }

    const result = await contract.evaluateTransaction('ReadAgreement', agreementId);
    return enrichAgreement(parseBuffer(result));
  } catch (error) {
    throw translateAgreementError(error);
  } finally {
    gateway.close();
    client.close();
  }
};

const getAgreementHistory = async (user, agreementId) => {
  const { role, fabricIdentity } = user;

  ensureAllowedRole(
    role,
    AGREEMENT_QUERY_ROLES,
    `Unsupported role for agreement history: ${role}`
  );

  const { contract, gateway, client } = await getContractForIdentity(
    fabricIdentity
  );

  try {
    if (role === ROLES.CENTRAL) {
      await ensureCentralCanAccessAgreement(contract, agreementId);
    }

    const result = await contract.evaluateTransaction(
      'GetAgreementHistory',
      agreementId
    );
    return enrichAgreementHistory(parseBuffer(result).map(enrichHistoryEntry));
  } catch (error) {
    throw translateAgreementError(error);
  } finally {
    gateway.close();
    client.close();
  }
};

const getPendingAgreements = async (user) => {
  const { role, fabricIdentity } = user;

  ensureAllowedRole(
    role,
    AGREEMENT_QUERY_ROLES,
    `Unsupported role for pending agreements: ${role}`
  );

  const { contract, gateway, client } = await getContractForIdentity(
    fabricIdentity
  );

  try {
    const result = await contract.evaluateTransaction(PENDING_TX_BY_ROLE[role]);
    return enrichAgreementList(parseBuffer(result));
  } catch (error) {
    throw translateAgreementError(error);
  } finally {
    gateway.close();
    client.close();
  }
};

const createAgreement = async (user, payload) => {
  const { role, fabricIdentity, entityId } = user;
  const {
    companyId,
    facultyId: requestedFacultyId,
    startDate,
    endDate,
    internshipType,
    internshipField,
    workingDays,
    weeklySchedule,
  } = payload;
  const agreementId = payload.agreementId || generateAgreementId();
  const normalizedStartDate = String(startDate || '').slice(0, 10);
  const normalizedEndDate = String(endDate || '').slice(0, 10);
  const normalizedInternshipType = String(internshipType || '')
    .trim()
    .toUpperCase();
  const normalizedInternshipField = String(internshipField || '')
    .trim()
    .toUpperCase();
  const normalizedWorkingDays = normalizeWorkingDays(workingDays);
  const normalizedWeeklySchedule = normalizeWeeklySchedule(weeklySchedule);
  const hasWeeklySchedule = weeklySchedule !== undefined;
  const isLegacyCompatibilityCreate =
    internshipType === undefined &&
    internshipField === undefined &&
    workingDays === undefined &&
    weeklySchedule === undefined;

  ensureAllowedRole(role, [ROLES.STUDENT], 'Only students can create agreements');

  const company = await findActiveCompanyByCompanyId(companyId);
  const student = await findUserByEntityId(entityId);

  if (!company) {
    throw new AppError('Selected company was not found or is inactive.', 400);
  }

  if (!company.fabricIdentity || !fabricIdentityExists(company.fabricIdentity)) {
    throw new AppError(
      'Selected company does not have a Fabric identity yet. Submit a company request before creating an agreement with this company.',
      400
    );
  }

  if (!student) {
    throw new AppError('Authenticated student profile was not found.', 404);
  }

  const storedFacultyId = String(student.facultyId || '').trim();
  const normalizedRequestedFacultyId = String(requestedFacultyId || '').trim();

  if (!storedFacultyId) {
    throw new AppError(
      'Student faculty metadata is missing. Please contact the system administrator.',
      400
    );
  }

  if (
    normalizedRequestedFacultyId &&
    normalizedRequestedFacultyId !== storedFacultyId
  ) {
    throw new AppError(
      'Faculty ID must match the authenticated student record.',
      400
    );
  }

  if (Number(student.completedCredits || 0) < 30) {
    throw new AppError(
      'Student must have at least 30 completed credits to create an internship.',
      400
    );
  }

  const minimumStartDate = addDaysToIsoDay(
    new Date().toISOString().slice(0, 10),
    MIN_INTERNSHIP_START_LEAD_DAYS
  );
  const startDateObj = new Date(normalizedStartDate);
  const minDateObj = new Date(minimumStartDate);

  if (
    Number.isNaN(startDateObj.getTime()) ||
    Number.isNaN(minDateObj.getTime())
  ) {
    throw new AppError('Invalid date format.', 400);
  }

  if (startDateObj < minDateObj) {
    throw new AppError(
      'Internship must start at least 15 days from today.',
      400
    );
  }

  const allowedInternshipFields = getAllowedInternshipFieldsForDepartment(
    student.departmentCode
  );
  const departmentPolicy = getDepartmentInternshipPolicy(student.departmentCode);

  if (!student.departmentCode || !allowedInternshipFields.length) {
    throw new AppError(
      'Student department metadata is missing or unsupported for internship field validation.',
      400
    );
  }

  const { contract, gateway, client } = await getContractForIdentity(
    fabricIdentity
  );

  const effectiveInternshipType = isLegacyCompatibilityCreate
    ? 'MANDATORY'
    : normalizedInternshipType;
  try {
    const existingAgreementsResult = await contract.evaluateTransaction(
      'GetMyStudentAgreements'
    );
    const existingAgreements = await enrichAgreementList(
      parseBuffer(existingAgreementsResult)
    );
    // TODO: Pre-Phase-2 agreements without local metadata can under-report
    // completed progress until a backfill/migration exists.
    const completedProgress = getCompletedInternshipProgress(existingAgreements);
    const effectiveInternshipField = getEffectiveInternshipField({
      isLegacyCompatibilityCreate,
      allowedInternshipFields,
      completedMandatoryInternshipFields:
        completedProgress.completedMandatoryInternshipFields,
      normalizedInternshipField,
    });
    const effectiveWorkingDays = getEffectiveWorkingDays({
      isLegacyCompatibilityCreate,
      normalizedWorkingDays,
    });
    const effectiveWeeklySchedule = hasWeeklySchedule
      ? normalizedWeeklySchedule
      : null;

    if (effectiveWeeklySchedule) {
      validateEffectiveWeeklySchedule(effectiveWeeklySchedule);
    } else {
      validateEffectiveWorkingDays(effectiveWorkingDays);
    }

    validateEffectiveInternshipField({
      allowedInternshipFields,
      effectiveInternshipField,
    });

    const weeklyWorkingDayCount = effectiveWeeklySchedule
      ? Math.max(...effectiveWeeklySchedule.map((week) => week.length))
      : effectiveWorkingDays.length;
    const totalWorkingDays = effectiveWeeklySchedule
      ? calculateTotalScheduledWorkingDays(effectiveWeeklySchedule)
      : calculateTotalWorkingDays({
          startDate: normalizedStartDate,
          endDate: normalizedEndDate,
          workingDays: effectiveWorkingDays,
        });

    if (
      hasOverlappingStudentAgreement({
        existingAgreements,
        agreementId,
        normalizedStartDate,
        normalizedEndDate,
      })
    ) {
      throw new AppError(
        'Student already has an internship that overlaps with the selected date range.',
        400
      );
    }

    enforceInternshipTypeRules({
      effectiveInternshipType,
      departmentPolicy,
      totalWorkingDays,
      completedProgress,
      effectiveInternshipField,
    });

    // Client-provided totalWorkingDays is never authoritative.
    // The backend always persists the recomputed value.

    // TODO: Remove legacy fallback once all clients send explicit
    // internshipType, internshipField, and workingDays.

    const result = await contract.submitTransaction(
      'CreateAgreement',
      agreementId,
      entityId,
      companyId,
      storedFacultyId,
      normalizedStartDate,
      normalizedEndDate,
      effectiveInternshipType,
      effectiveInternshipField,
      JSON.stringify(effectiveWorkingDays),
      effectiveWeeklySchedule ? JSON.stringify(effectiveWeeklySchedule) : '',
      String(totalWorkingDays)
    );
    await upsertAgreementMetadata({
      agreementId,
      internshipType: effectiveInternshipType,
      internshipField: effectiveInternshipField,
      workingDays: effectiveWorkingDays,
      weeklySchedule: effectiveWeeklySchedule,
      weeklyWorkingDayCount,
      totalWorkingDays,
    });

    return mergeAgreementWithMetadata(parseBuffer(result), {
      internshipType: effectiveInternshipType,
      internshipField: effectiveInternshipField,
      workingDays: effectiveWorkingDays,
      weeklySchedule: effectiveWeeklySchedule,
      weeklyWorkingDayCount,
      totalWorkingDays,
    });
  } catch (error) {
    throw translateAgreementError(error);
  } finally {
    gateway.close();
    client.close();
  }
};

const approveAgreement = async (user, agreementId) => {
  const { role, fabricIdentity } = user;

  ensureAllowedRole(
    role,
    [ROLES.STUDENT, ROLES.COMPANY, ROLES.FACULTY],
    `Unsupported role for approval: ${role}`
  );

  const { contract, gateway, client } = await getContractForIdentity(
    fabricIdentity
  );

  try {
    const txName = APPROVAL_TX_BY_ROLE[role];
    const result = await contract.submitTransaction(txName, agreementId);
    return parseBuffer(result);
  } catch (error) {
    throw translateAgreementError(error);
  } finally {
    gateway.close();
    client.close();
  }
};

const activateAgreement = async (user, agreementId) => {
  const { role, fabricIdentity } = user;

  if (role !== ROLES.CENTRAL) {
    throw new AppError('Only central can activate agreements', 403);
  }

  const { contract, gateway, client } = await getContractForIdentity(
    fabricIdentity
  );

  try {
    const result = await contract.submitTransaction(
      'ActivateAgreement',
      agreementId
    );
    return parseBuffer(result);
  } catch (error) {
    throw translateAgreementError(error);
  } finally {
    gateway.close();
    client.close();
  }
};

const rejectAgreement = async (user, agreementId, reason) => {
  const { role, fabricIdentity } = user;

  ensureAllowedRole(
    role,
    [ROLES.STUDENT, ROLES.COMPANY, ROLES.FACULTY],
    `Unsupported role for rejection: ${role}`
  );

  const { contract, gateway, client } = await getContractForIdentity(
    fabricIdentity
  );

  try {
    const txName = REJECTION_TX_BY_ROLE[role];
    const result = await contract.submitTransaction(txName, agreementId, reason);
    return parseBuffer(result);
  } catch (error) {
    throw translateAgreementError(error);
  } finally {
    gateway.close();
    client.close();
  }
};

const completeAgreement = async (user, agreementId) => {
  const { role, fabricIdentity } = user;

  if (role !== ROLES.CENTRAL) {
    throw new AppError('Only central can complete agreements', 403);
  }

  const { contract, gateway, client } = await getContractForIdentity(
    fabricIdentity
  );

  try {
    const result = await contract.submitTransaction(
      'CompleteAgreement',
      agreementId
    );
    return parseBuffer(result);
  } catch (error) {
    throw translateAgreementError(error);
  } finally {
    gateway.close();
    client.close();
  }
};

module.exports = {
  getMyAgreements,
  getAgreementById,
  getAgreementHistory,
  getPendingAgreements,
  createAgreement,
  approveAgreement,
  activateAgreement,
  rejectAgreement,
  completeAgreement,
};
