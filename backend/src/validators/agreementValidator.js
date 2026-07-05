const Joi = require('joi');
const {
  AGREEMENT_REJECTION_REASONS,
  MIN_INTERNSHIP_DURATION_DAYS,
  MIN_INTERNSHIP_START_LEAD_DAYS,
} = require('../constants/agreement');
const {
  INTERNSHIP_TYPES,
  WEEKLY_SCHEDULE_DAY_CODES,
  WORKING_DAY_CODES,
} = require('../config/internshipFields');

const isoDateField = (label) =>
  Joi.string()
    .trim()
    .isoDate()
    .required()
    .messages({
      'string.empty': `${label} is required.`,
      'string.isoDate': `${label} must be in ISO format.`,
      'any.required': `${label} is required.`,
    });

const toIsoDay = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

const addDaysToIsoDay = (isoDay, days) => {
  const [year, month, day] = isoDay.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const getTodayIsoDay = () => new Date().toISOString().slice(0, 10);

const agreementIdParamSchema = Joi.object({
  id: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Agreement ID is required.',
      'any.required': 'Agreement ID is required.',
    }),
});

const createAgreementSchema = Joi.object({
  companyId: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Company ID is required.',
      'any.required': 'Company ID is required.',
    }),

  facultyId: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Faculty ID is required.',
      'any.required': 'Faculty ID is required.',
    }),

  startDate: isoDateField('Start date'),
  endDate: isoDateField('End date'),
  internshipType: Joi.string()
    .trim()
    .valid(...INTERNSHIP_TYPES)
    .optional()
    .messages({
      'string.empty': 'Internship type is required.',
      'any.only': `Internship type must be one of: ${INTERNSHIP_TYPES.join(', ')}.`,
    }),
  internshipField: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'string.empty': 'Internship field is required.',
    }),
  workingDays: Joi.when('weeklySchedule', {
    is: Joi.exist(),
    then: Joi.any().optional(),
    otherwise: Joi.array()
      .items(Joi.string().trim().valid(...WORKING_DAY_CODES))
      .min(3)
      .max(6)
      .unique()
      .optional()
      .messages({
        'array.base': 'Working days must be an array.',
        'array.min': 'Weekly working days must be between 3 and 6.',
        'array.max': 'Weekly working days must be between 3 and 6.',
        'array.unique': 'Duplicate working days are not allowed.',
        'any.only': `Working days must be one of: ${WORKING_DAY_CODES.join(', ')}.`,
      }),
    }),
  weeklySchedule: Joi.array()
    .items(
      Joi.array()
        .items(Joi.string().trim().valid(...WEEKLY_SCHEDULE_DAY_CODES))
        .min(3)
        .max(6)
        .unique()
        .required()
        .messages({
          'array.base': 'Each weekly schedule entry must be an array.',
          'array.min': 'Each week must contain between 3 and 6 working days.',
          'array.max': 'Each week must contain between 3 and 6 working days.',
          'array.unique': 'Duplicate working days are not allowed inside a week.',
          'any.only': `Weekly schedule days must be one of: ${WEEKLY_SCHEDULE_DAY_CODES.join(', ')}.`,
        })
    )
    .min(1)
    .optional()
    .messages({
      'array.base': 'Weekly schedule must be an array.',
      'array.min': 'Weekly schedule must contain at least one week.',
    }),
  weeklyWorkingDayCount: Joi.any().optional(),
  totalWorkingDays: Joi.any().optional(),
}).custom((value, helpers) => {
  const metadataValues = [
    value.internshipType,
    value.internshipField,
    value.workingDays !== undefined || value.weeklySchedule !== undefined,
  ];
  const providedMetadataCount = metadataValues.filter(
    (fieldValue) => fieldValue !== undefined && fieldValue !== false
  ).length;

  if (providedMetadataCount > 0 && providedMetadataCount < metadataValues.length) {
    return helpers.error('agreement.partialMetadata');
  }

  if (providedMetadataCount === 0) {
    return helpers.error('agreement.missingSchedule');
  }

  const startDay = toIsoDay(value.startDate);
  const endDay = toIsoDay(value.endDate);

  if (!startDay || !endDay) {
    return helpers.error('agreement.invalidDateFormat');
  }

  const minimumStartDay = addDaysToIsoDay(
    getTodayIsoDay(),
    MIN_INTERNSHIP_START_LEAD_DAYS
  );

  if (startDay < minimumStartDay) {
    return helpers.error('agreement.startTooSoon');
  }

  if (startDay > endDay) {
    return helpers.error('agreement.startAfterEnd');
  }

  const minimumEndDay = addDaysToIsoDay(startDay, MIN_INTERNSHIP_DURATION_DAYS);
  if (endDay < minimumEndDay) {
    return helpers.error('agreement.minimumDuration');
  }

  return value;
}, 'agreement create validation').messages({
  'agreement.partialMetadata':
    'Internship type, internship field, and either working days or weekly schedule must be provided together.',
  'agreement.missingSchedule':
    'Internship type, internship field, and either working days or weekly schedule are required.',
  'agreement.invalidDateFormat': 'Dates must be in valid ISO format.',
  'agreement.startTooSoon': 'Internship must start at least 15 days from today.',
  'agreement.startAfterEnd': 'Start date cannot be later than end date.',
  'agreement.minimumDuration': `End date must be at least ${MIN_INTERNSHIP_DURATION_DAYS} days after start date.`,
});

const rejectAgreementSchema = Joi.object({
  reason: Joi.string()
    .trim()
    .valid(...AGREEMENT_REJECTION_REASONS)
    .required()
    .messages({
      'string.empty': 'Rejection reason is required.',
      'any.required': 'Rejection reason is required.',
      'any.only': `Rejection reason must be one of: ${AGREEMENT_REJECTION_REASONS.join(', ')}.`,
    }),
});

module.exports = {
  agreementIdParamSchema,
  createAgreementSchema,
  rejectAgreementSchema,
};
