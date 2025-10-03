/**
 * Simple logging utility
 */

// Log levels
const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

/**
 * Format the log message with timestamp
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @returns {string} - Formatted log message
 */
function formatLog(level, message) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
}

/**
 * Log an error message
 * @param {string} message - Error message
 */
function logError(message) {
  console.error(formatLog(LOG_LEVELS.ERROR, message));
}

/**
 * Log a warning message
 * @param {string} message - Warning message
 */
function logWarn(message) {
  console.warn(formatLog(LOG_LEVELS.WARN, message));
}

/**
 * Log an info message
 * @param {string} message - Info message
 */
function logInfo(message) {
  console.info(formatLog(LOG_LEVELS.INFO, message));
}

/**
 * Log a debug message
 * @param {string} message - Debug message
 */
function logDebug(message) {
  if (process.env.NODE_ENV === 'development') {
    console.debug(formatLog(LOG_LEVELS.DEBUG, message));
  }
}

module.exports = {
  logError,
  logWarn,
  logInfo,
  logDebug
};