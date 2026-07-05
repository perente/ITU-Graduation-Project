const DEPARTMENT_INTERNSHIP_POLICIES = {
  CSE: {
    mandatoryRequiredCount: 2,
    mandatoryMinDaysPerInternship: 20,
    mandatoryTotalRequiredDays: 40,
    voluntaryMaxDays: 50,
    voluntaryMinDaysPerInternship: 10,
  },
  AIE: {
    mandatoryRequiredCount: 2,
    mandatoryMinDaysPerInternship: 20,
    mandatoryTotalRequiredDays: 40,
    voluntaryMaxDays: 50,
    voluntaryMinDaysPerInternship: 10,
  },
  ME: {
    mandatoryRequiredCount: 2,
    mandatoryMinDaysPerInternship: 22,
    mandatoryTotalRequiredDays: 44,
    voluntaryMaxDays: 50,
    voluntaryMinDaysPerInternship: 10,
  },
};

const getDepartmentInternshipPolicy = (departmentCode) => {
  const normalizedDepartmentCode = String(departmentCode || '')
    .trim()
    .toUpperCase();

  return DEPARTMENT_INTERNSHIP_POLICIES[normalizedDepartmentCode] || null;
};

module.exports = {
  DEPARTMENT_INTERNSHIP_POLICIES,
  getDepartmentInternshipPolicy,
};
