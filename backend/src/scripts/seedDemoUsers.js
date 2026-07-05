const { initDb } = require('../config/db');
const demoUsers = require('../config/demoUsers');
const {
  upsertUser,
} = require('../repositories/userRepository');
const { hashPassword } = require('../utils/password');

const seedDemoUsers = async () => {
  await initDb();

  for (const demoUser of demoUsers) {
    const passwordHash = await hashPassword(demoUser.password);

    await upsertUser({
      email: demoUser.email.toLowerCase(),
      username: demoUser.role === 'company' ? demoUser.entityId.toLowerCase() : null,
      passwordHash,
      role: demoUser.role,
      entityId: demoUser.entityId,
      fabricIdentity: demoUser.fabricIdentity,
      isActive: true,
      name: demoUser.name || null,
      surname: demoUser.surname || null,
      facultyId: demoUser.facultyId || null,
      facultyName: demoUser.facultyName || null,
      departmentCode: demoUser.departmentCode || null,
      departmentName: demoUser.departmentName || null,
      completedCredits:
        demoUser.completedCredits === undefined ? null : demoUser.completedCredits,
    });

    console.info(`AUTH SEED: synced user ${demoUser.email}`);
  }

  console.info('AUTH SEED: demo users synced successfully');
};

seedDemoUsers().catch((error) => {
  console.error(`AUTH SEED: failed to sync demo users - ${error.message}`);
  process.exit(1);
});
