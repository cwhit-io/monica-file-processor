const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { paths } = require('../config/paths');

// GET route to list contents of a specific server folder (for preview)
router.get('/server-folder-contents', (req, res) => {
    try {
        const folderPath = req.query.path?.trim();
        if (!folderPath) {
            return res.status(400).json({ success: false, message: 'Path query parameter is required' });
        }

        const cwd = process.cwd();

        // Normalize the path to prevent directory traversal
        const normalizedPath = path.normalize(folderPath);

        // Security check: ensure path doesn't escape allowed directories
        if (normalizedPath.includes('..')) {
            console.error(`[SECURITY] Path traversal attempt: ${folderPath}`);
            return res.status(400).json({ success: false, message: 'Invalid path: directory traversal not allowed' });
        }

        // Resolve the full path
        const resolvedPath = path.resolve(cwd, normalizedPath);

        // Security check: ensure path is within allowed bases and project root
        const allowedBases = ['data/server-folders', 'data/inputs', 'data/uploads/archive'];
        const isAllowed = allowedBases.some(base => {
            const basePath = path.join(cwd, base);
            return resolvedPath.startsWith(basePath);
        });

        if (!isAllowed || !resolvedPath.startsWith(cwd)) {
            console.error(`[SECURITY] Unauthorized path: ${folderPath}`);
            return res.status(400).json({ success: false, message: 'Invalid or unauthorized folder path' });
        }

        if (!fs.existsSync(resolvedPath)) {
            return res.status(404).json({ success: false, message: 'Folder not found' });
        }

        if (!fs.statSync(resolvedPath).isDirectory()) {
            return res.status(400).json({ success: false, message: 'Path is not a directory' });
        }

        // Read and filter files
        const allowedExtensions = ['.txt', '.md', '.srt', '.vtt', '.pdf', '.doc', '.docx'];
        const files = fs.readdirSync(resolvedPath)
            .filter(file => {
                const ext = path.extname(file).toLowerCase();
                return allowedExtensions.includes(ext);
            })
            .map(file => {
                const filePath = path.join(resolvedPath, file);
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    path: path.join(normalizedPath, file), // Relative path
                    size: stats.size,
                    modified: stats.mtime
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically

        console.log(`[FOLDER CONTENTS] Listed ${files.length} files in: ${folderPath}`);
        res.json({
            success: true,
            folder: normalizedPath,
            files
        });

    } catch (error) {
        console.error('[FOLDER CONTENTS ERROR]', error);
        res.status(500).json({
            success: false,
            message: 'Failed to list folder contents',
            error: error.message
        });
    }
});

// GET route to list available server folders
router.get('/server-folders', (req, res, next) => {
    try {
        console.log('\n' + '='.repeat(80));
        console.log(`[LIST SERVER FOLDERS] ${new Date().toISOString()}`);
        console.log('='.repeat(80));

        const cwd = process.cwd();
        const serverFoldersPath = paths.serverFolders;

        console.log(`CWD: ${cwd}`);
        console.log(`Server Folders Path: ${serverFoldersPath}`);

        // Check if server-folders directory exists
        if (!fs.existsSync(serverFoldersPath)) {
            console.log('✓ server-folders directory does not exist, creating it...');
            fs.mkdirSync(serverFoldersPath, { recursive: true });
        }

        // Read all items in server-folders
        const items = fs.readdirSync(serverFoldersPath);

        // Filter only directories
        const folders = items.filter(item => {
            const itemPath = path.join(serverFoldersPath, item);
            return fs.statSync(itemPath).isDirectory();
        });

        console.log(`✓ Found ${folders.length} folders`);
        folders.forEach((folder, i) => {
            console.log(`  ${i + 1}. ${folder}`);
        });
        console.log('='.repeat(80) + '\n');

        res.json({
            success: true,
            folders: folders.map(folder => ({
                name: folder,
                path: `data/server-folders/${folder}`
            }))
        });

    } catch (error) {
        console.error('\n' + '='.repeat(80));
        console.error(`[LIST SERVER FOLDERS ERROR] ${new Date().toISOString()}`);
        console.error('='.repeat(80));
        console.error(`Error: ${error.message}`);
        console.error(`Stack: ${error.stack}`);
        console.error('='.repeat(80) + '\n');

        next(error);
    }
});

module.exports = router;
module.exports = router;
