const app = require('./app');
const env = require('./config/env');
const { initDb } = require('./config/db');
const {
  startRejectedCompanyRequestCleanup,
} = require('./services/companyRequestRetentionService');

const startServer = async () => {
  await initDb();
  await startRejectedCompanyRequestCleanup();

  app.listen(env.port, (error) => {
    if (error) {
      console.error(`Failed to start server: ${error.message}`);
      process.exit(1);
    }

    console.log(`Server is running on port ${env.port}`);
  });
};

startServer().catch((error) => {
  console.error(`Failed to start server: ${error.message}`);
  process.exit(1);
});
