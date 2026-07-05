const INTERNSHIP_TYPES = ['MANDATORY', 'VOLUNTARY'];

const WORKING_DAY_CODES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const WEEKLY_SCHEDULE_DAY_CODES = WORKING_DAY_CODES;

const INTERNSHIP_FIELDS_BY_DEPARTMENT = {
  CSE: [
    'BILGI_ISLEM',
    'BILGI_TEKNOLOJILERI',
    'YAZILIM',
    'DONANIM',
    'BILISIM',
  ],
  AIE: [
    'BILGI_ISLEM',
    'BILGI_TEKNOLOJILERI',
    'YAZILIM',
    'DONANIM',
    'BILISIM',
  ],
  ME: [
    'ARGE',
    'URUN_GELISTIRME',
    'PROJELENDIRME',
    'IMALAT',
    'MONTAJ',
  ],
};

const getAllowedInternshipFieldsForDepartment = (departmentCode) => {
  const normalizedDepartmentCode = String(departmentCode || '')
    .trim()
    .toUpperCase();

  return INTERNSHIP_FIELDS_BY_DEPARTMENT[normalizedDepartmentCode] || [];
};

module.exports = {
  INTERNSHIP_FIELDS_BY_DEPARTMENT,
  INTERNSHIP_TYPES,
  WEEKLY_SCHEDULE_DAY_CODES,
  WORKING_DAY_CODES,
  getAllowedInternshipFieldsForDepartment,
};
