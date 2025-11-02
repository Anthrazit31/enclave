const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const { logSecurityEvent } = require('../middleware/security');
const { generateUUID, sanitizeInput } = require('../utils/helpers');

/**
 * Create a new terminal session
 */
async function createTerminalSession(userId, terminalType, ipAddress, userAgent) {
  try {
    // Validate terminal type
    const validTerminalTypes = ['MILITARY', 'RESEARCHER', 'FILESYSTEM', 'EMERGENCY'];
    if (!validTerminalTypes.includes(terminalType)) {
      throw new Error('Invalid terminal type');
    }

    // Create session
    const session = await prisma.terminalSession.create({
      data: {
        userId: userId,
        terminalType: terminalType,
        sessionData: JSON.stringify({
          initialized: true,
          startTime: new Date().toISOString(),
          ipAddress: ipAddress,
          userAgent: userAgent
        }),
        commandHistory: JSON.stringify([]),
        currentDirectory: '/',
        isActive: true,
        startedAt: new Date(),
        lastActivity: new Date()
      }
    });

    // Log security event
    await logSecurityEvent(
      { security: { ip: ipAddress, userAgent: userAgent } },
      userId,
      'LOGIN',
      `Terminal session created: ${terminalType}`,
      { sessionId: session.id, terminalType }
    );

    logger.terminal(`Terminal session created: ${session.id} for user ${userId} (${terminalType})`);

    return session;
  } catch (error) {
    logger.error('Create terminal session error:', error);
    throw error;
  }
}

/**
 * Get terminal session by ID
 */
async function getTerminalSession(sessionId, userId) {
  try {
    const session = await prisma.terminalSession.findFirst({
      where: {
        id: sessionId,
        userId: userId,
        isActive: true
      }
    });

    if (!session) {
      throw new Error('Terminal session not found or inactive');
    }

    return session;
  } catch (error) {
    logger.error('Get terminal session error:', error);
    throw error;
  }
}

/**
 * Execute terminal command
 */
async function executeCommand(sessionId, userId, command, ipAddress, userAgent) {
  try {
    const session = await getTerminalSession(sessionId, userId);

    // Sanitize command input
    const sanitizedCommand = sanitizeInput(command);
    if (sanitizedCommand !== command) {
      logger.security(`Command sanitized: ${command} -> ${sanitizedCommand}`, {
        userId: userId,
        sessionId: sessionId
      });
    }

    // Parse command
    const parsedCommand = parseCommand(sanitizedCommand);

    // Execute command based on terminal type
    let result;
    switch (session.terminalType) {
      case 'FILESYSTEM':
        result = await executeFileSystemCommand(parsedCommand, session, userId);
        break;
      case 'MILITARY':
        result = await executeMilitaryCommand(parsedCommand, session, userId);
        break;
      case 'RESEARCHER':
        result = await executeResearcherCommand(parsedCommand, session, userId);
        break;
      case 'EMERGENCY':
        result = await executeEmergencyCommand(parsedCommand, session, userId);
        break;
      default:
        result = {
          output: `Unknown terminal type: ${session.terminalType}`,
          success: false
        };
    }

    // Update session data
    const commandHistory = JSON.parse(session.commandHistory || '[]');
    commandHistory.push({
      command: sanitizedCommand,
      timestamp: new Date().toISOString(),
      result: result.success ? 'success' : 'error'
    });

    // Keep only last 100 commands
    const limitedHistory = commandHistory.slice(-100);

    await prisma.terminalSession.update({
      where: { id: sessionId },
      data: {
        commandHistory: JSON.stringify(limitedHistory),
        lastActivity: new Date()
      }
    });

    // Log command execution
    await logSecurityEvent(
      { security: { ip: ipAddress, userAgent: userAgent } },
      userId,
      'COMMAND',
      `Command executed: ${sanitizedCommand}`,
      {
        sessionId: sessionId,
        terminalType: session.terminalType,
        success: result.success
      }
    );

    logger.terminal(`Command executed: ${sanitizedCommand} in session ${sessionId}`);

    return {
      command: sanitizedCommand,
      output: result.output,
      success: result.success,
      timestamp: new Date().toISOString(),
      sessionId: sessionId
    };
  } catch (error) {
    logger.error('Execute command error:', error);
    return {
      command: command,
      output: `Error: ${error.message}`,
      success: false,
      timestamp: new Date().toISOString(),
      sessionId: sessionId
    };
  }
}

/**
 * Parse command string into components
 */
function parseCommand(command) {
  const trimmed = command.trim();
  const parts = trimmed.split(/\s+/);

  return {
    command: parts[0]?.toLowerCase() || '',
    args: parts.slice(1),
    raw: trimmed
  };
}

/**
 * Execute filesystem commands
 */
