/**
 * Phoenix Industries Terminal Integration
 * Bridges existing terminal interfaces with the new backend system
 */

class PhoenixTerminal {
  constructor(options = {}) {
    this.sessionId = null;
    this.terminalType = options.terminalType || 'RESEARCHER';
    this.commandHistory = [];
    this.currentDirectory = '/';
    this.isActive = false;
    this.outputCallback = options.outputCallback || null;
    this.sessionEndedCallback = options.sessionEndedCallback || null;
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
  }

  /**
   * Initialize terminal session
   */
  async initialize() {
    try {
      if (!window.phoenixAPI.checkAuthentication()) {
        throw new Error('User not authenticated');
      }

      const response = await window.phoenixAPI.createTerminalSession(this.terminalType);

      if (response.success) {
        this.sessionId = response.data.sessionId;
        this.currentDirectory = response.data.currentDirectory || '/';
        this.isActive = true;
        this.reconnectAttempts = 0;

        // Connect to socket for real-time communication
        this.connectSocket();

        // Join terminal room
        if (this.socket) {
          const userInfo = window.phoenixAPI.getUserInfo();
          this.socket.emit('join-terminal', {
            userId: userInfo.userId,
            terminalType: this.terminalType
          });
        }

        this.output(`\n=== Phoenix Industries Terminal System ===\n`);
        this.output(`Terminal: ${this.terminalType}\n`);
        this.output(`Session: ${this.sessionId}\n`);
        this.output(`User: ${window.phoenixAPI.getUserInfo()?.username}\n`);
        this.output(`Type 'help' for available commands\n\n`);

        return true;
      } else {
        throw new Error(response.error || 'Failed to create terminal session');
      }
    } catch (error) {
      console.error('Terminal initialization failed:', error);
      this.output(`ERROR: ${error.message}\n`);
      return false;
    }
  }

  /**
   * Connect to Socket.io for real-time communication
   */
  connectSocket() {
    try {
      this.socket = window.phoenixAPI.connectSocket();

      // Override the global command result handler for this instance
      this.socket.on('command-result', (data) => {
        if (data.sessionId === this.sessionId) {
          this.handleCommandResult(data);
        }
      });

      this.socket.on('session-ended', (data) => {
        if (data.sessionId === this.sessionId) {
          this.handleSessionEnded(data);
        }
      });

      this.socket.on('disconnect', () => {
        this.output('WARNING: Connection to server lost\n');
        this.scheduleReconnect();
      });

      this.socket.on('reconnect', () => {
        this.output('INFO: Connection to server restored\n');
        this.reconnectAttempts = 0;
      });

    } catch (error) {
      console.error('Socket connection failed:', error);
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff

      this.output(`Attempting to reconnect in ${delay / 1000} seconds... (${this.reconnectAttempts}/${this.maxReconnectAttempts})\n`);

      setTimeout(() => {
        this.connectSocket();
      }, delay);
    } else {
      this.output('ERROR: Maximum reconnection attempts reached. Please refresh the page.\n');
    }
  }

  /**
   * Execute a terminal command
   */
  async executeCommand(commandText) {
    if (!this.isActive || !this.sessionId) {
      this.output('ERROR: Terminal session not active\n');
      return;
    }

    // Add to local history
    this.commandHistory.push({
      command: commandText,
      timestamp: new Date().toISOString()
    });

    try {
      // Use Socket.io for real-time communication if available
      if (this.socket && this.socket.connected) {
        this.socket.emit('terminal-command', {
          userId: window.phoenixAPI.getUserInfo()?.userId,
          command: commandText,
          terminalType: this.terminalType,
          sessionId: this.sessionId
        });
      } else {
        // Fallback to HTTP API
        const result = await window.phoenixAPI.executeTerminalCommand(this.sessionId, commandText);
        this.handleCommandResult(result);
      }
    } catch (error) {
      console.error('Command execution failed:', error);
      this.output(`ERROR: ${error.message}\n`);
    }
  }

