const logger = require('../utils/logger');

/**
 * HTTP request logging middleware
 */
function loggingMiddleware(req, res, next) {
  const startTime = Date.now();
  const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];

  // Log request
  logger.api(`${req.method} ${req.url}`, {
    ip: clientIP,
    userAgent: req.headers['user-agent'],
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length']
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;

    // Log response
    logger.api(`${req.method} ${req.url} - ${res.statusCode}`, {
      ip: clientIP,
      duration: `${duration}ms`,
      contentLength: res.get('content-length') || 0
    });

    // Log errors separately
    if (res.statusCode >= 400) {
      logger.warn(`HTTP Error: ${req.method} ${req.url} - ${res.statusCode}`, {
        ip: clientIP,
        duration: `${duration}ms`
      });
    }

    originalEnd.call(this, chunk, encoding);
  };

  next();
}

/**
 * Error logging middleware helper
 */
function logError(error, req) {
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    body: req.body,
    params: req.params,
    query: req.query
  });
}

module.exports = loggingMiddleware;
module.exports.logError = logError;