async function executeFileSystemCommand(parsedCommand, session, userId) {
  const { command, args } = parsedCommand;

  switch (command) {
    case 'ls':
    case 'dir':
      return await handleListCommand(args, session, userId);

    case 'cd':
      return await handleChangeDirectoryCommand(args, session, userId);

    case 'cat':
    case 'type':
      return await handleReadFileCommand(args, session, userId);

    case 'pwd':
      return {
        output: session.currentDirectory || '/',
        success: true
      };

    case 'help':
      return {
        output: `Available commands:
  ls, dir - List directory contents
  cd <path> - Change directory
  cat, type <file> - Display file contents
  pwd - Print working directory
  help - Show this help message
  clear - Clear terminal screen`,
        success: true
      };

    case 'clear':
      return {
        output: '\x1B[2J\x1B[0f', // ANSI clear screen
        success: true
      };

    default:
      return {
        output: `Command not found: ${command}. Type 'help' for available commands.`,
        success: false
      };
  }
}

/**
 * Execute military terminal commands
 */
async function executeMilitaryCommand(parsedCommand, session, userId) {
  const { command, args } = parsedCommand;

  switch (command) {
    case 'status':
      return {
        output: `MILITARY TERMINAL STATUS
=======================
System: ONLINE
Security: ACTIVE
Clearance: VERIFIED
Last Sync: ${new Date().toISOString()}

Active Units: 12
Ready Units: 8
Deployed Units: 4`,
        success: true
      };

    case 'deploy':
      if (args.length === 0) {
        return {
          output: 'Usage: deploy <unit_id>',
          success: false
        };
      }
      return {
        output: `Unit ${args[0]} deployment initiated.
Authorization: GRANTED
ETA: 15 minutes
Status: PENDING`,
        success: true
      };

    case 'scan':
      return {
        output: `Scanning perimeter...
Network scan complete.
Hosts detected: 8
Threat level: MINIMAL
Security protocols: ACTIVE`,
        success: true
      };

    case 'help':
      return {
        output: `Military Commands:
  status - Show system status
  deploy <unit> - Deploy military unit
  scan - Perform network scan
  help - Show this help message
  clear - Clear terminal screen`,
        success: true
      };

    case 'clear':
      return {
        output: '\x1B[2J\x1B[0f',
        success: true
      };

    default:
      return {
        output: `Access denied. Command '${command}' not recognized.`,
        success: false
      };
  }
}

/**
 * Execute researcher terminal commands
 */
async function executeResearcherCommand(parsedCommand, session, userId) {
  const { command, args } = parsedCommand;

  switch (command) {
    case 'analyze':
      return {
        output: `RESEARCH ANALYSIS
=================
Sample Analysis: IN PROGRESS
Completion: 67%
Results: PENDING
Anomalies Detected: 2

Recommendation: Continue monitoring`,
        success: true
      };

    case 'research':
      return {
        output: `Current Research Projects:
1. Project Phoenix - System Integration
2. Security Protocol Enhancement
3. Data Analysis Optimization

All projects proceeding normally.`,
        success: true
      };

    case 'data':
      return {
        output: `Database Statistics:
  Records: 1,247,892
  Queries Today: 3,421
  Response Time: 12ms average
  Status: OPTIMAL`,
        success: true
      };

    case 'help':
      return {
        output: `Research Commands:
  analyze - Perform data analysis
  research - Show current projects
  data - Display database statistics
  help - Show this help message
  clear - Clear terminal screen`,
        success: true
      };

    case 'clear':
      return {
        output: '\x1B[2J\x1B[0f',
        success: true
      };

    default:
      return {
        output: `Research module cannot process: ${command}`,
        success: false
      };
  }
}

/**
 * Execute emergency terminal commands
 */
async function executeEmergencyCommand(parsedCommand, session, userId) {
  const { command, args } = parsedCommand;

  switch (command) {
    case 'status':
      return {
        output: `⚠️ EMERGENCY SYSTEM STATUS ⚠️
============================
Alert Level: ${Math.random() > 0.7 ? 'CRITICAL' : 'WARNING'}
Systems: DEGRADED
Evacuation: STANDBY
Emergency Power: ${Math.random() > 0.5 ? 'ONLINE' : 'OFFLINE'}

⚠️ Proceed with caution`,
        success: true
      };

    case 'emergency':
      return {
        output: `EMERGENCY PROTOCOLS ACTIVATED
================================
All non-essential systems SHUTDOWN
Emergency lighting: ONLINE
Evacuation routes: CLEAR
Communication: EMERGENCY CHANNEL ONLY

Stay calm. Follow procedures.`,
        success: true
      };

    case 'report':
      return {
        output: `EMERGENCY REPORT
================
Time: ${new Date().toISOString()}
Status: System Emergency
Cause: Unknown
Response: Emergency protocols engaged
Casualties: Unknown

Report transmitted to command.`,
        success: true
      };

    case 'help':
      return {
        output: `Emergency Commands:
  status - Emergency status
  emergency - Activate emergency protocols
  report - Send emergency report
  help - Show this help message
  clear - Clear terminal screen`,
        success: true
      };

    case 'clear':
      return {
        output: '\x1B[2J\x1B[0f',
        success: true
      };

    default:
      return {
        output: `EMERGENCY: Command '${command}' not available in emergency mode.`,
        success: false
      };
  }
}

