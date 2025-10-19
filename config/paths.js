const path = require('path');

// Base data directory - can be easily changed for different environments
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

// All data-related paths
const paths = {
    // Base directory
    dataDir: DATA_DIR,

    // Main data subdirectories
    uploads: path.join(DATA_DIR, 'uploads'),
    serverFolders: path.join(DATA_DIR, 'server-folders'),
    outputs: path.join(DATA_DIR, 'outputs'),
    config: path.join(DATA_DIR, 'config'),

    // Configuration files
    models: path.join(DATA_DIR, 'config', 'models.json'),
    prompts: path.join(DATA_DIR, 'config', 'prompts.json'),

    // Legacy paths for backward compatibility (if needed)
    legacy: {
        uploads: path.join(__dirname, '..', 'uploads'),
        outputs: path.join(__dirname, '..', 'outputs'),
        serverFolders: path.join(__dirname, '..', 'server-folders')
    }
};

// Helper function to ensure directory exists
const ensureDir = async (dirPath) => {
    const fs = require('fs').promises;
    try {
        await fs.access(dirPath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.mkdir(dirPath, { recursive: true });
        } else {
            throw error;
        }
    }
};

// Initialize all required directories
const initializePaths = async () => {
    await Promise.all([
        ensureDir(paths.uploads),
        ensureDir(paths.serverFolders),
        ensureDir(paths.outputs),
        ensureDir(paths.config)
    ]);
};

module.exports = {
    paths,
    ensureDir,
    initializePaths
};