const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { validators } = require('../middleware/validation');
const terminalService = require('../services/terminalService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/terminal/sessions
 * Create a new terminal session
 */
router.post('/sessions', validators.createTerminalSession, asyncHandler(async (req, res) => {
  const { terminalType } = req.body;
  const userId = req.user.id;
  const ipAddress = req.security.ip;
  const userAgent = req.security.userAgent;

  logger.terminal(`Creating terminal session: ${terminalType} for user ${userId}`);

  const session = await terminalService.createTerminalSession(
    userId,
    terminalType,
    ipAddress,
    userAgent
  );

  res.status(201).json({
    success: true,
    message: 'Terminal session created successfully',
    data: {
      sessionId: session.id,
      terminalType: session.terminalType,
      currentDirectory: session.currentDirectory,
      startedAt: session.startedAt
    }
  });
}));

/**
 * GET /api/terminal/sessions
 * Get all active terminal sessions for current user
 */
router.get('/sessions', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const sessions = await terminalService.getUserTerminalSessions(userId);

  res.json({
    success: true,
    data: {
      sessions,
      count: sessions.length
    }
  });
}));

/**
 * GET /api/terminal/sessions/:id
 * Get specific terminal session details
 */
router.get('/sessions/:id', validators.uuid, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const session = await terminalService.getTerminalSession(id, userId);

  const sessionData = {
    id: session.id,
    terminalType: session.terminalType,
    currentDirectory: session.currentDirectory,
    startedAt: session.startedAt,
    lastActivity: session.lastActivity,
    commandHistory: JSON.parse(session.commandHistory || '[]')
  };

  res.json({
    success: true,
    data: { session: sessionData }
  });
}));

/**
 * POST /api/terminal/sessions/:id/commands
 * Execute a command in a terminal session
 */
router.post('/sessions/:id/commands', validators.uuid, validators.executeCommand, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { command } = req.body;
  const userId = req.user.id;
  const ipAddress = req.security.ip;
  const userAgent = req.security.userAgent;

  logger.terminal(`Executing command: ${command} in session ${id}`);

  const result = await terminalService.executeCommand(
    id,
    userId,
    command,
    ipAddress,
    userAgent
  );

  // Get Socket.IO instance and emit to user's room
  const io = req.app.get('io');
  if (io) {
    io.to(`terminal-${userId}`).emit('command-result', result);
  }

  res.json({
    success: true,
    message: 'Command executed successfully',
    data: result
  });
}));

/**
 * DELETE /api/terminal/sessions/:id
 * End a terminal session
 */
router.delete('/sessions/:id', validators.uuid, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  await terminalService.endTerminalSession(id, userId);

  // Get Socket.IO instance and emit session end
  const io = req.app.get('io');
  if (io) {
    io.to(`terminal-${userId}`).emit('session-ended', { sessionId: id });
  }

  res.json({
    success: true,
    message: 'Terminal session ended successfully'
  });
}));

/**
 * GET /api/terminal/filesystem
 * Browse file system (for terminal file operations)
 */
