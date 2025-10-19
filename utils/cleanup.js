const fs = require('fs').promises;
const path = require('path');
const { logInfo, logError } = require('./logger');
const { paths } = require('../config/paths');

/**
 * Delete files older than the specified age
 * @param {string} directory - Directory to clean
 * @param {number} maxAgeHours - Maximum age in hours
 * @returns {Promise<number>} - Number of files deleted
 */
async function cleanupOldFiles(directory, maxAgeHours) {
  try {
    // Ensure the directory exists
    try {
      await fs.access(directory);
    } catch (error) {
      logInfo(`Directory ${directory} does not exist. Creating it.`);
      await fs.mkdir(directory, { recursive: true });
      return 0;
    }

    // Get all files in the directory
    const files = await fs.readdir(directory);

    if (files.length === 0) {
      logInfo(`No files found in ${directory}`);
      return 0;
    }

    // Calculate cutoff time
    const now = Date.now();
    const cutoffTime = now - (maxAgeHours * 60 * 60 * 1000);

    let deletedCount = 0;

    // Process each file
    for (const file of files) {
      const filePath = path.join(directory, file);

      try {
        // Get file stats
        const stats = await fs.stat(filePath);

        // Check if file is older than cutoff time
        if (stats.mtimeMs < cutoffTime) {
          await fs.unlink(filePath);
          deletedCount++;
          logInfo(`Deleted old file: ${filePath}`);
        }
      } catch (fileError) {
        logError(`Error processing file ${filePath}: ${fileError.message}`);
      }
    }

    return deletedCount;
  } catch (error) {
    logError(`Error cleaning up directory ${directory}: ${error.message}`);
    throw error;
  }
}

/**
 * Clean up uploads and outputs directories
 * @param {number} uploadsMaxAgeHours - Maximum age for uploads in hours
 * @param {number} outputsMaxAgeHours - Maximum age for outputs in hours
 */
async function cleanup(uploadsMaxAgeHours = 200, outputsMaxAgeHours = 400) {
  const uploadsDir = paths.uploads;
  const outputsDir = paths.outputs;

  logInfo('Starting cleanup...');

  try {
    const deletedUploads = await cleanupOldFiles(uploadsDir, uploadsMaxAgeHours);
    logInfo(`Cleaned up ${deletedUploads} files from uploads directory`);

    const deletedOutputs = await cleanupOldFiles(outputsDir, outputsMaxAgeHours);
    logInfo(`Cleaned up ${deletedOutputs} files from outputs directory`);

    logInfo('Cleanup completed successfully');
    return {
      uploadsDeleted: deletedUploads,
      outputsDeleted: deletedOutputs
    };
  } catch (error) {
    logError(`Cleanup failed: ${error.message}`);
    throw error;
  }
}

// If this script is run directly (not imported)
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const uploadsMaxAge = parseInt(args[0]) || 200; // Default 24 hours
  const outputsMaxAge = parseInt(args[1]) || 400; // Default 72 hours

  cleanup(uploadsMaxAge, outputsMaxAge)
    .then(result => {
      console.log(`Cleanup completed. Deleted ${result.uploadsDeleted} upload files and ${result.outputsDeleted} output files.`);
    })
    .catch(error => {
      console.error(`Cleanup failed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = {
  cleanup,
  cleanupOldFiles
};