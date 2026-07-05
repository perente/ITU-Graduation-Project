require('dotenv').config();
const path = require('path');

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'supersecretkey',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  dbPath:
    process.env.DB_PATH ||
    path.resolve(__dirname, '..', '..', 'data', 'stajchain.sqlite'),
  rejectedCompanyRequestRetentionDays: parsePositiveInteger(
    process.env.REJECTED_COMPANY_REQUEST_RETENTION_DAYS,
    15
  ),
  rejectedCompanyRequestCleanupIntervalHours: parsePositiveInteger(
    process.env.REJECTED_COMPANY_REQUEST_CLEANUP_INTERVAL_HOURS,
    24
  ),
};
