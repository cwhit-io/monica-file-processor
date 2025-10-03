const fs = require('fs');
const path = require('path');

/**
 * Ensures that a directory exists, creating it if necessary
 * @param {string} dirPath - Path to the directory
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Creates a safe filename from the original name
 * @param {string} filename - Original filename
 * @returns {string} - Safe filename
 */
function createSafeFilename(filename) {
  return filename
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase();
}

module.exports = {
  ensureDirectoryExists,
  createSafeFilename
};