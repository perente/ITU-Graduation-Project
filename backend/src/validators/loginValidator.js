const Joi = require('joi');

const loginSchema = Joi.object({
  loginIdentifier: Joi.string()
    .trim()
    .min(1)
    .messages({
      'string.empty': 'Email or username is required.',
    }),
  email: Joi.string()
    .trim()
    .min(1)
    .messages({
      'string.empty': 'Email or username is required.',
    }),
  password: Joi.string()
    .trim()
    .min(1)
    .required()
    .messages({
      'string.empty': 'Password is required.',
      'any.required': 'Password is required.',
    }),
})
  .or('loginIdentifier', 'email')
  .messages({
    'object.missing': 'Email or username is required.',
  });

module.exports = {
  loginSchema,
};
