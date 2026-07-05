const Joi = require('joi');

const trimmedRequiredString = (label) =>
  Joi.string()
    .trim()
    .min(1)
    .required()
    .messages({
      'string.empty': `${label} is required.`,
      'any.required': `${label} is required.`,
    });

const companyRequestIdParamSchema = Joi.object({
  id: Joi.number().integer().positive().required().messages({
    'number.base': 'Company request ID must be a number.',
    'any.required': 'Company request ID is required.',
  }),
});

const companySearchQuerySchema = Joi.object({
  q: Joi.string().trim().allow('').optional(),
});

const companyRequestSchema = Joi.object({
  companyName: trimmedRequiredString('Company name'),
  companyAddress: trimmedRequiredString('Company address'),
  companyPhoneNumber: trimmedRequiredString('Company phone number'),
  companyFaxNumber: trimmedRequiredString('Company fax number'),
  companyEmail: Joi.string().trim().email().required().messages({
    'string.empty': 'Company email is required.',
    'string.email': 'Company email must be valid.',
    'any.required': 'Company email is required.',
  }),
  isPublicInstitution: Joi.boolean().required().messages({
    'any.required': 'Public institution flag is required.',
  }),
  companyTitle: trimmedRequiredString('Company title'),
  companyIban: trimmedRequiredString('Company IBAN'),
  companyBankName: trimmedRequiredString('Company bank name'),
  companyBankBranchCode: trimmedRequiredString('Company bank branch code'),
  companyBankBranchName: trimmedRequiredString('Company bank branch name'),
  companyRegistrationNumber: Joi.string().trim().allow('', null).optional(),
  companyTaxIdentificationNumber: Joi.string().trim().allow('', null).optional(),
})
  .custom((value, helpers) => {
    const hasRegistrationNumber = Boolean(
      String(value.companyRegistrationNumber || '').trim()
    );
    const hasTaxNumber = Boolean(
      String(value.companyTaxIdentificationNumber || '').trim()
    );

    if (!hasRegistrationNumber && !hasTaxNumber) {
      return helpers.error('company.identifierRequired');
    }

    if (!hasRegistrationNumber) {
      value.companyRegistrationNumber = null;
    }

    if (!hasTaxNumber) {
      value.companyTaxIdentificationNumber = null;
    }

    return value;
  }, 'company request validation')
  .messages({
    'company.identifierRequired':
      'At least one of company registration number or company tax identification number is required.',
  });

const companyRequestRejectionSchema = Joi.object({
  rejectionReason: Joi.string().trim().min(1).required().messages({
    'string.empty': 'Rejection reason is required.',
    'any.required': 'Rejection reason is required.',
  }),
});

module.exports = {
  companyRequestIdParamSchema,
  companyRequestRejectionSchema,
  companyRequestSchema,
  companySearchQuerySchema,
};
