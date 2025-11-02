const express = require('express');
const axios = require('axios');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAdmin } = require('../middleware/auth');
const { validators } = require('../middleware/validation');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const { logSecurityEvent } = require('../middleware/security');

const router = express.Router();

// Apply admin requirement to all security routes
router.use(requireAdmin);

/**
 * GET /api/security/logs
 * Get security logs (admin only)
 */
router.get('/logs', validators.securityLogQuery, asyncHandler(async (req, res) => {
  const {
    startDate,
    endDate,
    eventType,
    userId,
    limit = 50,
    offset = 0
  } = req.query;

  // Build where clause
  const where = {};

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  if (eventType) {
    where.eventType = eventType;
  }

  if (userId) {
    where.userId = userId;
  }

  // Get logs with pagination
  const [logs, total] = await Promise.all([
    prisma.securityLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    }),
    prisma.securityLog.count({ where })
  ]);

  // Parse metadata for each log
  const formattedLogs = logs.map(log => ({
    ...log,
    metadata: log.metadata ? JSON.parse(log.metadata) : null,
    user: log.user || null
  }));

  res.json({
    success: true,
    data: {
      logs: formattedLogs,
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
 * GET /api/security/active-sessions
 * Get all active user sessions (admin only)
 */
router.get('/active-sessions', asyncHandler(async (req, res) => {
  const [userSessions, terminalSessions] = await Promise.all([
    // Active authentication sessions
    prisma.userSession.findMany({
      where: {
        isActive: true,
        expiresAt: {
          gte: new Date()
        }
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            accessLevel: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),

    // Active terminal sessions
    prisma.terminalSession.findMany({
      where: {
        isActive: true
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            accessLevel: true
          }
        }
      },
      orderBy: { lastActivity: 'desc' }
    })
  ]);

  // Format sessions data
  const activeUsers = new Map();

  // Process user sessions
  userSessions.forEach(session => {
    const userId = session.userId;
    if (!activeUsers.has(userId)) {
      activeUsers.set(userId, {
        user: session.user,
        authSessions: [],
        terminalSessions: [],
        lastActivity: session.createdAt
      });
    }
    activeUsers.get(userId).authSessions.push({
      id: session.id,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt
    });
    if (session.createdAt > activeUsers.get(userId).lastActivity) {
      activeUsers.get(userId).lastActivity = session.createdAt;
    }
  });

  // Process terminal sessions
  terminalSessions.forEach(session => {
    const userId = session.userId;
    if (!activeUsers.has(userId)) {
      activeUsers.set(userId, {
        user: session.user,
        authSessions: [],
        terminalSessions: [],
        lastActivity: session.lastActivity
      });
    }
    activeUsers.get(userId).terminalSessions.push({
      id: session.id,
      terminalType: session.terminalType,
      currentDirectory: session.currentDirectory,
      startedAt: session.startedAt,
      lastActivity: session.lastActivity
    });
    if (session.lastActivity > activeUsers.get(userId).lastActivity) {
      activeUsers.get(userId).lastActivity = session.lastActivity;
    }
  });

  const activeSessionsArray = Array.from(activeUsers.values())
    .sort((a, b) => b.lastActivity - a.lastActivity);

  res.json({
    success: true,
    data: {
      activeUsers: activeSessionsArray,
      totalAuthSessions: userSessions.length,
      totalTerminalSessions: terminalSessions.length,
      totalActiveUsers: activeUsers.size
    }
  });
}));

/**
 * GET /api/security/stats
 * Get security statistics (admin only)
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalLogs,
    recentLogs,
    logsByType,
    failedLogins,
    suspiciousActivity,
    uniqueIPs
  ] = await Promise.all([
    // Total security logs
    prisma.securityLog.count(),

    // Recent logs (last 24 hours)
    prisma.securityLog.count({
      where: {
        createdAt: { gte: dayAgo }
      }
    }),

    // Logs grouped by event type
    prisma.securityLog.groupBy({
      by: ['eventType'],
      _count: { eventType: true },
      orderBy: { _count: { eventType: 'desc' } }
    }),

    // Failed login attempts (last 24 hours)
    prisma.securityLog.count({
      where: {
        eventType: 'ACCESS_DENIED',
        createdAt: { gte: dayAgo }
      }
    }),

    // Suspicious activity (last week)
    prisma.securityLog.count({
      where: {
        eventType: 'SUSPICIOUS',
        createdAt: { gte: weekAgo }
      }
    }),

    // Unique IP addresses (last 24 hours)
    prisma.securityLog.findMany({
      where: {
        createdAt: { gte: dayAgo }
      },
      select: { ipAddress: true },
      distinct: ['ipAddress']
    })
  ]);

  // Get recent security events
  const recentEvents = await prisma.securityLog.findMany({
    where: {
      createdAt: { gte: dayAgo }
    },
    include: {
      user: {
        select: { username: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  const stats = {
    totalLogs,
    recentLogs,
    logsByType: logsByType.reduce((acc, item) => {
      acc[item.eventType] = item._count.eventType;
      return acc;
    }, {}),
    failedLogins,
    suspiciousActivity,
    uniqueIPs: uniqueIPs.length,
    recentEvents: recentEvents.map(event => ({
      id: event.id,
      eventType: event.eventType,
      description: event.description,
      ipAddress: event.ipAddress,
      username: event.user?.username || 'Anonymous',
      timestamp: event.createdAt
    }))
  };

  res.json({
    success: true,
    data: stats
  });
}));

/**
 * POST /api/security/webhook-test
 * Test Discord webhook integration (admin only)
 */
router.post('/webhook-test', validators.webhookTest, asyncHandler(async (req, res) => {
  const { message } = req.body;
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    return res.status(400).json({
      success: false,
      error: 'Discord webhook URL not configured'
    });
  }

  try {
    const payload = {
      embeds: [{
        title: '🔐 Security Test Message',
        description: message,
        color: 0x00ff00, // Green color for test
        timestamp: new Date().toISOString(),
        fields: [
          {
            name: 'Test Type',
            value: 'Manual Webhook Test',
            inline: true
          },
          {
            name: 'Environment',
            value: process.env.NODE_ENV || 'development',
            inline: true
          }
        ],
        footer: {
          text: 'Phoenix Industries Security System'
        }
      }]
    };

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    logger.info('Discord webhook test successful', {
      status: response.status,
      message: message
    });

    res.json({
      success: true,
      message: 'Webhook test sent successfully',
      data: {
        status: response.status,
        messageId: response.data.id || null
      }
    });
  } catch (error) {
    logger.error('Discord webhook test failed:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to send webhook test',
      details: error.message
    });
  }
}));

/**
 * POST /api/security/alert
 * Send custom security alert (admin only)
 */
router.post('/alert', asyncHandler(async (req, res) => {
  const { title, description, level = 'INFO', userId } = req.body;
  const adminUserId = req.user.id;

  if (!title || !description) {
    return res.status(400).json({
      success: false,
      error: 'Title and description are required'
    });
  }

  // Log custom security event
  await logSecurityEvent(
    req,
    adminUserId,
    level.toUpperCase(),
    'Admin alert: ' + title,
    {
      title,
      description,
      targetUserId: userId,
      manualAlert: true
    }
  );

  // Send Discord notification if configured
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const colors = {
        INFO: 0x0099ff,
        WARNING: 0xffaa00,
        ERROR: 0xff0000,
        CRITICAL: 0x990000
      };

      const payload = {
        embeds: [{
          title: '🚨 ' + title,
          description: description,
          color: colors[level] || colors.INFO,
          timestamp: new Date().toISOString(),
          fields: [
            {
              name: 'Alert Level',
              value: level.toUpperCase(),
              inline: true
            },
            {
              name: 'Issued By',
              value: req.user.username,
              inline: true
            }
          ],
          footer: {
            text: 'Phoenix Industries Security System'
          }
        }]
      };

      await axios.post(webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });

      logger.info('Security alert sent to Discord', { title, level });
    } catch (error) {
      logger.error('Failed to send security alert to Discord:', error);
    }
  }

  res.json({
    success: true,
    message: 'Security alert sent successfully',
    data: {
      title,
      level,
      timestamp: new Date().toISOString()
    }
  });
}));

/**
 * DELETE /api/security/sessions/:id
 * Terminate specific user session (admin only)
 */
router.delete('/sessions/:id', validators.uuid, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Simplified implementation for now
  return res.status(501).json({
    success: false,
    error: 'Session termination temporarily disabled'
  });
}));

module.exports = router;