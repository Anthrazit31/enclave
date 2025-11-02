const Joi = require('joi');
const logger = require('../utils/logger');

/**
 * Request validation middleware factory
 */
function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // Return all errors
      stripUnknown: true, // Remove unknown fields
      convert: true // Convert types automatically
    });

    if (error) {
      logger.warn('Validation error', {
        property: property,
        errors: error.details,
        input: req[property]
      });

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context.value
        }))
      });
    }

    // Replace the request property with validated and cleaned data
    req[property] = value;
    next();
  };
}

// Common validation schemas
const schemas = {
  // Authentication schemas
  login: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(6).max(128).required()
  }),

  register: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(128).required(),
    accessLevel: Joi.string().valid('MILITARY', 'RESEARCHER', 'MILITARYRESEARCHER', 'ADMIN').default('RESEARCHER')
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string().required()
  }),

  // User management schemas
  updateProfile: Joi.object({
    username: Joi.string().alphanum().min(3).max(30),
    email: Joi.string().email()
  }).min(1),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).max(128).required()
  }),

  // Terminal schemas
  createTerminalSession: Joi.object({
    terminalType: Joi.string().valid('MILITARY', 'RESEARCHER', 'FILESYSTEM', 'EMERGENCY').required()
  }),

  executeCommand: Joi.object({
    command: Joi.string().min(1).max(1000).required(),
    sessionId: Joi.string().uuid().required()
  }),

  // File system schemas
  createFile: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    path: Joi.string().min(1).max(500).required(),
    type: Joi.string().valid('FILE', 'DIRECTORY').default('FILE'),
    content: Joi.string().max(1000000), // 1MB max content
    parentId: Joi.string().uuid().allow(null),
    accessLevel: Joi.string().valid('PUBLIC', 'MILITARY', 'RESEARCHER', 'ADMIN').default('PUBLIC')
  }),

  updateFile: Joi.object({
    name: Joi.string().min(1).max(255),
    content: Joi.string().max(1000000),
    accessLevel: Joi.string().valid('PUBLIC', 'MILITARY', 'RESEARCHER', 'ADMIN')
  }).min(1),

  // Security schemas
  securityLogQuery: Joi.object({
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')),
    eventType: Joi.string().valid('LOGIN', 'LOGOUT', 'COMMAND', 'ACCESS_DENIED', 'SUSPICIOUS'),
    userId: Joi.string().uuid(),
    limit: Joi.number().integer().min(1).max(100).default(50),
    offset: Joi.number().integer().min(0).default(0)
  }),

  // Common query schemas
  pagination: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0),
    sortBy: Joi.string(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }),

  uuid: Joi.object({
    id: Joi.string().uuid().required()
  }),

  // Discord webhook test
  webhookTest: Joi.object({
    message: Joi.string().min(1).max(1000).required()
  })
};

/**
 * Custom validation functions
 */
const customValidators = {
  // Validate password strength
  strongPassword: (value, helpers) => {
    if (!value) return helpers.error('any.required');

    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasNumber = /\d/.test(value);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value);
    const isLongEnough = value.length >= 8;

    if (!isLongEnough) {
      return helpers.error('password.length');
    }

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      return helpers.error('password.strength');
    }

    return value;
  },

  // Validate username uniqueness (async)
  uniqueUsername: async (value, helpers) => {
    try {
      const { prisma } = require('../config/database');
      const existing = await prisma.user.findUnique({
        where: { username: value }
      });

      if (existing) {
        return helpers.error('username.unique');
      }

      return value;
    } catch (error) {
      return helpers.error('username.check');
    }
  },

  // Validate email uniqueness (async)
  uniqueEmail: async (value, helpers) => {
    try {
      const { prisma } = require('../config/database');
      const existing = await prisma.user.findUnique({
        where: { email: value }
      });

      if (existing) {
        return helpers.error('email.unique');
      }

      return value;
    } catch (error) {
      return helpers.error('email.check');
    }
  }
};

// Enhanced schemas with custom validation
const enhancedSchemas = {
  register: schemas.register.keys({
    password: Joi.string()
      .min(8)
      .max(128)
      .custom(customValidators.strongPassword, 'Password strength validation')
      .required()
  })
};

/**
 * Validation middleware for specific use cases
 */
const validators = {
  login: validate(schemas.login),
  register: validate(enhancedSchemas.register),
  refreshToken: validate(schemas.refreshToken),
  updateProfile: validate(schemas.updateProfile),
  changePassword: validate(schemas.changePassword),
  createTerminalSession: validate(schemas.createTerminalSession),
  executeCommand: validate(schemas.executeCommand),
  createFile: validate(schemas.createFile),
  updateFile: validate(schemas.updateFile),
  securityLogQuery: validate(schemas.securityLogQuery, 'query'),
  pagination: validate(schemas.pagination, 'query'),
  uuid: validate(schemas.uuid, 'params'),
  webhookTest: validate(schemas.webhookTest)
};

module.exports = {
  validate,
  schemas,
  enhancedSchemas,
  customValidators,
  validators
};