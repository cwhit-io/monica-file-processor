const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { processFile, setTotalFiles, cancelProcessing, getProgress } = require('../services/monicaService');
const { ensureDirectoryExists } = require('../utils/fileUtils');
const { logInfo, logError } = require('../utils/logger');
const { paths } = require('../config/paths');
// Set up multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    try {
      const uploadDir = paths.uploads;
      ensureDirectoryExists(uploadDir);
      console.log(`[MULTER] Upload destination: ${uploadDir}`);
      cb(null, uploadDir);
    } catch (error) {
      console.error('\n' + '='.repeat(80));
      console.error(`[MULTER DESTINATION ERROR] ${new Date().toISOString()}`);
      console.error('='.repeat(80));
      console.error(`Error: ${error.message}`);
      console.error(`Stack: ${error.stack}`);
      console.error('='.repeat(80) + '\n');
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    const filename = `${Date.now()}-${file.originalname}`;
    console.log(`[MULTER] Saving file as: ${filename}`);
    cb(null, filename);
  }
});
// File filter to only accept text-based files
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.txt', '.md', '.srt'];
  const ext = path.extname(file.originalname).toLowerCase();
  console.log(`[MULTER] File filter check: ${file.originalname} (${ext})`);
  if (allowedTypes.includes(ext)) {
    console.log(`✓ File type accepted: ${ext}`);
    cb(null, true);
  } else {
    console.error(`✗ File type rejected: ${ext}`);
    console.error(`  Allowed types: ${allowedTypes.join(', ')}`);
    cb(new Error(`Only ${allowedTypes.join(', ')} files are allowed`));
  }
};
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});
// Multer error handler middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('\n' + '='.repeat(80));
    console.error(`[MULTER ERROR] ${new Date().toISOString()}`);
    console.error('='.repeat(80));
    console.error(`Error Code: ${err.code}`);
    console.error(`Error Message: ${err.message}`);
    console.error(`Field: ${err.field || 'N/A'}`);
    if (err.code === 'LIMIT_FILE_SIZE') {
      console.error(`File size limit: 5MB`);
    }
    console.error('='.repeat(80) + '\n');
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds the 5MB limit'
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  next(err);
};
// Helper function to create a formatted timestamp folder name
function createTimestampFolderName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}
// GET available server folders - UPDATED FOR DYNAMIC DROPDOWN
router.get('/server-folders', (req, res) => {
  try {
    const cwd = process.cwd();
    console.log(`[SERVER FOLDERS] Scanning from CWD: ${cwd}`);
    // Define allowed base directories (relative to project root)
    const allowedBases = [
      'server-folders',
      'data/inputs',
      'uploads/archive'
    ];
    const folders = [];
    allowedBases.forEach(baseDir => {
      const basePath = path.join(cwd, baseDir);
      console.log(`[SERVER FOLDERS] Checking: ${basePath}`);
      if (fs.existsSync(basePath)) {
        console.log(`  ✓ Directory exists`);
        try {
          const entries = fs.readdirSync(basePath, { withFileTypes: true });
          entries
            .filter(entry => entry.isDirectory())
            .forEach(entry => {
              const fullPath = path.join(basePath, entry.name);
              const relativePath = path.relative(cwd, fullPath);
              // Count valid files
              const files = fs.readdirSync(fullPath);
              const validFiles = files.filter(f =>
                ['.txt', '.md', '.srt'].includes(path.extname(f).toLowerCase())
              );
              console.log(`    → ${entry.name}: ${validFiles.length} valid files`);
              folders.push({
                name: entry.name,
                path: relativePath,
                baseDir: baseDir,
                fileCount: validFiles.length,
                displayName: `${baseDir}/${entry.name} (${validFiles.length} files)`
              });
            });
        } catch (readError) {
          console.error(`  ✗ Error reading directory: ${readError.message}`);
        }
      } else {
        console.log(`  ✗ Directory does not exist`);
      }
    });
    console.log(`[SERVER FOLDERS] Found ${folders.length} folders total`);
    res.json({
      success: true,
      folders: folders,
      count: folders.length
    });
  } catch (error) {
    console.error('[SERVER FOLDERS] Error:', error);
    res.status(500).json({
      success: false,
      folders: [],
      error: error.message
    });
  }
});
// POST route to process files - FIXED VERSION
router.post('/process-files', upload.array('files'), handleMulterError, async (req, res, next) => {
  const requestId = Date.now();
  const startTime = Date.now();
  try {
    console.log('\n' + '='.repeat(80));
    console.log(`[UPLOAD REQUEST] ${new Date().toISOString()} [ID: ${requestId}]`);
    console.log('='.repeat(80));
    let filesToProcess = [];
    const uploadDir = paths.uploads;
    const allowedExtensions = ['.txt', '.md', '.srt'];
    // Handle server folder with relative path support
    const serverFolderInput = req.body.serverFolderPath?.trim();
    if (serverFolderInput) {
      console.log(`[SERVER FOLDER] Input: "${serverFolderInput}"`);
      // Get current working directory
      const cwd = process.cwd();
      console.log(`[SERVER FOLDER] CWD: ${cwd}`);
      // Resolve the path relative to CWD
      const resolvedPath = path.resolve(cwd, serverFolderInput);
      console.log(`[SERVER FOLDER] Resolved path: ${resolvedPath}`);
      // Security check: ensure the resolved path is within CWD
      if (!resolvedPath.startsWith(cwd)) {
        console.error(`✗ Security violation: Path outside CWD`);
        console.error('='.repeat(80) + '\n');
        return res.status(400).json({
          success: false,
          message: 'Invalid folder path: Cannot access directories outside the project'
        });
      }
      // Check if folder exists
      if (!fs.existsSync(resolvedPath)) {
        console.error(`✗ Folder not found: ${resolvedPath}`);
        console.error('='.repeat(80) + '\n');
        return res.status(400).json({
          success: false,
          message: `Folder not found: ${serverFolderInput}`
        });
      }
      // Check if it's a directory
      const stats = fs.statSync(resolvedPath);
      if (!stats.isDirectory()) {
        console.error(`✗ Path is not a directory: ${resolvedPath}`);
        console.error('='.repeat(80) + '\n');
        return res.status(400).json({
          success: false,
          message: `Path is not a directory: ${serverFolderInput}`
        });
      }
      console.log(`✓ Valid directory found`);
      // Read and filter files
      const filesInFolder = fs.readdirSync(resolvedPath)
        .filter(f => allowedExtensions.includes(path.extname(f).toLowerCase()));
      console.log(`✓ Found ${filesInFolder.length} valid files in folder`);
      if (filesInFolder.length === 0) {
        console.error(`✗ No valid files found`);
        console.error('='.repeat(80) + '\n');
        return res.status(400).json({
          success: false,
          message: `No valid files (.txt, .md, .srt) found in folder: ${serverFolderInput}`
        });
      }
      // ✅ FIX: Don't copy files, just reference them directly
      console.log(`Processing files directly from server folder...`);
      filesInFolder.forEach((filename, index) => {
        const filePath = path.join(resolvedPath, filename);
        const fileStats = fs.statSync(filePath);
        filesToProcess.push({
          originalname: filename,
          path: filePath,  // ← Use original path directly
          size: fileStats.size,
          isServerFile: true  // ← Mark as server file (don't delete later)
        });
        console.log(`  ${index + 1}. ${filename} (${(fileStats.size / 1024).toFixed(2)} KB)`);
      });
    }
    // Handle uploaded files
    if (req.files && req.files.length > 0) {
      console.log(`[UPLOADED FILES] Processing ${req.files.length} uploaded files`);
      req.files.forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.originalname} (${(file.size / 1024).toFixed(2)} KB)`);
        file.isServerFile = false;  // ← Mark as uploaded file (delete later)
      });
      filesToProcess.push(...req.files);
    }
    // Deduplicate files based on originalname to prevent processing the same file twice
    const seenFiles = new Map();
    filesToProcess = filesToProcess.filter(file => {
      if (seenFiles.has(file.originalname)) {
        console.log(`[DEDUPLICATION] Skipping duplicate file: ${file.originalname}`);
        return false;
      }
      seenFiles.set(file.originalname, file);
      return true;
    });
    console.log(`[DEDUPLICATION] After deduplication: ${filesToProcess.length} unique files`);
    // Validate we have files
    if (filesToProcess.length === 0) {
      console.error(`✗ No files to process`);
      console.error('='.repeat(80) + '\n');
      return res.status(400).json({
        success: false,
        message: 'No files to process. Either upload files or specify a valid server folder path.'
      });
    }
    console.log(`\n✓ Total files to process: ${filesToProcess.length}`);
    console.log('='.repeat(80));
    const { prompt, model } = req.body;
    console.log(`\n[PROCESSING PARAMETERS]`);
    console.log(`Prompt: ${prompt || 'None'}`);
    console.log(`Model: ${model || 'Default'}`);
    console.log(`Files: ${filesToProcess.length}`);
    // Create timestamped output folder
    const outputFolderName = createTimestampFolderName();
    const outputDir = path.join(paths.outputs, outputFolderName);
    ensureDirectoryExists(outputDir);
    console.log(`\n[OUTPUT]`);
    console.log(`Output folder: ${outputFolderName}`);
    console.log(`Output path: ${outputDir}`);
    const results = [];
    let successCount = 0;
    let failCount = 0;
    console.log(`\n[FILE PROCESSING]`);
    console.log('='.repeat(80));

    // Set total files count for progress tracking
    setTotalFiles(filesToProcess.length);
    console.log(`✓ Progress tracking initialized for ${filesToProcess.length} files`);

    // Process each file
    for (let i = 0; i < filesToProcess.length; i++) {
      // Check if processing has been cancelled
      const progress = getProgress();
      if (progress.cancelled || progress.status === 'cancelled') {
        console.log(`\n[!] Processing cancelled by user`);
        break;
      }

      const file = filesToProcess[i];
      const fileStartTime = Date.now();
      console.log(`\n[${i + 1}/${filesToProcess.length}] Processing: ${file.originalname}`);
      try {
        // Generate output filename
        const outputFilename = `processed_${file.originalname}`;
        const outputPath = path.join(outputDir, outputFilename);
        // Process with Monica service (it handles reading and writing internally)
        console.log(`  → Sending to Monica service...`);
        await processFile(file.path, outputPath, prompt, model);
        // Check the output file size
        const outputStats = fs.statSync(outputPath);
        console.log(`  ✓ Processing complete: ${(outputStats.size / 1024).toFixed(2)} KB`);
        console.log(`  ✓ Saved: ${outputFilename}`);
        const duration = Date.now() - fileStartTime;
        console.log(`  ✓ Duration: ${duration}ms`);
        results.push({
          originalName: file.originalname,
          processedName: outputFilename,
          success: true,
          url: `/a../data/outputs/${outputFolderName}/${outputFilename}`,
          duration: duration
        });
        successCount++;
      } catch (error) {
        const duration = Date.now() - fileStartTime;
        console.error(`  ✗ Error: ${error.message}`);
        console.error(`  ✗ Duration: ${duration}ms`);
        results.push({
          originalName: file.originalname,
          success: false,
          error: error.message,
          duration: duration
        });
        failCount++;
      }
      // Only clean up uploaded files, not server files
      if (!file.isServerFile) {
        try {
          fs.unlinkSync(file.path);
          console.log(`  ✓ Cleaned up temporary file`);
        } catch (cleanupError) {
          console.error(`  ⚠ Failed to cleanup: ${cleanupError.message}`);
        }
      } else {
        console.log(`  ℹ Server file - no cleanup needed`);
      }
    }
    const totalDuration = Date.now() - startTime;
    console.log('\n' + '='.repeat(80));
    console.log(`[PROCESSING COMPLETE] [ID: ${requestId}]`);
    console.log('='.repeat(80));
    console.log(`Total duration: ${totalDuration}ms`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Output folder: ${outputFolderName}`);
    console.log('='.repeat(80) + '\n');
    res.json({
      success: true,
      message: `Processed ${successCount} of ${filesToProcess.length} files`,
      results: results.map(r => ({
        ...r,
        originalFile: r.originalName,
        outputFile: r.processedName,
        outputPath: r.url,
        timestampFolder: outputFolderName
      })),
      outputFolder: outputFolderName,
      timestampFolder: outputFolderName,
      downloadAllUrl: `/api/download-all/${outputFolderName}`,
      stats: {
        total: filesToProcess.length,
        success: successCount,
        failed: failCount,
        duration: totalDuration
      }
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error('\n' + '='.repeat(80));
    console.error(`[PROCESS FILES ERROR] [ID: ${requestId}]`);
    console.error('='.repeat(80));
    console.error(`Duration: ${duration}ms`);
    console.error(`Error: ${err.message}`);
    console.error('\nStack Trace:');
    console.error(err.stack);
    console.error('='.repeat(80) + '\n');
    next(err);
  }
});
// GET route to serve processed files from timestamped folders
router.get('/data/outputs/:folder/:filename', (req, res) => {
  const folder = req.params.folder;
  const filename = req.params.filename;
  const filePath = path.join(paths.outputs, folder, filename);
  console.log(`[FILE REQUEST] ${folder}/${filename}`);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`✓ File found: ${(stats.size / 1024).toFixed(2)} KB`);
    res.sendFile(filePath);
  } else {
    console.error(`✗ File not found: ${filePath}`);
    res.status(404).json({
      success: false,
      message: 'File not found'
    });
  }
});
// GET route to serve processed files (backward compatibility)
router.get('/data/outputs/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(paths.outputs, filename);
  console.log(`[FILE REQUEST - LEGACY] ${filename}`);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`✓ File found: ${(stats.size / 1024).toFixed(2)} KB`);
    res.sendFile(filePath);
  } else {
    console.error(`✗ File not found: ${filePath}`);
    res.status(404).json({
      success: false,
      message: 'File not found'
    });
  }
});
// GET route to download all files in a folder as a zip
router.get('/download-all/:folder', (req, res) => {
  const requestId = Date.now();
  const startTime = Date.now();
  try {
    const folder = req.params.folder;
    const folderPath = path.join(paths.outputs, folder);
    console.log('\n' + '='.repeat(80));
    console.log(`[ZIP DOWNLOAD] ${new Date().toISOString()} [ID: ${requestId}]`);
    console.log('='.repeat(80));
    console.log(`Folder: ${folder}`);
    console.log(`Path: ${folderPath}`);
    if (!fs.existsSync(folderPath)) {
      console.error(`✗ Folder not found: ${folderPath}`);
      console.error('='.repeat(80) + '\n');
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }
    const files = fs.readdirSync(folderPath);
    console.log(`Files found: ${files.length}`);
    if (files.length === 0) {
      console.error(`✗ No files in folder`);
      console.error('='.repeat(80) + '\n');
      return res.status(404).json({
        success: false,
        message: 'No files found in the folder'
      });
    }
    let totalSize = 0;
    files.forEach((file, index) => {
      const filePath = path.join(folderPath, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
      console.log(`  ${index + 1}. ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
    });
    console.log(`Total size: ${(totalSize / 1024).toFixed(2)} KB`);
    console.log(`Creating zip archive...`);
    const zipFilename = `${folder}_processed_files.zip`;
    res.attachment(zipFilename);
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });
    archive.on('error', (err) => {
      console.error('\n' + '='.repeat(80));
      console.error(`[ZIP ARCHIVE ERROR] [ID: ${requestId}]`);
      console.error('='.repeat(80));
      console.error(`Error: ${err.message}`);
      console.error(`Stack: ${err.stack}`);
      console.error('='.repeat(80) + '\n');
      throw err;
    });
    archive.on('progress', (progress) => {
      const percent = ((progress.entries.processed / progress.entries.total) * 100).toFixed(1);
      console.log(`  Progress: ${progress.entries.processed}/${progress.entries.total} files (${percent}%)`);
    });
    archive.on('end', () => {
      const duration = Date.now() - startTime;
      const compressedSize = archive.pointer();
      const compressionRatio = ((1 - (compressedSize / totalSize)) * 100).toFixed(1);
      console.log('\n' + '='.repeat(80));
      console.log(`[ZIP COMPLETE] [ID: ${requestId}]`);
      console.log('='.repeat(80));
      console.log(`Duration: ${duration}ms`);
      console.log(`Original size: ${(totalSize / 1024).toFixed(2)} KB`);
      console.log(`Compressed size: ${(compressedSize / 1024).toFixed(2)} KB`);
      console.log(`Compression ratio: ${compressionRatio}%`);
      console.log(`Filename: ${zipFilename}`);
      console.log('='.repeat(80) + '\n');
    });
    archive.pipe(res);
    files.forEach(file => {
      const filePath = path.join(folderPath, file);
      archive.file(filePath, { name: file });
    });
    archive.finalize();
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error('\n' + '='.repeat(80));
    console.error(`[ZIP DOWNLOAD ERROR] [ID: ${requestId}]`);
    console.error('='.repeat(80));
    console.error(`Duration: ${duration}ms`);
    console.error(`Error: ${err.message}`);
    console.error('\nStack Trace:');
    console.error(err.stack);
    console.error('='.repeat(80) + '\n');
    res.status(500).json({
      success: false,
      message: 'Failed to create zip file',
      error: err.message
    });
  }
});
router.post('/cancel-processing', (req, res) => {
  try {
    cancelProcessing();
    res.json({
      success: true,
      message: 'Processing cancelled'
    });
  } catch (error) {
    console.error('Error cancelling processing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel processing',
      error: error.message
    });
  }
});
module.exports = router;