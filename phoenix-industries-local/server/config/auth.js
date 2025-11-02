const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

// Validate that secrets are set
if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set in environment variables');
}

/**
 * Generate JWT access token
 */
function generateAccessToken(payload) {
  try {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'phoenix-industries',
      audience: 'phoenix-terminal'
    });
  } catch (error) {
    logger.error('Error generating access token:', error);
    throw new Error('Token generation failed');
  }
}

/**
 * Generate JWT refresh token
 */
function generateRefreshToken(payload) {
  try {
    return jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
      issuer: 'phoenix-industries',
      audience: 'phoenix-terminal'
    });
  } catch (error) {
    logger.error('Error generating refresh token:', error);
    throw new Error('Refresh token generation failed');
  }
}

/**
 * Verify JWT access token
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'phoenix-industries',
      audience: 'phoenix-terminal'
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Access token expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid access token');
    } else {
      logger.error('Error verifying access token:', error);
      throw new Error('Token verification failed');
    }
  }
}

/**
 * Verify JWT refresh token
 */
function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'phoenix-industries',
      audience: 'phoenix-terminal'
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Refresh token expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid refresh token');
    } else {
      logger.error('Error verifying refresh token:', error);
      throw new Error('Refresh token verification failed');
    }
  }
}

/**
 * Hash password using bcrypt
 */
async function hashPassword(password) {
  try {
    const saltRounds = parseInt(BCRYPT_ROUNDS) || 12;
    return await bcrypt.hash(password, saltRounds);
  } catch (error) {
    logger.error('Error hashing password:', error);
    throw new Error('Password hashing failed');
  }
}

/**
 * Compare password with hash
 */
async function comparePassword(password, hash) {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    logger.error('Error comparing password:', error);
    throw new Error('Password comparison failed');
  }
}

/**
 * Generate token pair for user
 */
function generateTokenPair(user) {
  const payload = {
    userId: user.id,
    username: user.username,
    accessLevel: user.accessLevel
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken({ userId: user.id });

  return {
    accessToken,
    refreshToken,
    expiresIn: JWT_EXPIRES_IN
  };
}

/**
 * Get token expiration date
 */
function getTokenExpiration(expiresIn) {
  const now = new Date();
  const expiration = new Date(now);

  // Parse expiresIn (e.g., "15m", "7d", "1h")
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error('Invalid expiresIn format');
  }

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's':
      expiration.setSeconds(now.getSeconds() + value);
      break;
    case 'm':
      expiration.setMinutes(now.getMinutes() + value);
      break;
    case 'h':
      expiration.setHours(now.getHours() + value);
      break;
    case 'd':
      expiration.setDate(now.getDate() + value);
      break;
    default:
      throw new Error('Invalid time unit');
  }

  return expiration;
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashPassword,
  comparePassword,
  generateTokenPair,
  getTokenExpiration,
  JWT_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN
};