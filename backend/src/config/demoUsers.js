const demoUsers = [
  {
    email: 'student1@itu.edu.tr',
    password: '123456',
    role: 'student',
    entityId: 'student123',
    fabricIdentity: 'student123',
    name: 'Rabia',
    surname: 'Demir',
    facultyId: 'BBF',
    facultyName: 'Bilgisayar ve Bilişim Fakültesi',
    departmentCode: 'CSE',
    departmentName: 'Bilgisayar Muhendisligi',
    completedCredits: 45,
  },
  {
    email: 'studentworkflow@itu.edu.tr',
    password: '123456',
    role: 'student',
    entityId: 'studentWorkflow123',
    fabricIdentity: 'studentWorkflow123',
    name: 'Workflow',
    surname: 'Student',
    facultyId: 'BBF',
    facultyName: 'Bilgisayar ve Bilişim Fakültesi',
    departmentCode: 'CSE',
    departmentName: 'Bilgisayar Muhendisligi',
    completedCredits: 45,
  },
  {
    email: 'studentphase2@itu.edu.tr',
    password: '123456',
    role: 'student',
    entityId: 'studentPhase2123',
    fabricIdentity: 'studentPhase2123',
    name: 'Phase2',
    surname: 'Student',
    facultyId: 'BBF',
    facultyName: 'Bilgisayar ve Bilişim Fakültesi',
    departmentCode: 'CSE',
    departmentName: 'Bilgisayar Muhendisligi',
    completedCredits: 45,
  },
  {
    email: 'studentrules@itu.edu.tr',
    password: '123456',
    role: 'student',
    entityId: 'studentRules123',
    fabricIdentity: 'studentRules123',
    name: 'Rule',
    surname: 'Student',
    facultyId: 'BBF',
    facultyName: 'Bilgisayar ve Bilişim Fakültesi',
    departmentCode: 'CSE',
    departmentName: 'Bilgisayar Muhendisligi',
    completedCredits: 45,
  },
  {
    email: 'studentrulesoverlap@itu.edu.tr',
    password: '123456',
    role: 'student',
    entityId: 'studentRulesOverlap123',
    fabricIdentity: 'studentRulesOverlap123',
    name: 'Rule',
    surname: 'Overlap',
    facultyId: 'BBF',
    facultyName: 'Bilgisayar ve Bilişim Fakültesi',
    departmentCode: 'CSE',
    departmentName: 'Bilgisayar Muhendisligi',
    completedCredits: 45,
  },
  {
    email: 'companyb@company.com',
    password: '123456',
    role: 'company',
    entityId: 'companyB',
    fabricIdentity: 'companyB',
  },
  {
    email: 'faculty@itu.edu.tr',
    password: '123456',
    role: 'faculty',
    entityId: 'BBF',
    fabricIdentity: 'BBF',
  },
  {
    email: 'central@itu.edu.tr',
    password: '123456',
    role: 'central',
    entityId: 'CENTRAL_UNIT',
    fabricIdentity: 'centralunit',
  },
];

// Demo auth must stay aligned with Fabric identities created by the enrollment script.
// `role` and `entityId` are embedded into the JWT and must match the certificate
// attributes expected by chaincode: role=<role>, id=<entityId>.
demoUsers.forEach((user, index) => {
  if (
    !user ||
    !user.email ||
    !user.password ||
    !user.role ||
    !user.entityId ||
    !user.fabricIdentity
  ) {
    throw new Error(
      `Invalid demo user config at index ${index}: email, password, role, entityId, and fabricIdentity are required.`
    );
  }
});

module.exports = demoUsers;
