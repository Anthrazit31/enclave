const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken, requireAdmin, requireSelfOrAdmin } = require('../middleware/auth');
const { validators } = require('../middleware/validation');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Apply authentication to all user routes
router.use(authenticateToken);

/**
 * GET /api/users
 * List all users (admin only)
 */
router.get('/', requireAdmin, validators.pagination, asyncHandler(async (req, res) => {
  const { limit = 20, offset = 0, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
  const { search, accessLevel, isActive } = req.query;

  // Build filter conditions
  const where = {};

  if (search) {
    where.OR = [
      { username: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } }
    ];
  }

  if (accessLevel) {
    where.accessLevel = accessLevel.toUpperCase();
  }

  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  // Get users with pagination
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        accessLevel: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            sessions: {
              where: { isActive: true }
            },
            terminalSessions: {
              where: { isActive: true }
            }
          }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      take: parseInt(limit),
      skip: parseInt(offset)
    }),
    prisma.user.count({ where })
  ]);

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

/**
 * GET /api/users/:id
 * Get user details (self or admin)
 */
router.get('/:id', validators.uuid, requireSelfOrAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      accessLevel: true,
      isActive: true,
      lastLogin: true,
      createdAt: true,
      updatedAt: true,
      sessions: {
        where: { isActive: true },
        select: {
          id: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          expiresAt: true
        },
        orderBy: { createdAt: 'desc' }
      },
      terminalSessions: {
        where: { isActive: true },
        select: {
          id: true,
          terminalType: true,
          startedAt: true,
          lastActivity: true,
          currentDirectory: true
        },
        orderBy: { startedAt: 'desc' }
      },
      securityLogs: {
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          eventType: true,
          description: true,
          ipAddress: true,
          createdAt: true
        }
      }
    }
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  // Only show sensitive info to admins or the user themselves
  if (req.user.accessLevel !== 'ADMIN' && req.user.id !== id) {
    // Remove sensitive information for other users
    delete user.sessions;
    delete user.securityLogs;
  }

  res.json({
    success: true,
    data: { user }
  });
}));

/**
 * PUT /api/users/:id
 * Update user profile (self or admin)
 */
router.put('/:id', validators.uuid, requireSelfOrAdmin, validators.updateProfile, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { username, email } = req.body;

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { id }
  });

  if (!existingUser) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  // Check for conflicts with existing users
  if (username || email) {
    const conflictUser = await prisma.user.findFirst({
      where: {
        AND: [
          { id: { not: id } },
          {
            OR: [
              ...(username ? [{ username }] : []),
              ...(email ? [{ email }] : [])
            ]
          }
        ]
      }
    });

    if (conflictUser) {
      if (conflictUser.username === username) {
        return res.status(409).json({
          success: false,
          error: 'Username already exists'
        });
      }
      if (conflictUser.email === email) {
        return res.status(409).json({
          success: false,
          error: 'Email already exists'
        });
      }
    }
  }

  // Prepare update data
  const updateData = {};
  if (username) updateData.username = username;
  if (email) updateData.email = email;

  // Only admins can change access level and active status
  if (req.user.accessLevel === 'ADMIN') {
    if (req.body.accessLevel) {
      updateData.accessLevel = req.body.accessLevel.toUpperCase();
    }
    if (req.body.isActive !== undefined) {
      updateData.isActive = req.body.isActive;
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: updateData,
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

  logger.auth(`User profile updated: ${updatedUser.username} by ${req.user.username}`);

  res.json({
    success: true,
    message: 'User updated successfully',
    data: { user: updatedUser }
  });
}));

/**
 * DELETE /api/users/:id
 * Deactivate user (admin only)
 */
router.delete('/:id', validators.uuid, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id }
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  // Prevent deactivating yourself
  if (id === req.user.id) {
    return res.status(400).json({
      success: false,
      error: 'Cannot deactivate your own account'
    });
  }

  // Deactivate user (soft delete)
  await prisma.user.update({
    where: { id },
    data: {
      isActive: false
    }
  });

  // Deactivate all sessions
  await prisma.userSession.updateMany({
    where: { userId: id },
    data: { isActive: false }
  });

  // Deactivate all terminal sessions
  await prisma.terminalSession.updateMany({
    where: { userId: id },
    data: { isActive: false }
  });

  logger.auth(`User deactivated: ${user.username} by ${req.user.username}`);

  res.json({
    success: true,
    message: 'User deactivated successfully'
  });
}));

/**
 * POST /api/users/:id/reactivate
 * Reactivate deactivated user (admin only)
 */
router.post('/:id/reactivate', validators.uuid, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id }
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  // Reactivate user
  const reactivatedUser = await prisma.user.update({
    where: { id },
    data: {
      isActive: true
    },
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

  logger.auth(`User reactivated: ${reactivatedUser.username} by ${req.user.username}`);

  res.json({
    success: true,
    message: 'User reactivated successfully',
    data: { user: reactivatedUser }
  });
}));

/**
 * GET /api/users/:id/sessions
 * Get user sessions (self or admin)
 */
router.get('/:id/sessions', validators.uuid, requireSelfOrAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 20, offset = 0 } = req.query;

  const [sessions, total] = await Promise.all([
    prisma.userSession.findMany({
      where: { userId: id },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        isActive: true,
        createdAt: true,
        expiresAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    }),
    prisma.userSession.count({ where: { userId: id } })
  ]);

  res.json({
    success: true,
    data: {
      sessions,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

/**
 * DELETE /api/users/:id/sessions/:sessionId
 * Terminate specific user session (self or admin)
 */
router.delete('/:id/sessions/:sessionId', validators.uuid, requireSelfOrAdmin, asyncHandler(async (req, res) => {
  const { id, sessionId } = req.params;

  // Check if session exists and belongs to user
  const session = await prisma.userSession.findFirst({
    where: {
      id: sessionId,
      userId: id
    }
  });

  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  // Deactivate session
  await prisma.userSession.update({
    where: { id: sessionId },
    data: { isActive: false }
  });

  logger.auth(`Session terminated: ${sessionId} for user ${id} by ${req.user.username}`);

  res.json({
    success: true,
    message: 'Session terminated successfully'
  });
}));

/**
 * DELETE /api/users/:id/sessions
 * Terminate all user sessions (self or admin)
 */
router.delete('/:id/sessions', validators.uuid, requireSelfOrAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await prisma.userSession.updateMany({
    where: {
      userId: id,
      isActive: true
    },
    data: { isActive: false }
  });

  logger.auth(`All sessions terminated for user ${id} by ${req.user.username}`);

  res.json({
    success: true,
    message: 'All sessions terminated successfully',
    data: { terminatedSessions: result.count }
  });
}));

/**
 * GET /api/users/stats
 * Get user statistics (admin only)
 */
router.get('/stats', requireAdmin, asyncHandler(async (req, res) => {
  const [
    totalUsers,
    activeUsers,
    usersByAccessLevel,
    recentLogins,
    activeSessions
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.groupBy({
      by: ['accessLevel'],
      _count: { accessLevel: true }
    }),
    prisma.user.count({
      where: {
        lastLogin: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    }),
    prisma.userSession.count({
      where: {
        isActive: true,
        expiresAt: {
          gte: new Date()
        }
      }
    })
  ]);

  res.json({
    success: true,
    data: {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      usersByAccessLevel: usersByAccessLevel.reduce((acc, item) => {
        acc[item.accessLevel] = item._count.accessLevel;
        return acc;
      }, {}),
      recentLogins,
      activeSessions
    }
  });
}));

module.exports = router;