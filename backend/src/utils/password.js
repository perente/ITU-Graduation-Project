const bcrypt = require('bcryptjs');

const hashPassword = async (value) => {
  return bcrypt.hash(value, 10);
};

const comparePassword = async (value, passwordHash) => {
  return bcrypt.compare(value, passwordHash);
};

module.exports = {
  hashPassword,
  comparePassword,
};
