# Chaincode

This directory contains the Hyperledger Fabric smart contract that implements the StajChain internship agreement workflow.

## Contents

- `index.js`: the chaincode implementation
- `package.json`: the Fabric chaincode package definition

## Deployment

The chaincode is versioned inside this repository, but it must be deployed to the Fabric test network before the backend can invoke it.

Default runtime names:

- channel: `mychannel`
- chaincode: `internship`

Whenever the contract logic changes, redeploy the chaincode to the network.
