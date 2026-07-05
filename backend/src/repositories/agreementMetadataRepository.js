const { all, get, run } = require('../config/db');

const mapAgreementMetadata = (row) => {
  if (!row) {
    return null;
  }

  let workingDays = [];
  let weeklySchedule = null;

  try {
    workingDays = JSON.parse(row.working_days);
  } catch (error) {
    workingDays = [];
  }

  if (row.weekly_schedule) {
    try {
      weeklySchedule = JSON.parse(row.weekly_schedule);
    } catch (error) {
      weeklySchedule = null;
    }
  }

  return {
    agreementId: row.agreement_id,
    internshipType: row.internship_type,
    internshipField: row.internship_field,
    workingDays,
    weeklySchedule,
    weeklyWorkingDayCount: Number(row.weekly_working_day_count),
    totalWorkingDays: Number(row.total_working_days),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const findAgreementMetadataByAgreementId = async (agreementId) => {
  const row = await get(
    `
      SELECT
        agreement_id,
        internship_type,
        internship_field,
        working_days,
        weekly_schedule,
        weekly_working_day_count,
        total_working_days,
        created_at,
        updated_at
      FROM agreement_metadata
      WHERE agreement_id = ?
      LIMIT 1
    `,
    [String(agreementId || '').trim()]
  );

  return mapAgreementMetadata(row);
};

const findAgreementMetadataByAgreementIds = async (agreementIds = []) => {
  const normalizedAgreementIds = [...new Set(
    agreementIds
      .map((agreementId) => String(agreementId || '').trim())
      .filter(Boolean)
  )];

  if (!normalizedAgreementIds.length) {
    return new Map();
  }

  const placeholders = normalizedAgreementIds.map(() => '?').join(', ');
  const rows = await all(
    `
      SELECT
        agreement_id,
        internship_type,
        internship_field,
        working_days,
        weekly_schedule,
        weekly_working_day_count,
        total_working_days,
        created_at,
        updated_at
      FROM agreement_metadata
      WHERE agreement_id IN (${placeholders})
    `,
    normalizedAgreementIds
  );

  return new Map(
    rows
      .map(mapAgreementMetadata)
      .filter(Boolean)
      .map((metadata) => [metadata.agreementId, metadata])
  );
};

const upsertAgreementMetadata = async ({
  agreementId,
  internshipType,
  internshipField,
  workingDays,
  weeklySchedule = null,
  weeklyWorkingDayCount,
  totalWorkingDays,
}) => {
  const timestamp = new Date().toISOString();

  await run(
    `
      INSERT INTO agreement_metadata (
        agreement_id,
        internship_type,
        internship_field,
        working_days,
        weekly_schedule,
        weekly_working_day_count,
        total_working_days,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(agreement_id) DO UPDATE SET
        internship_type = excluded.internship_type,
        internship_field = excluded.internship_field,
        working_days = excluded.working_days,
        weekly_schedule = excluded.weekly_schedule,
        weekly_working_day_count = excluded.weekly_working_day_count,
        total_working_days = excluded.total_working_days,
        updated_at = excluded.updated_at
    `,
    [
      String(agreementId || '').trim(),
      internshipType,
      internshipField,
      JSON.stringify(workingDays || []),
      weeklySchedule ? JSON.stringify(weeklySchedule) : null,
      weeklyWorkingDayCount,
      totalWorkingDays,
      timestamp,
      timestamp,
    ]
  );

  return findAgreementMetadataByAgreementId(agreementId);
};

module.exports = {
  findAgreementMetadataByAgreementId,
  findAgreementMetadataByAgreementIds,
  upsertAgreementMetadata,
};
