const { WORKING_DAY_CODES } = require('../config/internshipFields');

const WEEKDAY_TO_UTC_DAY = {
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
  SUN: 0,
};

const normalizeIsoDay = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
};

const createUtcDateFromIsoDay = (isoDay) => {
  const [year, month, day] = String(isoDay || '')
    .split('-')
    .map(Number);

  return new Date(Date.UTC(year, month - 1, day));
};

const normalizeWorkingDays = (workingDays = []) => {
  return workingDays.map((dayCode) => String(dayCode || '').trim().toUpperCase());
};

const normalizeWeeklySchedule = (weeklySchedule = []) => {
  return weeklySchedule.map((week) => normalizeWorkingDays(week || []));
};

const calculateTotalScheduledWorkingDays = (weeklySchedule = []) => {
  return normalizeWeeklySchedule(weeklySchedule).reduce(
    (total, week) => total + week.length,
    0
  );
};

const calculateTotalWorkingDays = ({ startDate, endDate, workingDays }) => {
  const normalizedStartDate = normalizeIsoDay(startDate);
  const normalizedEndDate = normalizeIsoDay(endDate);
  const normalizedWorkingDays = normalizeWorkingDays(workingDays);

  if (!normalizedStartDate || !normalizedEndDate) {
    return 0;
  }

  const selectedUtcDays = new Set(
    normalizedWorkingDays
      .filter((dayCode) => WORKING_DAY_CODES.includes(dayCode))
      .map((dayCode) => WEEKDAY_TO_UTC_DAY[dayCode])
  );

  let totalWorkingDays = 0;
  const currentDate = createUtcDateFromIsoDay(normalizedStartDate);
  const finalDate = createUtcDateFromIsoDay(normalizedEndDate);

  while (currentDate <= finalDate) {
    if (selectedUtcDays.has(currentDate.getUTCDay())) {
      totalWorkingDays += 1;
    }

    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return totalWorkingDays;
};

module.exports = {
  calculateTotalScheduledWorkingDays,
  calculateTotalWorkingDays,
  normalizeIsoDay,
  normalizeWeeklySchedule,
  normalizeWorkingDays,
};
