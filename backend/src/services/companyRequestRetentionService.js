const env = require('../config/env');
const { deleteRejectedCompanyRequestsUpdatedBefore } = require('../repositories/companyRequestRepository');

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

const getRetentionCutoffIso = (retentionDays) => {
  return new Date(Date.now() - retentionDays * MILLISECONDS_PER_DAY).toISOString();
};

const cleanupRejectedCompanyRequests = async () => {
  const cutoffIso = getRetentionCutoffIso(
    env.rejectedCompanyRequestRetentionDays
  );

  const result = await deleteRejectedCompanyRequestsUpdatedBefore(cutoffIso);
  return result.changes;
};

const startRejectedCompanyRequestCleanup = async () => {
  const runCleanup = async () => {
    try {
      const deletedCount = await cleanupRejectedCompanyRequests();

      if (deletedCount > 0) {
        console.log(
          `Deleted ${deletedCount} rejected company request(s) older than ${env.rejectedCompanyRequestRetentionDays} day(s).`
        );
      }
    } catch (error) {
      console.error(
        `Rejected company request cleanup failed: ${error.message}`
      );
    }
  };

  await runCleanup();

  const intervalMilliseconds =
    env.rejectedCompanyRequestCleanupIntervalHours * MILLISECONDS_PER_HOUR;
  const intervalHandle = setInterval(runCleanup, intervalMilliseconds);

  intervalHandle.unref();

  return intervalHandle;
};

module.exports = {
  cleanupRejectedCompanyRequests,
  startRejectedCompanyRequestCleanup,
};
