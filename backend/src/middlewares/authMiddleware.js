const jwt = require('jsonwebtoken');
const env = require('../config/env');

exports.protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authorization token is required.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.jwtSecret);

    req.user = {
      email: decoded.email,
      role: decoded.role,
      entityId: decoded.entityId,
      fabricIdentity: decoded.fabricIdentity,
      name: decoded.name || null,
      surname: decoded.surname || null,
      facultyId: decoded.facultyId || null,
      facultyName: decoded.facultyName || null,
      departmentCode: decoded.departmentCode || null,
      departmentName: decoded.departmentName || null,
      completedCredits:
        decoded.completedCredits === null || decoded.completedCredits === undefined
          ? null
          : decoded.completedCredits,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.',
    });
  }
};

exports.authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to perform this action.',
      });
    }

    next();
  };
};
