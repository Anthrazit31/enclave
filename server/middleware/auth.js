const { verifyAccessToken } = require('../config/auth');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Authentication middleware - verifies JWT token
 */
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        email: true,
        accessLevel: true,
        isActive: true,
        lastLogin: true
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated'
      });
    }

    // Add user to request object
    req.user = user;
    req.token = token;

    logger.auth(`Authenticated user: ${user.username} (${user.id})`);
    next();
  } catch (error) {
    logger.error('Authentication error:', error);

    if (error.message === 'Access token expired') {
      return res.status(401).json({
        success: false,
        error: 'Access token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.message.includes('token')) {
      return res.status(401).json({
        success: false,
        error: 'Invalid access token'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

/**
 * Access level middleware - checks if user has required access level
 */
function requireAccessLevel(requiredLevels) {
  const levels = Array.isArray(requiredLevels) ? requiredLevels : [requiredLevels];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userLevel = req.user.accessLevel;

    if (!levels.includes(userLevel)) {
      logger.security(`Access denied for user ${req.user.username}. Required: ${levels.join(', ')}, Has: ${userLevel}`);
      return res.status(403).json({
        success: false,
        error: 'Insufficient access level',
        required: levels,
        current: userLevel
      });
    }

    logger.auth(`Access granted for user ${req.user.username} with level ${userLevel}`);
    next();
  };
}

/**
 * Admin access middleware
 */
function requireAdmin(req, res, next) {
  return requireAccessLevel('ADMIN')(req, res, next);
}

/**
 * Self or admin middleware - user can access their own resources or admin can access any
 */
function requireSelfOrAdmin(req, res, next) {
  const targetUserId = req.params.id || req.params.userId;

  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  // Admin can access any resource
  if (req.user.accessLevel === 'ADMIN') {
    return next();
  }

  // User can access their own resources
  if (req.user.id === targetUserId) {
    return next();
  }

  logger.security(`Unauthorized access attempt by user ${req.user.username} to user ${targetUserId} resources`);
  return res.status(403).json({
    success: false,
    error: 'Access denied - can only access your own resources'
  });
}

/**
 * Optional authentication - token is not required but will be used if present
 */
async function optionalAuthentication(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next(); // No token provided, continue without user
    }

    const decoded = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        email: true,
        accessLevel: true,
        isActive: true
      }
    });

    if (user && user.isActive) {
      req.user = user;
      req.token = token;
    }

    next();
  } catch (error) {
    // If token is invalid, just continue without user
    logger.warn('Optional authentication failed:', error.message);
    next();
  }
}

module.exports = {
  authenticateToken,
  requireAccessLevel,
  requireAdmin,
  requireSelfOrAdmin,
  optionalAuthentication
};