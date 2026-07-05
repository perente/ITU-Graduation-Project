#!/bin/bash

set -euo pipefail

NAME=${1:?identity name is required}
SECRET=${2:?identity secret is required}
ROLE=${3:?role is required}
ENTITY_ID=${4:?entity id is required}

TEST_NETWORK_DIR=${FABRIC_TEST_NETWORK_DIR:-/home/rabia/fabric-samples/test-network}
ORG1_DIR=${FABRIC_ORG1_PATH:-${TEST_NETWORK_DIR}/organizations/peerOrganizations/org1.example.com}
ORG_USER_DOMAIN=${FABRIC_ORG_USER_DOMAIN:-org1.example.com}
CA_CERT=${FABRIC_CA_CERT_PATH:-${TEST_NETWORK_DIR}/organizations/fabric-ca/org1/tls-cert.pem}
CA_URL=${FABRIC_CA_URL:-https://localhost:7054}
CA_NAME=${FABRIC_CA_NAME:-ca-org1}
CA_ADMIN_ID=${FABRIC_CA_ADMIN_ID:-admin}
CA_ADMIN_SECRET=${FABRIC_CA_ADMIN_SECRET:-adminpw}
BACKUP_DIR=${FABRIC_IDENTITIES_ROOT:-${HOME}/stajchain-identities}

export PATH=${TEST_NETWORK_DIR}/../bin:${PATH}
export FABRIC_CFG_PATH=${FABRIC_CFG_PATH:-${TEST_NETWORK_DIR}/../config}
export FABRIC_CA_CLIENT_HOME=${FABRIC_CA_CLIENT_HOME:-${ORG1_DIR}}

USER_MSP_DIR=${ORG1_DIR}/users/${NAME}@${ORG_USER_DOMAIN}/msp
DEST_DIR=${BACKUP_DIR}/${NAME}

cleanup() {
  rm -rf "${USER_MSP_DIR}" "${DEST_DIR}"
}

trap cleanup ERR

if ! command -v fabric-ca-client >/dev/null 2>&1; then
  echo "fabric-ca-client command is not available" >&2
  exit 1
fi

if [ ! -f "${CA_CERT}" ]; then
  echo "Fabric CA cert not found at ${CA_CERT}" >&2
  exit 1
fi

if [ -e "${DEST_DIR}" ] || [ -e "${USER_MSP_DIR}" ]; then
  echo "Fabric identity ${NAME} already exists locally" >&2
  exit 1
fi

fabric-ca-client enroll \
  -u "https://${CA_ADMIN_ID}:${CA_ADMIN_SECRET}@${CA_URL#https://}" \
  --caname "${CA_NAME}" \
  --tls.certfiles "${CA_CERT}" >/dev/null

fabric-ca-client register \
  --caname "${CA_NAME}" \
  --id.name "${NAME}" \
  --id.secret "${SECRET}" \
  --id.type client \
  --id.attrs "role=${ROLE}:ecert,id=${ENTITY_ID}:ecert" \
  --tls.certfiles "${CA_CERT}" >/dev/null

fabric-ca-client enroll \
  -u "https://${NAME}:${SECRET}@${CA_URL#https://}" \
  --caname "${CA_NAME}" \
  -M "${USER_MSP_DIR}" \
  --tls.certfiles "${CA_CERT}" >/dev/null

cp "${ORG1_DIR}/msp/config.yaml" "${USER_MSP_DIR}/config.yaml"

mkdir -p "${DEST_DIR}"
cp -r "${USER_MSP_DIR}/." "${DEST_DIR}/"

echo "${DEST_DIR}"
