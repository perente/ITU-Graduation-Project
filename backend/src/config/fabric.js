const path = require('path');

const org1BasePath = path.resolve(
  process.env.FABRIC_ORG1_PATH ||
    path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'fabric-samples',
      'test-network',
      'organizations',
      'peerOrganizations',
      'org1.example.com'
    )
);

const fabricConfig = {
  channelName: process.env.FABRIC_CHANNEL || 'mychannel',
  chaincodeName: process.env.FABRIC_CHAINCODE || 'internship',
  mspId: process.env.FABRIC_MSP_ID || 'Org1MSP',
  testNetworkDir:
    process.env.FABRIC_TEST_NETWORK_DIR ||
    path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'fabric-samples',
      'test-network'
    ),

  org1BasePath,
  orgUserDomain: process.env.FABRIC_ORG_USER_DOMAIN || 'org1.example.com',

  connectionProfilePath: path.join(org1BasePath, 'connection-org1.json'),

  identitiesBasePath:
    process.env.FABRIC_IDENTITIES_ROOT ||
    path.resolve(__dirname, '..', '..', '..', '..', 'stajchain-identities'),

  caCertPath:
    process.env.FABRIC_CA_CERT_PATH ||
    path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'fabric-samples',
      'test-network',
      'organizations',
      'fabric-ca',
      'org1',
      'tls-cert.pem'
    ),
  caUrl: process.env.FABRIC_CA_URL || 'https://localhost:7054',
  caName: process.env.FABRIC_CA_NAME || 'ca-org1',
  caAdminId: process.env.FABRIC_CA_ADMIN_ID || 'admin',
  caAdminSecret: process.env.FABRIC_CA_ADMIN_SECRET || 'adminpw',

  tlsCertPath:
    process.env.FABRIC_TLS_CERT_PATH ||
    path.join(
      org1BasePath,
      'peers',
      'peer0.org1.example.com',
      'tls',
      'ca.crt'
    ),

  peerEndpoint: process.env.FABRIC_PEER_ENDPOINT || 'localhost:7051',
  peerHostAlias:
    process.env.FABRIC_PEER_HOST_ALIAS || 'peer0.org1.example.com',
};

module.exports = fabricConfig;
