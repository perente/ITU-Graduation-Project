const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const fabricConfig = require('../config/fabric');
const AppError = require('../utils/AppError');
const { fabricIdentityExists } = require('./fabricGatewayService');

const execFileAsync = promisify(execFile);

const getOrgUserMspPath = (fabricIdentity) => {
  return path.join(
    fabricConfig.org1BasePath,
    'users',
    `${fabricIdentity}@${fabricConfig.orgUserDomain}`,
    'msp'
  );
};

const cleanupProvisionedIdentity = async (fabricIdentity) => {
  if (!fabricIdentity) {
    return;
  }

  const identityPath = path.join(fabricConfig.identitiesBasePath, fabricIdentity);
  const orgUserMspPath = getOrgUserMspPath(fabricIdentity);

  await Promise.allSettled([
    fs.promises.rm(identityPath, { recursive: true, force: true }),
    fs.promises.rm(orgUserMspPath, { recursive: true, force: true }),
  ]);
};

const provisionCompanyIdentity = async ({ companyId }) => {
  const fabricIdentity = String(companyId || '').trim();

  if (!fabricIdentity) {
    throw new AppError('Company Fabric identity could not be provisioned.', 500);
  }

  if (fabricIdentityExists(fabricIdentity)) {
    throw new AppError(
      `Company Fabric identity ${fabricIdentity} already exists.`,
      409
    );
  }

  const enrollmentSecret = crypto.randomBytes(18).toString('base64url');
  const scriptPath = path.join(__dirname, '..', 'scripts', 'provisionCompanyIdentity.sh');

  try {
    await execFileAsync('bash', [scriptPath, fabricIdentity, enrollmentSecret, 'company', companyId], {
      env: {
        ...process.env,
        FABRIC_TEST_NETWORK_DIR: fabricConfig.testNetworkDir,
        FABRIC_ORG1_PATH: fabricConfig.org1BasePath,
        FABRIC_ORG_USER_DOMAIN: fabricConfig.orgUserDomain,
        FABRIC_IDENTITIES_ROOT: fabricConfig.identitiesBasePath,
        FABRIC_CA_CERT_PATH: fabricConfig.caCertPath,
        FABRIC_CA_URL: fabricConfig.caUrl,
        FABRIC_CA_NAME: fabricConfig.caName,
        FABRIC_CA_ADMIN_ID: fabricConfig.caAdminId,
        FABRIC_CA_ADMIN_SECRET: fabricConfig.caAdminSecret,
      },
    });
  } catch (error) {
    const stderr = String(error.stderr || '').trim();
    const stdout = String(error.stdout || '').trim();
    const details = stderr || stdout || error.message;

    throw new AppError(
      `Company Fabric identity could not be provisioned. ${details}`.trim(),
      502
    );
  }

  if (!fabricIdentityExists(fabricIdentity)) {
    throw new AppError(
      'Company Fabric identity could not be provisioned.',
      502
    );
  }

  return {
    fabricIdentity,
    identityPath: path.join(fabricConfig.identitiesBasePath, fabricIdentity),
    orgUserMspPath: getOrgUserMspPath(fabricIdentity),
  };
};

module.exports = {
  cleanupProvisionedIdentity,
  provisionCompanyIdentity,
};
