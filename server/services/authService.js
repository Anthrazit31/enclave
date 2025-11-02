const { prisma } = require('../config/database');
const {
  hashPassword,
  comparePassword,
  generateTokenPair,
  getTokenExpiration
} = require('../config/auth');
const logger = require('../utils/logger');
const { logSecurityEvent } = require('../middleware/security');

/**
 * User registration service
 */
async function registerUser(userData, ipAddress, userAgent) {
  try {
    const { username, email, password, accessLevel = 'RESEARCHER' } = userData;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: email }
        ]
      }
    });

    if (existingUser) {
      if (existingUser.username === username) {
        await logSecurityEvent(
          { security: { ip: ipAddress, userAgent: userAgent } },
          null,
          'SUSPICIOUS',
          'Registration attempt with existing username',
          { username: username }
        );
        throw new Error('Username already exists');
      }
      if (existingUser.email === email) {
        await logSecurityEvent(
          { security: { ip: ipAddress, userAgent: userAgent } },
          null,
          'SUSPICIOUS',
          'Registration attempt with existing email',
          { email: email }
        );
        throw new Error('Email already exists');
      }
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        accessLevel: accessLevel.toUpperCase()
      },
      select: {
        id: true,
        username: true,
        email: true,
        accessLevel: true,
        createdAt: true
      }
    });

    // Log security event
    await logSecurityEvent(
      { security: { ip: ipAddress, userAgent: userAgent } },
      user.id,
      'LOGIN',
      'User registered successfully',
      { accessLevel: user.accessLevel }
    );

    logger.auth(`New user registered: ${user.username} (${user.id})`);

    // Generate tokens
    const tokens = generateTokenPair(user);

    return { user, ...tokens };
  } catch (error) {
    logger.error('Registration error:', error);
    throw error;
  }
}

/**
 * User authentication service
 */
async function authenticateUser(username, password, ipAddress, userAgent) {
  try {
    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username: username },
      select: {
        id: true,
        username: true,
        email: true,
        passwordHash: true,
        accessLevel: true,
        isActive: true,
        lastLogin: true
      }
    });

    if (!user) {
      await logSecurityEvent(
        { security: { ip: ipAddress, userAgent: userAgent } },
        null,
        'ACCESS_DENIED',
        'Login attempt with non-existent username',
        { username: username }
      );
      throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
      await logSecurityEvent(
        { security: { ip: ipAddress, userAgent: userAgent } },
        user.id,
        'ACCESS_DENIED',
        'Login attempt with deactivated account',
        { username: username }
      );
      throw new Error('Account is deactivated');
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      await logSecurityEvent(
        { security: { ip: ipAddress, userAgent: userAgent } },
        user.id,
        'ACCESS_DENIED',
        'Login attempt with invalid password',
        { username: username }
      );
      throw new Error('Invalid credentials');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Log successful login
    await logSecurityEvent(
      { security: { ip: ipAddress, userAgent: userAgent } },
      user.id,
      'LOGIN',
      'User logged in successfully',
      { accessLevel: user.accessLevel }
    );

    logger.auth(`User authenticated: ${user.username} (${user.id}) from ${ipAddress}`);

    // Generate tokens
    const tokens = generateTokenPair(user);

    // Store session in database
    const tokenExpiration = getTokenExpiration(process.env.JWT_EXPIRES_IN);
    await prisma.userSession.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(tokens.accessToken),
        refreshTokenHash: hashToken(tokens.refreshToken),
        expiresAt: tokenExpiration,
        ipAddress: ipAddress,
        userAgent: userAgent
      }
    });

    // Remove password hash from user object
    const { passwordHash, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, ...tokens };
  } catch (error) {
    logger.error('Authentication error:', error);
    throw error;
  }
}

/**
 * Token refresh service
 */
