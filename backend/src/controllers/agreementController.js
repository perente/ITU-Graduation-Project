const agreementService = require('../services/agreementService');
const asyncHandler = require('../utils/asyncHandler');

exports.getMyAgreements = asyncHandler(async (req, res) => {
  const data = await agreementService.getMyAgreements(req.user);

  return res.status(200).json({
    success: true,
    data,
  });
});

exports.getAgreementById = asyncHandler(async (req, res) => {
  const data = await agreementService.getAgreementById(req.user, req.params.id);

  return res.status(200).json({
    success: true,
    data,
  });
});

exports.getAgreementHistory = asyncHandler(async (req, res) => {
  const data = await agreementService.getAgreementHistory(
    req.user,
    req.params.id
  );

  return res.status(200).json({
    success: true,
    data,
  });
});

exports.getPendingAgreements = asyncHandler(async (req, res) => {
  const data = await agreementService.getPendingAgreements(req.user);

  return res.status(200).json({
    success: true,
    data,
  });
});

exports.createAgreement = asyncHandler(async (req, res) => {
  const data = await agreementService.createAgreement(req.user, req.body);

  return res.status(201).json({
    success: true,
    data,
  });
});

exports.approveAgreement = asyncHandler(async (req, res) => {
  const data = await agreementService.approveAgreement(req.user, req.params.id);

  return res.status(200).json({
    success: true,
    data,
  });
});

exports.activateAgreement = asyncHandler(async (req, res) => {
  const data = await agreementService.activateAgreement(req.user, req.params.id);

  return res.status(200).json({
    success: true,
    data,
  });
});

exports.rejectAgreement = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const data = await agreementService.rejectAgreement(req.user, req.params.id, reason);

  return res.status(200).json({
    success: true,
    data,
  });
});

exports.completeAgreement = asyncHandler(async (req, res) => {
  const data = await agreementService.completeAgreement(req.user, req.params.id);

  return res.status(200).json({
    success: true,
    data,
  });
});
