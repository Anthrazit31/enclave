const logger = require('../utils/logger');
const { logError } = require('./logging');

/**
 * Global error handling middleware
 */
function errorHandler(error, req, res, next) {
  // Log the error
  logError(error, req);

  // Default error response
  let statusCode = 500;
  let message = 'Internal server error';
  let details = {};

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
    details = error.details || {};
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  } else if (error.name === 'PrismaClientKnownRequestError') {
    // Handle Prisma-specific errors
    handlePrismaError(error, (code, msg) => {
      statusCode = code;
      message = msg;
    });
  } else if (error.statusCode || error.status) {
    // Custom error with status code
    statusCode = error.statusCode || error.status;
    message = error.message || message;
    details = error.details || {};
  } else if (error.message) {
    // Generic error with message
    message = error.message;
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal server error';
    details = {};
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(Object.keys(details).length > 0 && { details }),
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
}

/**
 * Handle Prisma-specific errors
 */
function handlePrismaError(error, callback) {
  switch (error.code) {
    case 'P2002':
      // Unique constraint violation
      callback(409, 'Resource already exists');
      break;
    case 'P2025':
      // Record not found
      callback(404, 'Resource not found');
      break;
    case 'P2003':
      // Foreign key constraint violation
      callback(400, 'Invalid reference');
      break;
    case 'P2014':
      // Relation violation
      callback(400, 'Invalid relation');
      break;
    case 'P2001':
      // Record does not exist
      callback(404, 'Resource not found');
      break;
    case 'P2012':
      // Missing value
      callback(400, 'Required field missing');
      break;
    case 'P2013':
      // Missing required argument
      callback(400, 'Required argument missing');
      break;
    case 'P2011':
      // Null constraint violation
      callback(400, 'Null constraint violation');
      break;
    case 'P2010':
      // Raw query failed
      callback(500, 'Database query failed');
      break;
    case 'P2009':
      // Validation failed
      callback(400, 'Validation failed');
      break;
    case 'P2008':
      // Timeout
      callback(408, 'Request timeout');
      break;
    case 'P2007':
      // Data validation error
      callback(400, 'Data validation error');
      break;
    case 'P2006':
      // Invalid value
      callback(400, 'Invalid value provided');
      break;
    case 'P2005':
      // Invalid value
      callback(400, 'Invalid value provided');
      break;
    case 'P2004':
      // Constraint failed
      callback(400, 'Constraint failed');
      break;
    case 'P2021':
      // Table does not exist
      callback(500, 'Internal server error');
      break;
    case 'P2022':
      // Column does not exist
      callback(500, 'Internal server error');
      break;
    case 'P2020':
      // Value out of range
      callback(400, 'Value out of range');
      break;
    case 'P2019':
      // Input error
      callback(400, 'Input error');
      break;
    case 'P2018':
      // Required connected records not found
      callback(400, 'Required connected records not found');
      break;
    case 'P2017':
      // Multiple records found
      callback(409, 'Multiple records found');
      break;
    case 'P2016':
      // Query interpretation error
      callback(500, 'Query interpretation error');
      break;
    case 'P2015':
      // Related records not found
      callback(400, 'Related records not found');
      break;
    default:
      callback(500, 'Database error');
      break;
  }
}

/**
 * Async error wrapper
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 handler
 */
function notFoundHandler(req, res) {
  logger.warn(`404 - Route not found: ${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.status(404).json({
    success: false,
    error: 'Route not found',
    method: req.method,
    url: req.url
  });
}

module.exports = errorHandler;
module.exports.asyncHandler = asyncHandler;
module.exports.notFoundHandler = notFoundHandler;