  /**
   * Handle command result from server
   */
  handleCommandResult(result) {
    if (result.output) {
      this.output(result.output + '\n');
    }

    if (!result.success) {
      this.output(`Command failed: ${result.error || 'Unknown error'}\n`);
    }

    // Update current directory if changed
    if (result.currentDirectory) {
      this.currentDirectory = result.currentDirectory;
    }
  }

  /**
   * Handle session ended event
   */
  handleSessionEnded(data) {
    this.output('\n=== TERMINAL SESSION ENDED ===\n');
    this.output('Session terminated by administrator\n');
    this.isActive = false;
    this.sessionId = null;

    if (this.sessionEndedCallback) {
      this.sessionEndedCallback(data);
    }
  }

  /**
   * End the terminal session
   */
  async endSession() {
    try {
      if (this.sessionId) {
        await window.phoenixAPI.endTerminalSession(this.sessionId);
      }
    } catch (error) {
      console.error('Failed to end session:', error);
    } finally {
      this.cleanup();
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.isActive = false;
    this.sessionId = null;

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Output text to terminal (can be overridden)
   */
  output(text) {
    if (this.outputCallback) {
      this.outputCallback(text);
    } else {
      console.log('Terminal Output:', text);
    }
  }

  /**
   * Get current terminal state
   */
  getState() {
    return {
      sessionId: this.sessionId,
      terminalType: this.terminalType,
      isActive: this.isActive,
      currentDirectory: this.currentDirectory,
      commandHistory: this.commandHistory.slice(-10) // Last 10 commands
    };
  }

  /**
   * Legacy compatibility for existing terminal code
   */
  // Map old hardcoded access codes to new terminal types
  getTerminalTypeFromAccessCode(accessCode) {
    const mapping = {
      'PHOENIX2024': 'ADMIN',
      'MILITARY2024': 'MILITARY',
      'RESEARCH2024': 'RESEARCHER',
      'HYBRID2024': 'MILITARYRESEARCHER',
      'SYSTEM2024': 'FILESYSTEM'
    };

    return mapping[accessCode.toUpperCase()] || 'RESEARCHER';
  }

  // Simulate old terminal login flow
  async loginWithAccessCode(accessCode) {
    try {
      // First authenticate with the API
      await window.phoenixAPI.authenticateWithPassword(accessCode);

      // Determine terminal type based on access code
      this.terminalType = this.getTerminalTypeFromAccessCode(accessCode);

      // Initialize terminal session
      return await this.initialize();
    } catch (error) {
      console.error('Login failed:', error);
      this.output(`LOGIN FAILED: ${error.message}\n`);
      return false;
    }
  }
}

/**
 * Global terminal manager for handling multiple terminal instances
 */
class PhoenixTerminalManager {
  constructor() {
    this.terminals = new Map();
    this.activeTerminal = null;
  }

  createTerminal(id, options = {}) {
    const terminal = new PhoenixTerminal(options);
    this.terminals.set(id, terminal);
    return terminal;
  }

  getTerminal(id) {
    return this.terminals.get(id);
  }

  setActiveTerminal(id) {
    this.activeTerminal = this.terminals.get(id);
    if (this.activeTerminal) {
      window.phoenixTerminal = this.activeTerminal;
    }
  }

  getActiveTerminal() {
    return this.activeTerminal;
  }

  closeTerminal(id) {
    const terminal = this.terminals.get(id);
    if (terminal) {
      terminal.endSession();
      this.terminals.delete(id);

      if (this.activeTerminal === terminal) {
        this.activeTerminal = null;
        window.phoenixTerminal = null;
      }
    }
  }

  closeAllTerminals() {
    for (const [id, terminal] of this.terminals) {
      terminal.endSession();
    }
    this.terminals.clear();
    this.activeTerminal = null;
    window.phoenixTerminal = null;
  }
}

// Create global instances
window.phoenixTerminalManager = new PhoenixTerminalManager();
window.phoenixTerminal = null; // Will be set when a terminal becomes active

// Auto-cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.phoenixTerminalManager) {
    window.phoenixTerminalManager.closeAllTerminals();
  }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PhoenixTerminal, PhoenixTerminalManager };
}