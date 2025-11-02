const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate a UUID
 */
function generateUUID() {
  return uuidv4();
}

/**
 * Hash a string using SHA-256
 */
function hashString(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Generate random string
 */
function generateRandomString(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Sanitize input to prevent injection
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return input;
  }

  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Validate and extract file path components
 */
function parseFilePath(filePath) {
  // Normalize path
  const normalized = filePath.replace(/\\/g, '/').replace(/\/+/g, '/');

  // Ensure path starts with /
  if (!normalized.startsWith('/')) {
    return null;
  }

  // Split into components
  const components = normalized.split('/').filter(Boolean);
  const filename = components[components.length - 1];
  const dirname = components.length > 1
    ? '/' + components.slice(0, -1).join('/')
    : '/';

  return {
    fullPath: normalized,
    filename: filename,
    dirname: dirname,
    components: components
  };
}

/**
 * Check if a path is safe (prevents directory traversal)
 */
function isPathSafe(path) {
  const parsed = parseFilePath(path);
  if (!parsed) return false;

  // Check for directory traversal attempts
  if (path.includes('..') || path.includes('~')) {
    return false;
  }

  // Check for absolute paths that shouldn't be absolute
  if (path.startsWith('/') && !path.startsWith('/')) {
    return false;
  }

  return true;
}

/**
 * Format date for display
 */
function formatDate(date, options = {}) {
  const defaultOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };

  return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(date);
}

/**
 * Truncate text to specified length
 */
function truncateText(text, maxLength = 100, suffix = '...') {
  if (!text || text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Deep clone an object
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }

  if (typeof obj === 'object') {
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }

  return obj;
}

/**
 * Retry function with exponential backoff
 */
async function retry(fn, maxAttempts = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        break;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Rate limiter implementation
 */
class RateLimiter {
  constructor(maxRequests = 100, windowMs = 15 * 60 * 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  isAllowed(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }

    const userRequests = this.requests.get(key);

    // Remove old requests outside the window
    const validRequests = userRequests.filter(timestamp => timestamp > windowStart);

    // Check if limit exceeded
    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);

    return true;
  }

  cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [key, timestamps] of this.requests.entries()) {
      const validRequests = timestamps.filter(timestamp => timestamp > windowStart);
      if (validRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validRequests);
      }
    }
  }
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate username format
 */
function isValidUsername(username) {
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  return usernameRegex.test(username);
}

/**
 * Validate password strength
 */
function validatePasswordStrength(password) {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numbers: /\d/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  };

  const score = Object.values(checks).filter(Boolean).length;

  return {
    ...checks,
    score: score,
    strong: score >= 4
  };
}

module.exports = {
  generateUUID,
  hashString,
  generateRandomString,
  sanitizeInput,
  parseFilePath,
  isPathSafe,
  formatDate,
  truncateText,
  deepClone,
  retry,
  RateLimiter,
  isValidEmail,
  isValidUsername,
  validatePasswordStrength
};