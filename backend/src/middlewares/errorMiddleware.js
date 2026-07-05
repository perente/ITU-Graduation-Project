exports.notFoundHandler = (req, res, next) => {
  return res.status(404).json({
    success: false,
    message: 'Route not found.',
  });
};

exports.errorHandler = (err, req, res, next) => {
  console.error('ERROR:', err.message);

  const statusCode = err.statusCode || 500;
  const isOperational = Boolean(err.isOperational);
  const response = {
    success: false,
    message:
      statusCode >= 500 && !isOperational
        ? 'Internal server error.'
        : err.message || 'Internal server error.',
  };

  if (Array.isArray(err.errors) && err.errors.length) {
    response.errors = err.errors;
  }

  return res.status(statusCode).json(response);
};
