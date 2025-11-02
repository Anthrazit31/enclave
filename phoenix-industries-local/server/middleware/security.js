const logger = require('../utils/logger');
const { prisma } = require('../config/database');

/**
 * Security monitoring middleware
 */
function securityMiddleware(req, res, next) {
  const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
  const userAgent = req.headers['user-agent'] || 'Unknown';

  // Add security info to request
  req.security = {
    ip: clientIP,
    userAgent: userAgent,
    timestamp: new Date().toISOString()
  };

  // Log suspicious activity
  if (isSuspiciousRequest(req)) {
    logger.security('Suspicious request detected', {
      ip: clientIP,
      userAgent: userAgent,
      method: req.method,
      url: req.url,
      headers: req.headers
    });
  }

  // Monitor for common attack patterns
  if (detectAttackPatterns(req)) {
    logger.security('Potential attack pattern detected', {
      ip: clientIP,
      userAgent: userAgent,
      method: req.method,
      url: req.url,
      body: req.body
    });

    // Log to database
    logSecurityEvent(req, null, 'SUSPICIOUS', 'Potential attack pattern detected');
  }

  next();
}

/**
 * Check if request appears suspicious
 */
function isSuspiciousRequest(req) {
  const userAgent = req.headers['user-agent'] || '';
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /scanner/i,
    /curl/i,
    /wget/i,
    /python/i,
    /perl/i,
    /java/i,
    /go-http/i
  ];

  // Check for missing or suspicious user agent
  if (!userAgent || suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
    return true;
  }

  // Check for unusual headers
  const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'x-originating-ip'];
  const hasSuspiciousHeaders = suspiciousHeaders.some(header => req.headers[header]);

  return hasSuspiciousHeaders;
}

/**
 * Detect common attack patterns
 */
function detectAttackPatterns(req) {
  const url = req.url.toLowerCase();
  const body = req.body ? JSON.stringify(req.body).toLowerCase() : '';

  const attackPatterns = [
    // SQL injection patterns
    /(\b(select|insert|update|delete|drop|union|exec|script)\b)/i,
    /(\b(or|and)\s+\d+\s*=\s*\d+)/i,
    /('|(\\')|(;)|(\%27)|(\%3B))/i,

    // XSS patterns
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,

    // Path traversal
    /\.\.\//,
    /\.\.\\/,

    // Command injection
    /(\||&|;|\$\(|\`)/,

    // Directory listing
    /%c0%af/,
    /%2e%2e/,

    // File inclusion
    /(php|asp|jsp):/i,
    /(data|file|ftp|http|https):/i
  ];

  // Check URL and body for attack patterns
  return attackPatterns.some(pattern =>
    pattern.test(url) || pattern.test(body)
  );
}

/**
 * Log security event to database
 */
async function logSecurityEvent(req, userId, eventType, description, metadata = {}) {
  try {
    await prisma.securityLog.create({
      data: {
        userId: userId,
        eventType: eventType,
        description: description,
        ipAddress: req.security.ip,
        userAgent: req.security.userAgent,
        metadata: JSON.stringify({
          ...metadata,
          method: req.method,
          url: req.url,
          timestamp: req.security.timestamp
        })
      }
    });

    logger.security(`Security event logged: ${eventType}`, {
      userId: userId,
      ip: req.security.ip,
      description: description
    });
  } catch (error) {
    logger.error('Failed to log security event:', error);
  }
}

/**
 * Rate limiting middleware for sensitive endpoints
 */
function createSensitiveRateLimit(options = {}) {
  const requests = new Map();
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
  const maxRequests = options.maxRequests || 5;

  return (req, res, next) => {
    const clientIP = req.security.ip;
    const now = Date.now();

    // Get existing requests for this IP
    const userRequests = requests.get(clientIP) || [];

    // Filter out old requests outside the window
    const validRequests = userRequests.filter(timestamp =>
      now - timestamp < windowMs
    );

    // Check if limit exceeded
    if (validRequests.length >= maxRequests) {
      logger.security('Rate limit exceeded', {
        ip: clientIP,
        requests: validRequests.length,
        maxRequests: maxRequests,
        window: windowMs
      });

      // Log to database
      logSecurityEvent(req, null, 'SUSPICIOUS', 'Rate limit exceeded', {
        requestCount: validRequests.length,
        maxRequests: maxRequests
      });

      return res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    // Add current request timestamp
    validRequests.push(now);
    requests.set(clientIP, validRequests);

    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance to clean up
      for (const [ip, timestamps] of requests.entries()) {
        const filtered = timestamps.filter(timestamp =>
          now - timestamp < windowMs
        );
        if (filtered.length === 0) {
          requests.delete(ip);
        } else {
          requests.set(ip, filtered);
        }
      }
    }

    next();
  };
}

/**
 * IP blocking middleware
 */
const blockedIPs = new Set();

function blockIP(ip, duration = 60 * 60 * 1000) { // Default 1 hour
  blockedIPs.add(ip);
  setTimeout(() => {
    blockedIPs.delete(ip);
  }, duration);

  logger.security(`IP blocked: ${ip} for ${duration}ms`);
}

function ipBlockMiddleware(req, res, next) {
  const clientIP = req.security.ip;

  if (blockedIPs.has(clientIP)) {
    logger.security(`Blocked IP attempted access: ${clientIP}`);
    return res.status(403).json({
      success: false,
      error: 'Access denied'
    });
  }

  next();
}

module.exports = securityMiddleware;
module.exports.logSecurityEvent = logSecurityEvent;
module.exports.createSensitiveRateLimit = createSensitiveRateLimit;
module.exports.blockIP = blockIP;
module.exports.ipBlockMiddleware = ipBlockMiddleware;