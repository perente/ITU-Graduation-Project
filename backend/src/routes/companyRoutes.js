const express = require('express');

const companyController = require('../controllers/companyController');
const ROLES = require('../constants/roles');
const { protect, authorize } = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequest');
const {
  companyRequestIdParamSchema,
  companyRequestRejectionSchema,
  companyRequestSchema,
  companySearchQuerySchema,
} = require('../validators/companyValidator');

const router = express.Router();

router.get(
  '/',
  protect,
  authorize(ROLES.STUDENT, ROLES.COMPANY, ROLES.FACULTY, ROLES.CENTRAL),
  validateRequest(companySearchQuerySchema, 'query'),
  companyController.getApprovedCompanies
);

router.post(
  '/requests',
  protect,
  authorize(ROLES.STUDENT),
  validateRequest(companyRequestSchema),
  companyController.submitCompanyRequest
);

router.get(
  '/requests',
  protect,
  authorize(ROLES.CENTRAL),
  companyController.getPendingCompanyRequests
);

router.get(
  '/requests/:id',
  protect,
  authorize(ROLES.CENTRAL),
  validateRequest(companyRequestIdParamSchema, 'params'),
  companyController.getCompanyRequestById
);

router.post(
  '/requests/:id/approve',
  protect,
  authorize(ROLES.CENTRAL),
  validateRequest(companyRequestIdParamSchema, 'params'),
  companyController.approveCompanyRequest
);

router.post(
  '/requests/:id/reject',
  protect,
  authorize(ROLES.CENTRAL),
  validateRequest(companyRequestIdParamSchema, 'params'),
  validateRequest(companyRequestRejectionSchema),
  companyController.rejectCompanyRequest
);

module.exports = router;
