require('dotenv').config();
const express = require('express');
const path = require('path');
const uploadRoutes = require('./routes/uploadRoutes');
const modelRoutes = require('./routes/modelRoutes');
const promptRoutes = require('./routes/promptRoutes');
const { cleanup } = require('./utils/cleanup');
const { logInfo } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Request logging middleware (optional but helpful)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api', uploadRoutes);
app.use('/api', modelRoutes);
app.use('/api', promptRoutes);

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler - must come before error handler
app.use((req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.url}`);
  error.status = 404;
  next(error);
});

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  const statusCode = err.status || err.statusCode || 500;
  
  // Console error output with details
  console.error('\n' + '='.repeat(80));
  console.error(`[ERROR] ${timestamp}`);
  console.error('='.repeat(80));
  console.error(`Status Code: ${statusCode}`);
  console.error(`Request: ${req.method} ${req.url}`);
  console.error(`Message: ${err.message}`);
  
  if (req.body && Object.keys(req.body).length > 0) {
    console.error(`Request Body:`, JSON.stringify(req.body, null, 2));
  }
  
  if (req.params && Object.keys(req.params).length > 0) {
    console.error(`Request Params:`, JSON.stringify(req.params, null, 2));
  }
  
  if (req.query && Object.keys(req.query).length > 0) {
    console.error(`Request Query:`, JSON.stringify(req.query, null, 2));
  }
  
  console.error('\nStack Trace:');
  console.error(err.stack);
  console.error('='.repeat(80) + '\n');

  // Send response to client
  res.status(statusCode).json({
    success: false,
    message: statusCode === 404 ? err.message : 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? {
      message: err.message,
      stack: err.stack,
      details: err.details || null
    } : 'Server error'
  });
});

// Enhanced cleanup with better error handling
const runCleanup = async (type = 'initial') => {
  try {
    logInfo(`Running ${type} cleanup...`);
    const result = await cleanup();
    logInfo(`✓ ${type} cleanup completed: Removed ${result.uploadsDeleted} uploads and ${result.outputsDeleted} outputs`);
    return result;
  } catch (err) {
    console.error('\n' + '='.repeat(80));
    console.error(`[CLEANUP ERROR] ${new Date().toISOString()}`);
    console.error('='.repeat(80));
    console.error(`Cleanup Type: ${type}`);
    console.error(`Error Message: ${err.message}`);
    console.error('\nStack Trace:');
    console.error(err.stack);
    console.error('='.repeat(80) + '\n');
    throw err;
  }
};

// Run initial cleanup when server starts
runCleanup('initial').catch(err => {
  console.error('⚠ Initial cleanup failed, but server will continue...');
});

// Schedule regular cleanup (every 6 hours)
const CLEANUP_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
setInterval(() => {
  runCleanup('scheduled').catch(err => {
    console.error('⚠ Scheduled cleanup failed, will retry at next interval...');
  });
}, CLEANUP_INTERVAL);

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  try {
    // Run final cleanup
    await runCleanup('shutdown');
    console.log('✓ Final cleanup completed');
  } catch (err) {
    console.error('⚠ Final cleanup failed:', err.message);
  }
  
  console.log('✓ Server shut down gracefully');
  process.exit(0);
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('\n' + '='.repeat(80));
  console.error(`[UNCAUGHT EXCEPTION] ${new Date().toISOString()}`);
  console.error('='.repeat(80));
  console.error('Error:', err.message);
  console.error('\nStack Trace:');
  console.error(err.stack);
  console.error('='.repeat(80) + '\n');
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('\n' + '='.repeat(80));
  console.error(`[UNHANDLED REJECTION] ${new Date().toISOString()}`);
  console.error('='.repeat(80));
  console.error('Reason:', reason);
  console.error('Promise:', promise);
  console.error('='.repeat(80) + '\n');
  process.exit(1);
});

// Start server
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(80));
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✓ Cleanup interval: ${CLEANUP_INTERVAL / (60 * 60 * 1000)} hours`);
  console.log('='.repeat(80) + '\n');
});