const asyncHandler = require('../utils/asyncHandler');
const companyService = require('../services/companyService');

exports.getApprovedCompanies = asyncHandler(async (req, res) => {
  const data = await companyService.getApprovedCompanies(req.user, req.query);

  return res.status(200).json({
    success: true,
    data,
  });
});

exports.submitCompanyRequest = asyncHandler(async (req, res) => {
  const data = await companyService.submitCompanyRequest(req.user, req.body);

  return res.status(201).json({
    success: true,
    data,
  });
});

exports.getPendingCompanyRequests = asyncHandler(async (req, res) => {
  const data = await companyService.getPendingCompanyRequests(req.user);

  return res.status(200).json({
    success: true,
    data,
  });
});

exports.getCompanyRequestById = asyncHandler(async (req, res) => {
  const data = await companyService.getCompanyRequestById(req.user, req.params.id);

  return res.status(200).json({
    success: true,
    data,
  });
});

exports.approveCompanyRequest = asyncHandler(async (req, res) => {
  const data = await companyService.approveCompanyRequest(req.user, req.params.id);

  return res.status(200).json({
    success: true,
    data,
  });
});

exports.rejectCompanyRequest = asyncHandler(async (req, res) => {
  const data = await companyService.rejectCompanyRequest(
    req.user,
    req.params.id,
    req.body.rejectionReason
  );

  return res.status(200).json({
    success: true,
    data,
  });
});