/**
 * Handle list directory command
 */
async function handleListCommand(args, session, userId) {
  try {
    const currentPath = session.currentDirectory || '/';

    // Get files and directories from database
    const items = await prisma.fileSystem.findMany({
      where: {
        path: {
          startsWith: currentPath === '/' ? '' : currentPath
        },
        isActive: true,
        parentId: currentPath === '/' ? null : undefined
      },
      select: {
        name: true,
        type: true,
        path: true,
        accessLevel: true,
        updatedAt: true
      }
    });

    if (items.length === 0) {
      return {
        output: 'Directory is empty.',
        success: true
      };
    }

    // Format output
    let output = '';
    items.forEach(item => {
      const prefix = item.type === 'DIRECTORY' ? 'DIR' : 'FILE';
      const date = new Date(item.updatedAt).toLocaleDateString();
      output += `${prefix.padEnd(4)} ${item.name.padEnd(20)} ${date}\n`;
    });

    return {
      output: output.trim(),
      success: true
    };
  } catch (error) {
    return {
      output: `Error listing directory: ${error.message}`,
      success: false
    };
  }
}

/**
 * Handle change directory command
 */
async function handleChangeDirectoryCommand(args, session, userId) {
  try {
    if (args.length === 0) {
      return {
        output: 'Usage: cd <directory>',
        success: false
      };
    }

    const targetPath = args[0];
    let newPath;

    if (targetPath === '..') {
      // Go up one directory
      const currentPath = session.currentDirectory || '/';
      const parts = currentPath.split('/').filter(Boolean);
      parts.pop();
      newPath = '/' + parts.join('/');
      if (newPath === '/') newPath = '/';
    } else if (targetPath === '/') {
      // Go to root
      newPath = '/';
    } else if (targetPath.startsWith('/')) {
      // Absolute path
      newPath = targetPath;
    } else {
      // Relative path
      const currentPath = session.currentDirectory || '/';
      newPath = currentPath === '/' ? `/${targetPath}` : `${currentPath}/${targetPath}`;
    }

    // Check if directory exists
    const directory = await prisma.fileSystem.findFirst({
      where: {
        path: newPath,
        type: 'DIRECTORY',
        isActive: true
      }
    });

    if (!directory) {
      return {
        output: `Directory not found: ${targetPath}`,
        success: false
      };
    }

    // Update session
    await prisma.terminalSession.update({
      where: { id: session.id },
      data: { currentDirectory: newPath }
    });

    return {
      output: `Changed directory to: ${newPath}`,
      success: true
    };
  } catch (error) {
    return {
      output: `Error changing directory: ${error.message}`,
      success: false
    };
  }
}

/**
 * Handle read file command
 */
async function handleReadFileCommand(args, session, userId) {
  try {
    if (args.length === 0) {
      return {
        output: 'Usage: cat <filename>',
        success: false
      };
    }

    const filename = args[0];
    const currentPath = session.currentDirectory || '/';
    const filePath = currentPath === '/' ? `/${filename}` : `${currentPath}/${filename}`;

    // Get file from database
    const file = await prisma.fileSystem.findFirst({
      where: {
        path: filePath,
        type: 'FILE',
        isActive: true
      }
    });

    if (!file) {
      return {
        output: `File not found: ${filename}`,
        success: false
      };
    }

    return {
      output: file.content || '',
      success: true
    };
  } catch (error) {
    return {
      output: `Error reading file: ${error.message}`,
      success: false
    };
  }
}

/**
 * End terminal session
 */
async function endTerminalSession(sessionId, userId) {
  try {
    const session = await prisma.terminalSession.update({
      where: {
        id: sessionId,
        userId: userId
      },
      data: {
        isActive: false,
        lastActivity: new Date()
      }
    });

    logger.terminal(`Terminal session ended: ${sessionId} for user ${userId}`);

    return session;
  } catch (error) {
    logger.error('End terminal session error:', error);
    throw error;
  }
}

/**
 * Get active terminal sessions for user
 */
async function getUserTerminalSessions(userId) {
  try {
    const sessions = await prisma.terminalSession.findMany({
      where: {
        userId: userId,
        isActive: true
      },
      select: {
        id: true,
        terminalType: true,
        currentDirectory: true,
        startedAt: true,
        lastActivity: true
      },
      orderBy: { startedAt: 'desc' }
    });

    return sessions;
  } catch (error) {
    logger.error('Get user terminal sessions error:', error);
    throw error;
  }
}

module.exports = {
  createTerminalSession,
  getTerminalSession,
  executeCommand,
  endTerminalSession,
  getUserTerminalSessions
};