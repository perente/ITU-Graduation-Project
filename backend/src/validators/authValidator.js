const Joi = require('joi');

const loginSchema = Joi.object({
  role: Joi.string()
    .valid('student', 'company', 'faculty', 'central', 'admin')
    .required()
    .messages({
      'any.only': 'Role must be one of student, company, faculty, central, or admin.',
      'any.required': 'Role is required.',
    }),

  id: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.empty': 'ID cannot be empty.',
      'any.required': 'ID is required.',
    }),
});

module.exports = {
  loginSchema,
};