async function refreshTokens(refreshToken, ipAddress, userAgent) {
  try {
    const { verifyRefreshToken, generateTokenPair } = require('../config/auth');
    const { hashToken } = require('../utils/helpers');

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    const userId = decoded.userId;

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        accessLevel: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      await logSecurityEvent(
        { security: { ip: ipAddress, userAgent: userAgent } },
        userId,
        'ACCESS_DENIED',
        'Token refresh with invalid/expired token',
        { userId: userId }
      );
      throw new Error('Invalid refresh token');
    }

    // Check if refresh token exists and is active
    const existingSession = await prisma.userSession.findFirst({
      where: {
        userId: userId,
        refreshTokenHash: hashToken(refreshToken),
        isActive: true
      }
    });

    if (!existingSession) {
      await logSecurityEvent(
        { security: { ip: ipAddress, userAgent: userAgent } },
        userId,
        'SUSPICIOUS',
        'Token refresh with unknown session',
        { userId: userId }
      );
      throw new Error('Invalid refresh token');
    }

    // Generate new tokens
    const newTokens = generateTokenPair(user);

    // Update existing session
    const tokenExpiration = getTokenExpiration(process.env.JWT_EXPIRES_IN);
    await prisma.userSession.update({
      where: { id: existingSession.id },
      data: {
        tokenHash: hashToken(newTokens.accessToken),
        refreshTokenHash: hashToken(newTokens.refreshToken),
        expiresAt: tokenExpiration,
        ipAddress: ipAddress,
        userAgent: userAgent
      }
    });

    logger.auth(`Tokens refreshed for user: ${user.username} (${user.id})`);

    return newTokens;
  } catch (error) {
    logger.error('Token refresh error:', error);
    throw error;
  }
}

/**
 * User logout service
 */
async function logoutUser(userId, ipAddress, userAgent) {
  try {
    // Deactivate all sessions for user
    const deactivatedSessions = await prisma.userSession.updateMany({
      where: {
        userId: userId,
        isActive: true
      },
      data: {
        isActive: false
      }
    });

    // Log security event
    await logSecurityEvent(
      { security: { ip: ipAddress, userAgent: userAgent } },
      userId,
      'LOGOUT',
      'User logged out',
      { deactivatedSessions: deactivatedSessions.count }
    );

    logger.auth(`User logged out: ${userId} - Deactivated ${deactivatedSessions.count} sessions`);

    return { success: true, deactivatedSessions: deactivatedSessions.count };
  } catch (error) {
    logger.error('Logout error:', error);
    throw error;
  }
}

/**
 * Get current user info
 */
async function getCurrentUser(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        accessLevel: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  } catch (error) {
    logger.error('Get current user error:', error);
    throw error;
  }
}

/**
 * Change password service
 */
async function changePassword(userId, currentPassword, newPassword, ipAddress, userAgent) {
  try {
    // Get user with password hash
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        passwordHash: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    // Verify current password
    const isValidCurrentPassword = await comparePassword(currentPassword, user.passwordHash);
    if (!isValidCurrentPassword) {
      await logSecurityEvent(
        { security: { ip: ipAddress, userAgent: userAgent } },
        userId,
        'SUSPICIOUS',
        'Password change attempt with invalid current password',
        { username: user.username }
      );
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash }
    });

    // Deactivate all existing sessions (force re-login)
    await prisma.userSession.updateMany({
      where: {
        userId: userId,
        isActive: true
      },
      data: {
        isActive: false
      }
    });

    // Log security event
    await logSecurityEvent(
      { security: { ip: ipAddress, userAgent: userAgent } },
      userId,
      'LOGIN',
      'Password changed successfully',
      { username: user.username }
    );

    logger.auth(`Password changed for user: ${user.username} (${userId})`);

    return { success: true };
  } catch (error) {
    logger.error('Change password error:', error);
    throw error;
  }
}

/**
 * Hash token for storage (simple implementation)
 */
function hashToken(token) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  registerUser,
  authenticateUser,
  refreshTokens,
  logoutUser,
  getCurrentUser,
  changePassword,
  hashToken
};