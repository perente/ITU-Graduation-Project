#!/bin/bash

set -e

echo "=== StajChain identity setup starting ==="

TEST_NETWORK_DIR=~/fabric-samples/test-network
ORG1_DIR=${TEST_NETWORK_DIR}/organizations/peerOrganizations/org1.example.com
ORG1_CA_CERT=${TEST_NETWORK_DIR}/organizations/fabric-ca/org1/tls-cert.pem
BACKUP_DIR=~/stajchain-identities

export PATH=${TEST_NETWORK_DIR}/../bin:$PATH
export FABRIC_CFG_PATH=${TEST_NETWORK_DIR}/../config
export FABRIC_CA_CLIENT_HOME=${ORG1_DIR}

cd ${TEST_NETWORK_DIR}

echo "=== Checking CA cert ==="
if [ ! -f "${ORG1_CA_CERT}" ]; then
  echo "ERROR: CA cert not found at ${ORG1_CA_CERT}"
  echo "Make sure the network is up with: ./network.sh up createChannel -c mychannel -ca"
  exit 1
fi

echo "=== Enrolling CA admin ==="
fabric-ca-client enroll \
  -u https://admin:adminpw@localhost:7054 \
  --caname ca-org1 \
  --tls.certfiles ${ORG1_CA_CERT}

register_identity() {
  NAME=$1
  SECRET=$2
  ROLE=$3
  ENTITY_ID=$4

  echo "=== Registering ${NAME} (${ROLE}, ${ENTITY_ID}) ==="
  if fabric-ca-client register \
    --caname ca-org1 \
    --id.name ${NAME} \
    --id.secret ${SECRET} \
    --id.type client \
    --id.attrs "role=${ROLE}:ecert,id=${ENTITY_ID}:ecert" \
    --tls.certfiles ${ORG1_CA_CERT}; then
    echo "Registered ${NAME} successfully"
  else
    echo "Register may have failed because ${NAME} already exists. Continuing..."
  fi
}

enroll_identity() {
  NAME=$1
  SECRET=$2
  MSP_DIR=$3

  echo "=== Enrolling ${NAME} into ${MSP_DIR} ==="
  rm -rf ${MSP_DIR}

  fabric-ca-client enroll \
    -u https://${NAME}:${SECRET}@localhost:7054 \
    --caname ca-org1 \
    -M ${MSP_DIR} \
    --tls.certfiles ${ORG1_CA_CERT}

  cp ${ORG1_DIR}/msp/config.yaml ${MSP_DIR}/config.yaml
}

backup_identity() {
  NAME=$1
  SRC_DIR=$2
  DEST_DIR=${BACKUP_DIR}/${NAME}

  echo "=== Backing up ${NAME} to ${DEST_DIR} ==="
  rm -rf ${DEST_DIR}
  mkdir -p ${DEST_DIR}
  cp -r ${SRC_DIR}/* ${DEST_DIR}/
}

# Register users
register_identity student123 student123pw student student123
register_identity studentWorkflow123 studentWorkflow123pw student studentWorkflow123
register_identity studentPhase2123 studentPhase2123pw student studentPhase2123
register_identity studentRules123 studentRules123pw student studentRules123
register_identity studentRulesOverlap123 studentRulesOverlap123pw student studentRulesOverlap123
register_identity companyB companyBpw company companyB
register_identity BBF BBFpw faculty BBF
register_identity centralunit centralunitpw central CENTRAL_UNIT

# Enroll users into org1 users path
enroll_identity student123 student123pw ${ORG1_DIR}/users/student123@org1.example.com/msp
enroll_identity studentWorkflow123 studentWorkflow123pw ${ORG1_DIR}/users/studentWorkflow123@org1.example.com/msp
enroll_identity studentPhase2123 studentPhase2123pw ${ORG1_DIR}/users/studentPhase2123@org1.example.com/msp
enroll_identity studentRules123 studentRules123pw ${ORG1_DIR}/users/studentRules123@org1.example.com/msp
enroll_identity studentRulesOverlap123 studentRulesOverlap123pw ${ORG1_DIR}/users/studentRulesOverlap123@org1.example.com/msp
enroll_identity companyB companyBpw ${ORG1_DIR}/users/companyB@org1.example.com/msp
enroll_identity BBF BBFpw ${ORG1_DIR}/users/BBF@org1.example.com/msp
enroll_identity centralunit centralunitpw ${ORG1_DIR}/users/centralunit@org1.example.com/msp

# Backup to stable directory
backup_identity student123 ${ORG1_DIR}/users/student123@org1.example.com/msp
backup_identity studentWorkflow123 ${ORG1_DIR}/users/studentWorkflow123@org1.example.com/msp
backup_identity studentPhase2123 ${ORG1_DIR}/users/studentPhase2123@org1.example.com/msp
backup_identity studentRules123 ${ORG1_DIR}/users/studentRules123@org1.example.com/msp
backup_identity studentRulesOverlap123 ${ORG1_DIR}/users/studentRulesOverlap123@org1.example.com/msp
backup_identity companyB ${ORG1_DIR}/users/companyB@org1.example.com/msp
backup_identity BBF ${ORG1_DIR}/users/BBF@org1.example.com/msp
backup_identity centralunit ${ORG1_DIR}/users/centralunit@org1.example.com/msp

echo "=== Identity setup complete ==="
echo "Backups are stored in: ${BACKUP_DIR}"
