# StajChain

StajChain is a Hyperledger Fabric-based internship agreement management system designed for multi-party institutional workflows. The application consists of a React frontend, a Node.js/Express backend, and a Fabric chaincode layer that enforces the agreement lifecycle.

## Overview

Internship processes at universities typically involve multiple stakeholders, including students, companies, faculty internship committees, and central internship units. Although some parts of these workflows are already digital, critical steps such as approvals and document verification are still often handled through paper-based or semi-manual procedures.

This creates several operational challenges, including delays, limited transparency, difficulty verifying the authenticity of approvals, and a heavy reliance on centralized administrative control. When an internship agreement must pass through multiple approval stages, maintaining data integrity and tracking the process becomes increasingly difficult.

StajChain addresses these issues with a permissioned blockchain-based system that manages internship agreements as digital assets throughout their full lifecycle. Each agreement is stored on-chain and progresses through clearly defined states from creation to completion. Smart contracts enforce approval rules and permanently record state transitions, enabling agreements to be verified without manual document checks.

Hyperledger Fabric is used as the blockchain platform because it provides permissioned network support, role-based access control, and a strong fit for institutional workflows. The system is designed to support multiple students, companies, and faculty units under university governance while providing secure, traceable, and controlled multi-party approval for internship agreements.

## Project Report

A detailed explanation of the system architecture, implementation choices, and evaluation results is provided in `GraduationProject_FinalReport.pdf`.

## Quick Start

1. Install dependencies in `backend/`, `frontend/`, and `chaincode/`.
2. Copy `backend/.env.example` to `backend/.env` and review the Fabric paths.
3. From `fabric-samples/`, run `./install-fabric.sh samples binary docker`.
4. From `fabric-samples/test-network/`, run `./network.sh up createChannel -c mychannel -ca`.
5. From `scripts/`, run `bash registerEnrollUsers.sh` to create the demo identities.
6. From `backend/`, run `npm run dev`.
7. From `frontend/`, run `npm run dev`.

## Repository Layout

```text
github/
  backend/
  chaincode/
  frontend/
  scripts/
```

This repository expects two external sibling directories at runtime:

```text
StajChain-Workspace/
  github/
  fabric-samples/
  stajchain-identities/
```

`fabric-samples` contains the Hyperledger Fabric test network and connection artifacts used by the backend. `stajchain-identities` stores the enrolled Fabric identities generated from Fabric CA. These directories are used locally and are not committed to Git.

In this context, a "sibling directory" means a folder that lives next to `github/` under the same parent workspace directory.

## What Is Included

- `backend/`: Express API, database logic, business rules, and Fabric gateway integration
- `frontend/`: React user interface for students, companies, faculty users, and the central internship unit
- `chaincode/`: Fabric chaincode source for the internship agreement workflow
- `scripts/`: User enrollment and environment bootstrap scripts

## What Is Not Committed

- `fabric-samples/`
- `stajchain-identities/`
- `node_modules/`
- `dist/`
- `data/`
- `wallet/`
- `.env`
- log files
- `*.Zone.Identifier` files

## Requirements

- Node.js 18 or newer
- npm 8 or newer
- Docker
- Hyperledger Fabric test network
- Fabric CA client tools
- Bash

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install

cd ../frontend
npm install

cd ../chaincode
npm install
```

### 2. Configure the Backend

```bash
cd backend
cp .env.example .env
```

The default `.env` file assumes the repository sits next to `fabric-samples/` and `stajchain-identities/`. Adjust the `FABRIC_*` variables if your local paths differ.

### 3. Start the Fabric Test Network

If the network is not already running, set up the Fabric samples and start the test network first.

#### 3.1 Install Fabric Samples, Binaries, and Docker Images

From the `fabric-samples/` directory, run the Fabric bootstrap script to install the sample repository, peer binaries, Fabric CA binaries, and Docker images:

```bash
cd ../fabric-samples
./install-fabric.sh samples binary docker
```

If you already have the samples repository and binaries installed, you can skip this step.

#### 3.2 Bring Up the Test Network

```bash
cd ../fabric-samples/test-network
./network.sh up createChannel -c mychannel -ca
```

The backend expects the following defaults unless overridden in `.env`:

- channel: `mychannel`
- chaincode: `internship`
- MSP ID: `Org1MSP`

#### 3.3 Verify the Required Artifacts

Make sure the following paths exist before starting the backend:

- `fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json`
- `fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt`
- `fabric-samples/test-network/organizations/fabric-ca/org1/tls-cert.pem`

### 4. Enroll Demo Identities

Run the enrollment script so the backend can authenticate against Fabric using the demo identities:

```bash
cd ../scripts
bash registerEnrollUsers.sh
```

This script creates the identity backups under `stajchain-identities/`.

## Running the Application

### Backend

```bash
cd backend
npm run seed:users
npm run dev
```

- The backend listens on `http://localhost:3000` by default.
- SQLite is created automatically on startup.
- `seed:users` inserts the demo accounts used by the UI and workflow tests.

### Frontend

```bash
cd frontend
npm run dev
```

- The frontend runs on `http://localhost:4173` by default.
- API requests are sent to `http://localhost:3000/api`.

## Chaincode

The `chaincode/` directory contains the Fabric contract source for the internship agreement workflow. The chaincode is part of this repository, but it must still be deployed to the Fabric network before the backend can use it.

Key names:

- chaincode name: `internship`
- channel: `mychannel`
- main lifecycle functions: `CreateAgreement`, `ApproveByStudent`, `ApproveByCompany`, `ApproveByFaculty`, `ActivateAgreement`, `CompleteAgreement`

If you change the contract logic, redeploy the chaincode to the Fabric network.

## Available Scripts

Backend scripts:

```bash
npm run test:workflow
npm run test:workflow:phase2
npm run test:rules
npm run perf:read
npm run perf:ledger
npm run perf:company
```

These scripts require a running Fabric network and enrolled identities.

## Migration Checklist

Use this checklist when moving the project into GitHub:

### Commit To GitHub

- `github/backend/src/**`
- `github/backend/package.json`
- `github/backend/package-lock.json`
- `github/backend/.env.example`
- `github/backend/.gitignore`
- `github/frontend/src/**`
- `github/frontend/index.html`
- `github/frontend/vite.config.js`
- `github/frontend/package.json`
- `github/frontend/package-lock.json`
- `github/chaincode/index.js`
- `github/chaincode/package.json`
- `github/chaincode/README.md`
- `github/scripts/registerEnrollUsers.sh`
- `github/README.md`
- `github/.gitignore`

### Keep Local Only

- `fabric-samples/`
- `stajchain-identities/`
- `backend/.env`
- generated SQLite files
- `node_modules/`
- `dist/`
- logs
- `Zone.Identifier` files

### Optional But Recommended

- Add a top-level `docs/` folder for screenshots and architecture diagrams
- Add a root-level `.env.example` if you want to centralize environment docs
- Add deployment notes for Docker and Fabric network setup

## Notes

- The backend is configured to read Fabric paths from environment variables.
- Demo users must stay aligned with the enrolled Fabric identities.
- `fabric-samples` should remain an external dependency, not a copied project folder.
