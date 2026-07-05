const express = require('express');
const agreementController = require('../controllers/agreementController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequest');
const ROLES = require('../constants/roles');
const {
  agreementIdParamSchema,
  createAgreementSchema,
  rejectAgreementSchema,
} = require('../validators/agreementValidator');

const router = express.Router();

router.get(
  '/my',
  protect,
  authorize(ROLES.STUDENT, ROLES.COMPANY, ROLES.FACULTY, ROLES.CENTRAL),
  agreementController.getMyAgreements
);
router.get(
  '/pending',
  protect,
  authorize(ROLES.STUDENT, ROLES.COMPANY, ROLES.FACULTY, ROLES.CENTRAL),
  agreementController.getPendingAgreements
);
router.get(
  '/:id',
  protect,
  authorize(ROLES.STUDENT, ROLES.COMPANY, ROLES.FACULTY, ROLES.CENTRAL),
  validateRequest(agreementIdParamSchema, 'params'),
  agreementController.getAgreementById
);
router.get(
  '/:id/history',
  protect,
  authorize(ROLES.STUDENT, ROLES.COMPANY, ROLES.FACULTY, ROLES.CENTRAL),
  validateRequest(agreementIdParamSchema, 'params'),
  agreementController.getAgreementHistory
);

router.post(
  '/',
  protect,
  authorize(ROLES.STUDENT),
  validateRequest(createAgreementSchema),
  agreementController.createAgreement
);
router.post(
  '/:id/approve',
  protect,
  authorize(ROLES.STUDENT, ROLES.COMPANY, ROLES.FACULTY),
  validateRequest(agreementIdParamSchema, 'params'),
  agreementController.approveAgreement
);
router.post(
  '/:id/activate',
  protect,
  authorize(ROLES.CENTRAL),
  validateRequest(agreementIdParamSchema, 'params'),
  agreementController.activateAgreement
);
router.post(
  '/:id/reject',
  protect,
  authorize(ROLES.STUDENT, ROLES.COMPANY, ROLES.FACULTY),
  validateRequest(agreementIdParamSchema, 'params'),
  validateRequest(rejectAgreementSchema),
  agreementController.rejectAgreement
);
router.post(
  '/:id/complete',
  protect,
  authorize(ROLES.CENTRAL),
  validateRequest(agreementIdParamSchema, 'params'),
  agreementController.completeAgreement
);

module.exports = router;
