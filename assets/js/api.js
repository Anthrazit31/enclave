/**
 * Phoenix Industries API Client
 * Handles all communication with the backend server
 */

class PhoenixAPI {
  constructor() {
    this.baseURL = 'http://localhost:3000/api';
    this.accessToken = null;
    this.refreshToken = null;
    this.socket = null;

    // Load tokens from localStorage on initialization
    this.loadTokensFromStorage();
  }

  /**
   * Load tokens from localStorage
   */
  loadTokensFromStorage() {
    this.accessToken = localStorage.getItem('phoenix_access_token');
    this.refreshToken = localStorage.getItem('phoenix_refresh_token');
  }

  /**
   * Save tokens to localStorage
   */
  saveTokensToStorage(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('phoenix_access_token', accessToken);
    localStorage.setItem('phoenix_refresh_token', refreshToken);
  }

  /**
   * Clear tokens from storage
   */
  clearTokensFromStorage() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('phoenix_access_token');
    localStorage.removeItem('phoenix_refresh_token');
  }

  /**
   * Make HTTP request with proper headers and error handling
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    // Add authorization header if token exists
    if (this.accessToken) {
      config.headers.Authorization = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      // Handle token refresh if access token expired
      if (response.status === 401 && data.code === 'TOKEN_EXPIRED') {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry original request with new token
          config.headers.Authorization = `Bearer ${this.accessToken}`;
          const retryResponse = await fetch(url, config);
          return await retryResponse.json();
        }
      }

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken() {
    if (!this.refreshToken) {
      this.clearTokensFromStorage();
      return false;
    }

    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken: this.refreshToken })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        this.saveTokensToStorage(data.data.accessToken, data.data.refreshToken);
        return true;
      } else {
        this.clearTokensFromStorage();
        return false;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearTokensFromStorage();
      return false;
    }
  }

  /**
   * Authentication methods
   */
  async login(username, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    if (data.success) {
      this.saveTokensToStorage(data.data.accessToken, data.data.refreshToken);
    }

    return data;
  }

  async register(username, email, password, accessLevel = 'RESEARCHER') {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, accessLevel })
    });
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      this.clearTokensFromStorage();
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
    }
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  async changePassword(currentPassword, newPassword) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  }

  /**
   * Terminal methods
   */
  async createTerminalSession(terminalType) {
    return this.request('/terminal/sessions', {
      method: 'POST',
      body: JSON.stringify({ terminalType })
    });
  }

  async getTerminalSession(sessionId) {
    return this.request(`/terminal/sessions/${sessionId}`);
  }

  async executeTerminalCommand(sessionId, command) {
    return this.request(`/terminal/sessions/${sessionId}/commands`, {
      method: 'POST',
      body: JSON.stringify({ command, sessionId })
    });
  }

  async endTerminalSession(sessionId) {
    return this.request(`/terminal/sessions/${sessionId}`, {
      method: 'DELETE'
    });
  }

  async getFileSystem(path = '/') {
    return this.request(`/terminal/filesystem?path=${encodeURIComponent(path)}`);
  }

  async getFileContent(path) {
    return this.request(`/terminal/filesystem${path}`);
  }

  /**
   * User management methods (admin only)
   */
  async getUsers(options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/users?${params}`);
  }

  async getUser(userId) {
    return this.request(`/users/${userId}`);
  }

  async updateUser(userId, updates) {
    return this.request(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async deactivateUser(userId) {
    return this.request(`/users/${userId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Security methods (admin only)
   */
  async getSecurityLogs(options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/security/logs?${params}`);
  }

  async getActiveSessions() {
    return this.request('/security/active-sessions');
  }

  async getSecurityStats() {
    return this.request('/security/stats');
  }

  async sendSecurityAlert(title, description, level = 'INFO') {
    return this.request('/security/alert', {
      method: 'POST',
      body: JSON.stringify({ title, description, level })
    });
  }

  /**
   * Socket.io connection for real-time terminal communication
   */
  connectSocket() {
    if (this.socket) {
      return this.socket;
    }

    this.socket = io('http://localhost:3000', {
      auth: {
        token: this.accessToken
      }
    });

    this.socket.on('connect', () => {
      console.log('Connected to Phoenix Industries server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from Phoenix Industries server');
    });

    this.socket.on('command-result', (data) => {
      // This will be handled by terminal instances
      window.phoenixTerminal?.handleCommandResult(data);
    });

    this.socket.on('session-ended', (data) => {
      // This will be handled by terminal instances
      window.phoenixTerminal?.handleSessionEnded(data);
    });

    return this.socket;
  }

  disconnectSocket() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Legacy compatibility methods for existing frontend code
   */
  async authenticateWithPassword(password) {
    // Map old hardcoded passwords to new authentication system
    const credentials = {
      // Admin access
      'ADMIN': { username: 'admin', password: 'admin123' },
      'PHOENIX2024': { username: 'admin', password: 'admin123' },
      
      // Military access
      'ENCLAVE': { username: 'military', password: 'military123' },
      'MILITARY2024': { username: 'military', password: 'military123' },
      'FPPWJFUCXYMWI22MWFZZRG0BVMT6YU8SVU0MB1FC': { username: 'military', password: 'military123' },
      
      // Research access
      'ARASTIRMA': { username: 'researcher', password: 'researcher123' },
      'RESEARCH2024': { username: 'researcher', password: 'researcher123' },
      '1561': { username: 'researcher', password: 'researcher123' },
      '1603': { username: 'researcher', password: 'researcher123' },
      
      // Hybrid access
      'HYBRID2024': { username: 'hybrid', password: 'hybrid123' },
      'SYSTEM2024': { username: 'researcher', password: 'researcher123' }
    };

    const creds = credentials[password.toUpperCase()];
    if (!creds) {
      throw new Error('Invalid access credentials');
    }

    return this.login(creds.username, creds.password);
  }

  checkAuthentication() {
    return !!this.accessToken;
  }

  getUserInfo() {
    if (!this.accessToken) {
      return null;
    }

    try {
      const payload = JSON.parse(atob(this.accessToken.split('.')[1]));
      return {
        userId: payload.userId,
        username: payload.username,
        accessLevel: payload.accessLevel
      };
    } catch (error) {
      console.error('Failed to parse token:', error);
      return null;
    }
  }
}

// Create global API instance
window.phoenixAPI = new PhoenixAPI();

// Auto-initialize socket connection if user is authenticated
if (window.phoenixAPI.checkAuthentication()) {
  window.phoenixAPI.connectSocket();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PhoenixAPI;
}