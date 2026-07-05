const jwt = require('jsonwebtoken');

const env = require('../config/env');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { findUserByLoginIdentifier } = require('../repositories/userRepository');
const { fabricIdentityExists } = require('../services/fabricGatewayService');
const { comparePassword } = require('../utils/password');

const buildAuthUser = (user) => {
  return {
    email: user.email,
    role: user.role,
    entityId: user.entityId,
    fabricIdentity: user.fabricIdentity,
    name: user.name || null,
    surname: user.surname || null,
    facultyId: user.facultyId || null,
    facultyName: user.facultyName || null,
    departmentCode: user.departmentCode || null,
    departmentName: user.departmentName || null,
    completedCredits:
      user.completedCredits === null || user.completedCredits === undefined
        ? null
        : user.completedCredits,
  };
};

// Login authenticates the user from the backend database.
// The Fabric gateway then uses the authenticated user's fabricIdentity
// as the runtime identity for chain access.
exports.login = asyncHandler(async (req, res) => {
  const { loginIdentifier, email, password } = req.body;
  const normalizedIdentifier = String(loginIdentifier || email || '')
    .trim()
    .toLowerCase();

  const user = await findUserByLoginIdentifier(normalizedIdentifier);

  if (!user) {
    console.warn(`AUTH: invalid login attempt for ${normalizedIdentifier}`);
    throw new AppError('Invalid email/username or password.', 401);
  }

  if (!user.isActive) {
    console.warn(`AUTH: inactive user login blocked for ${user.email}`);
    throw new AppError('User account is inactive.', 403);
  }

  if (!user.passwordHash || !user.role || !user.entityId || !user.fabricIdentity) {
    console.error(`AUTH: user record is misconfigured for ${user.email}`);
    throw new AppError('User account is misconfigured.', 500);
  }

  const passwordMatches = await comparePassword(password, user.passwordHash);

  if (!passwordMatches) {
    console.warn(`AUTH: invalid login attempt for ${user.email}`);
    throw new AppError('Invalid email/username or password.', 401);
  }

  if (!fabricIdentityExists(user.fabricIdentity)) {
    console.warn(
      `AUTH: fabric identity not found for ${user.email} (${user.fabricIdentity})`
    );
    throw new AppError('Assigned Fabric identity is not available.', 403);
  }

  const authUser = buildAuthUser(user);
  const token = jwt.sign(authUser, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn || '1d',
  });

  console.info(`AUTH: login successful for ${user.email} (${user.role})`);

  return res.status(200).json({
    success: true,
    message: 'Login successful.',
    token,
    user: authUser,
  });
});

exports.me = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user,
  });
};
