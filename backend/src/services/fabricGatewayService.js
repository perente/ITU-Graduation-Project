const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const grpc = require('@grpc/grpc-js');
const { connect, signers } = require('@hyperledger/fabric-gateway');

const fabricConfig = require('../config/fabric');

const getIdentityPath = (fabricIdentity) => {
  return path.join(fabricConfig.identitiesBasePath, fabricIdentity);
};

const fabricIdentityExists = (fabricIdentity) => {
  if (!fabricIdentity) {
    return false;
  }

  return fs.existsSync(getIdentityPath(fabricIdentity));
};

const assertPathExists = (targetPath, message) => {
  if (!fs.existsSync(targetPath)) {
    throw new Error(message || `Path does not exist: ${targetPath}`);
  }
};

const getCert = (identityPath) => {
  const certPath = path.join(identityPath, 'signcerts', 'cert.pem');
  assertPathExists(
    certPath,
    `Fabric certificate not found for identity at ${certPath}`
  );
  return fs.readFileSync(certPath);
};

const getPrivateKey = (identityPath) => {
  const keyDir = path.join(identityPath, 'keystore');
  assertPathExists(
    keyDir,
    `Fabric keystore directory not found for identity at ${keyDir}`
  );

  const files = fs.readdirSync(keyDir);

  if (!files.length) {
    throw new Error(`No private key found in ${keyDir}`);
  }

  const keyPath = path.join(keyDir, files[0]);
  const keyPem = fs.readFileSync(keyPath, 'utf8');

  return crypto.createPrivateKey(keyPem);
};

const newGrpcConnection = () => {
  assertPathExists(
    fabricConfig.tlsCertPath,
    `TLS cert not found at ${fabricConfig.tlsCertPath}`
  );

  const tlsRootCert = fs.readFileSync(fabricConfig.tlsCertPath);
  const credentials = grpc.credentials.createSsl(tlsRootCert);

  return new grpc.Client(fabricConfig.peerEndpoint, credentials, {
    'grpc.ssl_target_name_override': fabricConfig.peerHostAlias,
  });
};

const getContractForIdentity = async (fabricIdentity) => {
  const identityPath = getIdentityPath(fabricIdentity);

  assertPathExists(
    identityPath,
    `Fabric identity folder not found: ${identityPath}`
  );

  const cert = getCert(identityPath);
  const privateKey = getPrivateKey(identityPath);
  const client = newGrpcConnection();

  const gateway = connect({
    client,
    identity: {
      mspId: fabricConfig.mspId,
      credentials: cert,
    },
    signer: signers.newPrivateKeySigner(privateKey),
  });

  const network = gateway.getNetwork(fabricConfig.channelName);
  const contract = network.getContract(fabricConfig.chaincodeName);

  return { contract, gateway, client };
};

module.exports = {
  fabricIdentityExists,
  getContractForIdentity,
};
