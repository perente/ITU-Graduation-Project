const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const env = require('../config/env');
const fabricConfig = require('../config/fabric');
const { fabricIdentityExists } = require('../services/fabricGatewayService');

const identifier = String(process.argv[2] || '').trim().toLowerCase();

if (!identifier) {
  console.error('Usage: node src/scripts/verifyApprovedCompanyIdentity.js <company-email-or-username>');
  process.exit(1);
}

const main = async () => {
  const db = await new Promise((resolve, reject) => {
    const database = new sqlite3.Database(
      env.dbPath,
      sqlite3.OPEN_READONLY,
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(database);
      }
    );
  });

  const user = await new Promise((resolve, reject) => {
    db.get(
      `
        SELECT
          email,
          username,
          role,
          entity_id,
          fabric_identity
        FROM users
        WHERE LOWER(email) = ? OR LOWER(username) = ?
        LIMIT 1
      `,
      [identifier, identifier],
      (error, row) => {
        db.close();

        if (error) {
          reject(error);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          email: row.email,
          username: row.username,
          role: row.role,
          entityId: row.entity_id,
          fabricIdentity: row.fabric_identity,
        });
      }
    );
  });

  if (!user) {
    throw new Error(`No user found for identifier ${identifier}`);
  }

  if (user.role !== 'company') {
    throw new Error(`User ${identifier} is not a company account`);
  }

  if (!user.fabricIdentity || user.fabricIdentity.startsWith('pending-')) {
    throw new Error(`Invalid fabric identity stored for ${identifier}: ${user.fabricIdentity}`);
  }

  if (user.fabricIdentity !== user.entityId) {
    throw new Error(
      `Expected fabric identity to match entity id. entityId=${user.entityId}, fabricIdentity=${user.fabricIdentity}`
    );
  }

  const identityPath = path.join(fabricConfig.identitiesBasePath, user.fabricIdentity);

  if (!fabricIdentityExists(user.fabricIdentity)) {
    throw new Error(`Fabric identity directory does not exist: ${identityPath}`);
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        email: user.email,
        username: user.username,
        role: user.role,
        entityId: user.entityId,
        fabricIdentity: user.fabricIdentity,
        identityPath,
      },
      null,
      2
    )
  );
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