router.get('/filesystem', asyncHandler(async (req, res) => {
  const { path = '/' } = req.query;
  const userId = req.user.id;
  const userAccessLevel = req.user.accessLevel;

  // Get file system items from database
  const { prisma } = require('../config/database');

  let items;
  if (path === '/') {
    // Root directory - show top-level directories
    items = await prisma.fileSystem.findMany({
      where: {
        parentId: null,
        isActive: true,
        OR: [
          { accessLevel: 'PUBLIC' },
          { accessLevel: userAccessLevel },
          { accessLevel: 'ADMIN' }
        ]
      },
      select: {
        id: true,
        name: true,
        path: true,
        type: true,
        accessLevel: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [
        { type: 'asc' }, // Directories first
        { name: 'asc' }  // Then alphabetically
      ]
    });
  } else {
    // Specific directory
    const currentDir = await prisma.fileSystem.findFirst({
      where: {
        path: path,
        type: 'DIRECTORY',
        isActive: true,
        OR: [
          { accessLevel: 'PUBLIC' },
          { accessLevel: userAccessLevel },
          { accessLevel: 'ADMIN' }
        ]
      }
    });

    if (!currentDir) {
      return res.status(404).json({
        success: false,
        error: 'Directory not found or access denied'
      });
    }

    items = await prisma.fileSystem.findMany({
      where: {
        parentId: currentDir.id,
        isActive: true,
        OR: [
          { accessLevel: 'PUBLIC' },
          { accessLevel: userAccessLevel },
          { accessLevel: 'ADMIN' }
        ]
      },
      select: {
        id: true,
        name: true,
        path: true,
        type: true,
        accessLevel: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [
        { type: 'asc' },
        { name: 'asc' }
      ]
    });
  }

  res.json({
    success: true,
    data: {
      path,
      items,
      count: items.length
    }
  });
}));

/**
 * GET /api/terminal/filesystem/:path
 * Get file content
 */
router.get('/filesystem/*', asyncHandler(async (req, res) => {
  const filePath = '/' + req.params[0]; // Get everything after /filesystem/
  const userId = req.user.id;
  const userAccessLevel = req.user.accessLevel;

  const { prisma } = require('../config/database');

  const file = await prisma.fileSystem.findFirst({
    where: {
      path: filePath,
      type: 'FILE',
      isActive: true,
      OR: [
        { accessLevel: 'PUBLIC' },
        { accessLevel: userAccessLevel },
        { accessLevel: 'ADMIN' }
      ]
    },
    select: {
      id: true,
      name: true,
      path: true,
      content: true,
      accessLevel: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!file) {
    return res.status(404).json({
      success: false,
      error: 'File not found or access denied'
    });
  }

  res.json({
    success: true,
    data: { file }
  });
}));

/**
 * POST /api/terminal/filesystem
 * Create new file or directory (admin only)
 */
router.post('/filesystem', require('./auth').requireAdmin, validators.createFile, asyncHandler(async (req, res) => {
  const { name, path, type, content, parentId, accessLevel } = req.body;
  const userId = req.user.id;

  const { prisma } = require('../config/database');

  // Check if path already exists
  const existing = await prisma.fileSystem.findFirst({
    where: { path }
  });

  if (existing) {
    return res.status(409).json({
      success: false,
      error: 'File or directory already exists at this path'
    });
  }

  // Create file or directory
  const newItem = await prisma.fileSystem.create({
    data: {
      name,
      path,
      type: type || 'FILE',
      content: type === 'FILE' ? content || '' : null,
      parentId: parentId || null,
      accessLevel: accessLevel?.toUpperCase() || 'PUBLIC'
    }
  });

  logger.terminal(`${type} created: ${path} by user ${userId}`);

  res.status(201).json({
    success: true,
    message: `${type} created successfully`,
    data: { item: newItem }
  });
}));

/**
 * PUT /api/terminal/filesystem/:id
 * Update file or directory (admin only)
 */
router.put('/filesystem/:id', require('./auth').requireAdmin, validators.uuid, validators.updateFile, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, content, accessLevel } = req.body;
  const userId = req.user.id;

  const { prisma } = require('../config/database');

  // Check if file exists
  const existing = await prisma.fileSystem.findUnique({
    where: { id }
  });

  if (!existing) {
    return res.status(404).json({
      success: false,
      error: 'File or directory not found'
    });
  }

  // Prepare update data
  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (content !== undefined && existing.type === 'FILE') updateData.content = content;
  if (accessLevel !== undefined) updateData.accessLevel = accessLevel.toUpperCase();

  const updatedItem = await prisma.fileSystem.update({
    where: { id },
    data: updateData
  });

  logger.terminal(`File updated: ${existing.path} by user ${userId}`);

  res.json({
    success: true,
    message: 'File updated successfully',
    data: { item: updatedItem }
  });
}));

/**
 * DELETE /api/terminal/filesystem/:id
 * Delete file or directory (admin only)
 */
router.delete('/filesystem/:id', require('./auth').requireAdmin, validators.uuid, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const { prisma } = require('../config/database');

  // Check if file exists
  const existing = await prisma.fileSystem.findUnique({
    where: { id }
  });

  if (!existing) {
    return res.status(404).json({
      success: false,
      error: 'File or directory not found'
    });
  }

  // Soft delete (set inactive)
  await prisma.fileSystem.update({
    where: { id },
    data: { isActive: false }
  });

  logger.terminal(`File deleted: ${existing.path} by user ${userId}`);

  res.json({
    success: true,
    message: 'File deleted successfully'
  });
}));

/**
 * GET /api/terminal/commands/history
 * Get command history for user's sessions
 */
router.get('/commands/history', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { limit = 50, sessionId } = req.query;

  const { prisma } = require('../config/database');

  const whereClause = {
    userId: userId,
    isActive: true
  };

  if (sessionId) {
    whereClause.id = sessionId;
  }

  const sessions = await prisma.terminalSession.findMany({
    where: whereClause,
    select: {
      id: true,
      terminalType: true,
      commandHistory: true,
      startedAt: true,
      lastActivity: true
    },
    orderBy: { lastActivity: 'desc' },
    take: parseInt(limit)
  });

  // Combine and format command history
  const allCommands = [];
  sessions.forEach(session => {
    const commands = JSON.parse(session.commandHistory || '[]');
    commands.forEach(command => {
      allCommands.push({
        ...command,
        sessionId: session.id,
        terminalType: session.terminalType
      });
    });
  });

  // Sort by timestamp and limit
  const sortedCommands = allCommands
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, parseInt(limit));

  res.json({
    success: true,
    data: {
      commands: sortedCommands,
      count: sortedCommands.length
    }
  });
}));

module.exports = router;