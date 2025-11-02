const express = require('express');
const rateLimit = require('express-rate-limit');
const { asyncHandler } = require('../middleware/errorHandler');
const { validators } = require('../middleware/validation');
const { createSensitiveRateLimit } = require('../middleware/security');
const authService = require('../services/authService');
const logger = require('../utils/logger');

const router = express.Router();

// Sensitive rate limiting for authentication endpoints
const authRateLimit = createSensitiveRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10 // 10 attempts per 15 minutes
});

// Standard rate limiting for less sensitive endpoints
const standardRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  }
});

/**
 * POST /api/auth/register
 * Register a new user (currently admin-only, but open for development)
 */
router.post('/register', authRateLimit, validators.register, asyncHandler(async (req, res) => {
  const { username, email, password, accessLevel } = req.body;
  const ipAddress = req.security.ip;
  const userAgent = req.security.userAgent;

  logger.auth(`Registration attempt: ${username} from ${ipAddress}`);

  const result = await authService.registerUser(
    { username, email, password, accessLevel },
    ipAddress,
    userAgent
  );

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn
    }
  });
}));

/**
 * POST /api/auth/login
 * Authenticate user and return tokens
 */
router.post('/login', authRateLimit, validators.login, asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const ipAddress = req.security.ip;
  const userAgent = req.security.userAgent;

  logger.auth(`Login attempt: ${username} from ${ipAddress}`);

  const result = await authService.authenticateUser(username, password, ipAddress, userAgent);

  // Set HTTP-only cookie for refresh token (more secure)
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.json({
    success: true,
    message: 'Authentication successful',
    data: {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn
    }
  });
}));

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', standardRateLimit, validators.refreshToken, asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const ipAddress = req.security.ip;
  const userAgent = req.security.userAgent;

  // Try to get refresh token from cookie if not in body
  const tokenFromCookie = req.cookies.refreshToken;
  const finalRefreshToken = refreshToken || tokenFromCookie;

  if (!finalRefreshToken) {
    return res.status(401).json({
      success: false,
      error: 'Refresh token required'
    });
  }

  const result = await authService.refreshTokens(finalRefreshToken, ipAddress, userAgent);

  // Update refresh token cookie if it exists
  if (tokenFromCookie) {
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
  }

  res.json({
    success: true,
    message: 'Tokens refreshed successfully',
    data: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn
    }
  });
}));

/**
 * POST /api/auth/logout
 * Logout user and invalidate tokens
 */
router.post('/logout', standardRateLimit, asyncHandler(async (req, res) => {
  // Get user info from token if present
  const authHeader = req.headers.authorization;
  let userId = null;

  if (authHeader) {
    try {
      const { verifyAccessToken } = require('../config/auth');
      const token = authHeader.split(' ')[1];
      const decoded = verifyAccessToken(token);
      userId = decoded.userId;
    } catch (error) {
      // Token is invalid, but we still want to clear cookies
      logger.warn('Logout attempt with invalid token', { error: error.message });
    }
  }

  const ipAddress = req.security.ip;
  const userAgent = req.security.userAgent;

  if (userId) {
    await authService.logoutUser(userId, ipAddress, userAgent);
  }

  // Clear refresh token cookie
  res.clearCookie('refreshToken');

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get('/me', standardRateLimit, asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  try {
    const { verifyAccessToken } = require('../config/auth');
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const user = await authService.getCurrentUser(decoded.userId);

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    logger.error('Get current user error:', error);

    if (error.message.includes('expired')) {
      return res.status(401).json({
        success: false,
        error: 'Access token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid access token'
    });
  }
}));

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post('/change-password', standardRateLimit, validators.changePassword, asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  try {
    const { verifyAccessToken } = require('../config/auth');
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const { currentPassword, newPassword } = req.body;
    const ipAddress = req.security.ip;
    const userAgent = req.security.userAgent;

    await authService.changePassword(decoded.userId, currentPassword, newPassword, ipAddress, userAgent);

    // Clear refresh token cookie to force re-login with new password
    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: 'Password changed successfully. Please login again.'
    });
  } catch (error) {
    logger.error('Change password error:', error);

    if (error.message.includes('expired')) {
      return res.status(401).json({
        success: false,
        error: 'Access token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.message.includes('incorrect')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Password change failed'
    });
  }
}));

/**
 * GET /api/auth/verify-token
 * Verify if access token is valid
 */
router.get('/verify-token', standardRateLimit, asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: 'Access token required',
      valid: false
    });
  }

  try {
    const { verifyAccessToken } = require('../config/auth');
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        valid: true,
        userId: decoded.userId,
        username: decoded.username,
        accessLevel: decoded.accessLevel
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error.message,
      valid: false
    });
  }
}));

module.exports = router;