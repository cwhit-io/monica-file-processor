const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { logError, logInfo } = require('../utils/logger');

// Global progress tracking object
const processingProgress = {
  currentFile: null,
  currentFileNumber: 0,
  totalFiles: 0,
  totalChunks: 0,
  processedChunks: 0,
  startTime: null,
  estimatedEndTime: null,
  status: 'idle', // idle, processing, completed, error, cancelled
  error: null,
  lastUpdated: Date.now(),
  processingHistory: [],
  processedFiles: new Set(), // Track unique files that have been processed
  cancelled: false // Flag to indicate if processing should be cancelled
};

/**
 * Get current processing progress
 * @returns {object} - Current progress information
 */
function getProgress() {
  return {
    ...processingProgress,
    processedFiles: undefined, // Don't expose the Set in the API
    uptime: process.uptime(),
    currentTime: Date.now()
  };
}

/**
 * Update processing progress
 * @param {object} update - Progress update object
 */
function updateProgress(update) {
  Object.assign(processingProgress, {
    ...update,
    lastUpdated: Date.now()
  });
}

/**
 * Reset all progress tracking
 */
function resetProgress() {
  Object.assign(processingProgress, {
    currentFile: null,
    currentFileNumber: 0,
    totalFiles: 0,
    totalChunks: 0,
    processedChunks: 0,
    startTime: null,
    estimatedEndTime: null,
    status: 'idle',
    error: null,
    lastUpdated: Date.now(),
    processingHistory: [],
    processedFiles: new Set(),
    cancelled: false
  });

  logInfo("Progress tracking completely reset");
}

/**
 * Set total files to be processed and reset counters
 * @param {number} total - Total number of files
 */
function setTotalFiles(total) {
  // Complete reset of all progress tracking
  resetProgress();

  // Set the new total
  updateProgress({
    totalFiles: total
  });
}
/**
 * Cancel current processing
 */
function cancelProcessing() {
  if (processingProgress.status === 'processing') {
    updateProgress({
      cancelled: true,
      status: 'cancelled',
      error: 'Processing cancelled by user'
    });
    logInfo("Processing cancelled by user");
  }
}

/**
 * Track a file being processed
 * @param {string} filePath - Path of the file being processed
 * @returns {number} - The current file number
 */
function trackFileProcessing(filePath) {
  // Get the basename for consistent tracking
  const fileName = path.basename(filePath);

  // Only increment if this is a new file
  if (!processingProgress.processedFiles.has(fileName)) {
    // Add to the set of processed files
    processingProgress.processedFiles.add(fileName);

    // Increment the counter (with safety check)
    const newFileNumber = Math.min(processingProgress.currentFileNumber + 1, processingProgress.totalFiles);

    updateProgress({
      currentFileNumber: newFileNumber,
      currentFile: fileName
    });

    logInfo(`Tracking file ${newFileNumber}/${processingProgress.totalFiles}: ${fileName}`);
    return newFileNumber;
  }

  // If already processed, return current number
  return processingProgress.currentFileNumber;
}

// Path to models.json
const { paths } = require('../config/paths');

const modelsPath = paths.models;

// Load model information from JSON
let modelData = { models: [] };
try {
  modelData = require(modelsPath);
  logInfo(`✓ Loaded ${modelData.models.length} models from models.json`);
} catch (error) {
  console.error('\n' + '='.repeat(80));
  console.error(`[MODELS.JSON LOAD ERROR] ${new Date().toISOString()}`);
  console.error('='.repeat(80));
  console.error(`Path: ${modelsPath}`);
  console.error(`Error: ${error.message}`);
  console.error(`Stack: ${error.stack}`);
  console.error('='.repeat(80) + '\n');
  logError(`Error loading models.json: ${error.message}. Using default token limits.`);
}

// Rate limiting tracking
const rateLimits = {};

/**
 * Get model information by key
 * @param {string} modelKey - The model key to look up
 * @returns {object|null} - Model information or null if not found
 */
function getModelInfo(modelKey) {
  if (!modelKey) {
    console.warn(`[WARNING] getModelInfo called with empty modelKey`);
    return null;
  }
  const model = modelData.models.find(m => m.key === modelKey);
  if (!model) {
    console.warn(`[WARNING] Model not found: ${modelKey}`);
  }
  return model || null;
}

/**
 * Get token limit for a specific model
 * @param {string} modelKey - The model key to look up
 * @returns {number} - Token limit for the model, or default if not found
 */
function getModelTokenLimit(modelKey) {
  const DEFAULT_TOKEN_LIMIT = 100000;
  const model = getModelInfo(modelKey);
  const limit = model ? model.tokenLimit : DEFAULT_TOKEN_LIMIT;

  if (!model) {
    console.warn(`[WARNING] Using default token limit (${DEFAULT_TOKEN_LIMIT}) for unknown model: ${modelKey}`);
  }

  return limit;
}

/**
 * Check if a request would exceed rate limits and wait if necessary
 * @param {string} modelKey - The model key to check
 * @returns {Promise<void>} - Resolves when it's safe to proceed
 */
async function checkRateLimits(modelKey) {
  const model = getModelInfo(modelKey);
  if (!model) return;

  // Initialize rate tracking for this model if not exists
  if (!rateLimits[modelKey]) {
    rateLimits[modelKey] = {
      requests: [],
      tokens: []
    };
  }

  const now = Date.now();
  const oneMinuteAgo = now - 60000; // 1 minute ago

  // Clean up old requests
  rateLimits[modelKey].requests = rateLimits[modelKey].requests.filter(
    timestamp => timestamp > oneMinuteAgo
  );
  rateLimits[modelKey].tokens = rateLimits[modelKey].tokens.filter(
    entry => entry.timestamp > oneMinuteAgo
  );

  // Check if we're at the RPM limit
  if (rateLimits[modelKey].requests.length >= model.rpm) {
    // We need to wait until the oldest request is more than a minute old
    const oldestRequest = rateLimits[modelKey].requests[0];
    const waitTime = Math.max(0, oldestRequest + 60000 - now);

    console.log('\n' + '-'.repeat(80));
    console.log(`[RATE LIMIT] ${new Date().toISOString()}`);
    console.log('-'.repeat(80));
    console.log(`Model: ${modelKey}`);
    console.log(`Current Requests: ${rateLimits[modelKey].requests.length}/${model.rpm} RPM`);
    console.log(`Wait Time: ${waitTime}ms`);
    console.log('-'.repeat(80) + '\n');

    logInfo(`Rate limit reached for ${modelKey}. Waiting ${waitTime}ms before proceeding.`);

    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Recursive call to check again after waiting
    return checkRateLimits(modelKey);
  }

  return;
}

/**
 * Track a request for rate limiting purposes
 * @param {string} modelKey - The model key
 * @param {number} inputTokens - Estimated input tokens
 * @param {number} outputTokens - Estimated output tokens
 */
function trackRequest(modelKey, inputTokens, outputTokens) {
  if (!modelKey) return;

  if (!rateLimits[modelKey]) {
    rateLimits[modelKey] = {
      requests: [],
      tokens: []
    };
  }

  const now = Date.now();
  const totalTokens = inputTokens + outputTokens;

  // Track this request
  rateLimits[modelKey].requests.push(now);
  rateLimits[modelKey].tokens.push({
    timestamp: now,
    count: totalTokens
  });

  console.log(`[TRACK] ${modelKey}: ${Math.round(inputTokens)} input + ${Math.round(outputTokens)} output = ${Math.round(totalTokens)} tokens`);
}

/**
 * Process a file with Monica.im API
 * @param {string} inputPath - Path to the input file
 * @param {string} outputPath - Path where the output should be saved
 * @param {string} prompt - Prompt to send to Monica API
 * @param {string} model - AI model to use (optional)
 * @returns {Promise<string>} - Path to the output file
 */
async function processFile(inputPath, outputPath, prompt, model) {
  const startTime = Date.now();

  // Track this file and get the current file number
  const fileNumber = trackFileProcessing(inputPath);

  // Update progress to show we're starting
  updateProgress({
    status: 'processing',
    startTime,
    totalChunks: 0,
    processedChunks: 0,
    error: null
  });

  try {
    console.log('\n' + '='.repeat(80));
    console.log(`[PROCESS FILE] ${new Date().toISOString()}`);
    console.log('='.repeat(80));
    console.log(`Input: ${inputPath}`);
    console.log(`Output: ${outputPath}`);
    console.log(`Model: ${model || 'default'}`);
    console.log(`Prompt Length: ${prompt.length} chars`);
    console.log(`File ${fileNumber} of ${processingProgress.totalFiles}`);
    console.log('='.repeat(80));

    // Read the file content
    const fileContent = await fs.readFile(inputPath, 'utf8');
    console.log(`✓ File read successfully: ${fileContent.length} characters`);

    // Use the provided model directly without verification
    const selectedModel = model || process.env.DEFAULT_MODEL || 'gpt-4o';

    logInfo(`Processing file: ${inputPath} with model: ${selectedModel}`);

    // Get the token limit for this model
    const modelTokenLimit = getModelTokenLimit(selectedModel);
    const MAX_TOKENS_PER_CHUNK = Math.floor(modelTokenLimit * 0.8); // Use 80% of the limit for safety

    // Check if we need to chunk the file (rough estimate: 1 token ≈ 4 characters)
    const estimatedTokens = fileContent.length / 4;

    console.log(`Token Estimate: ${Math.round(estimatedTokens)} tokens`);
    console.log(`Model Limit: ${modelTokenLimit} tokens`);
    console.log(`Chunk Size: ${MAX_TOKENS_PER_CHUNK} tokens`);

    let response;

    if (estimatedTokens > MAX_TOKENS_PER_CHUNK) {
      logInfo(`File is large (est. ${Math.round(estimatedTokens)} tokens, model limit: ${modelTokenLimit}). Processing in chunks.`);
      response = await processLargeFile(fileContent, prompt, selectedModel, MAX_TOKENS_PER_CHUNK);
    } else {

      updateProgress({
        totalChunks: 1,
        processedChunks: 0
      });

      // Process normally for smaller files
      response = await callMonicaApi(fileContent, prompt, selectedModel);

      updateProgress({
        processedChunks: 1
      });
    }

    // Save the response to the output file
    await fs.writeFile(outputPath, response, 'utf8');

    const duration = Date.now() - startTime;
    console.log(`✓ File processed successfully in ${duration}ms`);
    console.log(`✓ Output saved to: ${outputPath}`);
    console.log(`✓ Output size: ${response.length} characters`);
    console.log('='.repeat(80) + '\n');

    logInfo(`File processed successfully. Output saved to: ${outputPath}`);

    // Update progress to show completion
    updateProgress({
      status: 'completed',
      error: null,
      processingHistory: [
        ...processingProgress.processingHistory.slice(-9), // Keep only the last 9 entries
        {
          file: path.basename(inputPath),
          model: selectedModel,
          duration,
          timestamp: Date.now(),
          success: true
        }
      ]
    });

    return outputPath;
  } catch (error) {
    const duration = Date.now() - startTime;

    console.error('\n' + '='.repeat(80));
    console.error(`[PROCESS FILE ERROR] ${new Date().toISOString()}`);
    console.error('='.repeat(80));
    console.error(`Duration: ${duration}ms`);
    console.error(`Input Path: ${inputPath}`);
    console.error(`Output Path: ${outputPath}`);
    console.error(`Model: ${model || 'default'}`);
    console.error(`Error: ${error.message}`);
    console.error('\nStack Trace:');
    console.error(error.stack);
    console.error('='.repeat(80) + '\n');

    // Update progress to show error
    updateProgress({
      status: 'error',
      error: error.message,
      processingHistory: [
        ...processingProgress.processingHistory.slice(-9), // Keep only the last 9 entries
        {
          file: path.basename(inputPath),
          model: model || 'default',
          duration,
          timestamp: Date.now(),
          success: false,
          error: error.message
        }
      ]
    });

    logError(`Error processing file ${inputPath}: ${error.message}`);
    throw new Error(`Failed to process file: ${error.message}`);
  }
}

/**
 * Process a large file by breaking it into chunks
 * @param {string} fileContent - Content of the file
 * @param {string} prompt - User prompt
 * @param {string} model - AI model to use
 * @param {number} maxTokensPerChunk - Maximum tokens per chunk
 * @returns {Promise<string>} - Combined API response
 */
async function processLargeFile(fileContent, prompt, model, maxTokensPerChunk) {
  console.log('\n' + '-'.repeat(80));
  console.log(`[CHUNKING] ${new Date().toISOString()}`);
  console.log('-'.repeat(80));

  // Estimate characters per chunk (rough estimate: 1 token ≈ 4 characters)
  const charsPerChunk = maxTokensPerChunk * 4;

  // For SRT files, try to split at subtitle boundaries
  const chunks = [];

  // ... [existing chunking code] ...

  console.log(`Total Chunks: ${chunks.length}`);
  chunks.forEach((chunk, i) => {
    console.log(`  Chunk ${i + 1}: ${chunk.length} chars (~${Math.round(chunk.length / 4)} tokens)`);
  });
  console.log('-'.repeat(80) + '\n');

  logInfo(`Split file into ${chunks.length} chunks`);

  // Update progress with total chunks
  updateProgress({
    totalChunks: chunks.length,
    processedChunks: 0
  });

  // Process each chunk
  const responses = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`\n[CHUNK ${i + 1}/${chunks.length}] Processing...`);
    logInfo(`Processing chunk ${i + 1}/${chunks.length}`);

    // Modify the prompt to indicate this is a chunk
    const chunkPrompt = `${prompt}\n\n[This is chunk ${i + 1} of ${chunks.length} from the original file]`;

    try {
      // Check rate limits before processing each chunk
      await checkRateLimits(model);

      const chunkResponse = await callMonicaApi(chunks[i], chunkPrompt, model);
      responses.push(chunkResponse);
      console.log(`✓ Chunk ${i + 1}/${chunks.length} completed: ${chunkResponse.length} chars`);

      // Update progress for this chunk
      updateProgress({
        processedChunks: i + 1,
        // Estimate end time based on current progress
        estimatedEndTime: processingProgress.startTime +
          ((Date.now() - processingProgress.startTime) / (i + 1) * chunks.length)
      });

    } catch (error) {
      console.error('\n' + '!'.repeat(80));
      console.error(`[CHUNK ERROR] Chunk ${i + 1}/${chunks.length}`);
      console.error('!'.repeat(80));
      console.error(`Error: ${error.message}`);
      console.error('!'.repeat(80) + '\n');

      logError(`Error processing chunk ${i + 1}: ${error.message}`);
      responses.push(`[Error processing this chunk: ${error.message}]`);

      // Still update progress even for error chunks
      updateProgress({
        processedChunks: i + 1
      });
    }
  }

  // Combine the responses
  const combinedResponse = responses.join('\n\n Next Chunk \n\n');
  console.log(`\n✓ All chunks combined: ${combinedResponse.length} total characters\n`);

  return combinedResponse;
}
/**
 * Call the Monica.im API with the file content and prompt
 * @param {string} fileContent - Content of the file
 * @param {string} prompt - User prompt
 * @param {string} model - AI model to use (optional)
 * @returns {Promise<string>} - API response content
 */
async function callMonicaApi(fileContent, prompt, model) {
  const startTime = Date.now();

  try {
    const apiKey = process.env.MONICA_API_KEY;
    const apiEndpoint = process.env.MONICA_API_ENDPOINT;
    const defaultModel = process.env.DEFAULT_MODEL || 'gpt-4o';

    if (!apiKey || !apiEndpoint) {
      throw new Error('Monica API key or endpoint not configured');
    }

    // Prepare the message for the API with the correct format
    const message = `${prompt}\n\nFile Content:\n${fileContent}`;
    const selectedModel = model || defaultModel;

    // Estimate tokens for rate limiting
    const estimatedInputTokens = message.length / 4;
    const estimatedOutputTokens = estimatedInputTokens / 2; // Rough estimate that output is half the size of input

    // Check rate limits before making the API call
    await checkRateLimits(selectedModel);

    console.log('\n' + '-'.repeat(80));
    console.log(`[API CALL] ${new Date().toISOString()}`);
    console.log('-'.repeat(80));
    console.log(`Endpoint: ${apiEndpoint}`);
    console.log(`Model: ${selectedModel}`);
    console.log(`Message Length: ${message.length} chars (~${Math.round(estimatedInputTokens)} tokens)`);
    console.log(`Estimated Output: ~${Math.round(estimatedOutputTokens)} tokens`);
    console.log('-'.repeat(80));

    logInfo(`Calling Monica API with model: ${selectedModel}`);

    // Prepare request payload with the simpler message format that worked in the test
    const payload = {
      model: selectedModel,
      messages: [
        {
          role: 'user',
          content: message
        }
      ]
    };

    // Call the Monica API
    const response = await axios.post(
      apiEndpoint,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    const duration = Date.now() - startTime;

    // Track this request for rate limiting
    const actualInputTokens = response.data.usage?.prompt_tokens || estimatedInputTokens;
    const actualOutputTokens = response.data.usage?.completion_tokens || estimatedOutputTokens;
    trackRequest(selectedModel, actualInputTokens, actualOutputTokens);

    console.log(`✓ API call successful (${duration}ms)`);
    if (response.data.usage) {
      console.log(`  Input Tokens: ${response.data.usage.prompt_tokens}`);
      console.log(`  Output Tokens: ${response.data.usage.completion_tokens}`);
      console.log(`  Total Tokens: ${response.data.usage.total_tokens}`);
    }
    console.log('-'.repeat(80) + '\n');

    // Extract the response content
    if (response.data &&
      response.data.choices &&
      response.data.choices[0] &&
      response.data.choices[0].message) {

      return response.data.choices[0].message.content;
    } else {
      console.error('\n' + '='.repeat(80));
      console.error(`[UNEXPECTED API RESPONSE] ${new Date().toISOString()}`);
      console.error('='.repeat(80));
      console.error('Response Data:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('='.repeat(80) + '\n');

      logError(`Unexpected API response format: ${JSON.stringify(response.data)}`);
      throw new Error('Unexpected API response format');
    }
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('\n' + '='.repeat(80));
      console.error(`[API ERROR] ${new Date().toISOString()}`);
      console.error('='.repeat(80));
      console.error(`Duration: ${duration}ms`);
      console.error(`Status Code: ${error.response.status}`);
      console.error(`Status Text: ${error.response.statusText}`);
      console.error(`Model: ${model || 'default'}`);
      console.error('\nResponse Headers:');
      console.error(JSON.stringify(error.response.headers, null, 2));
      console.error('\nResponse Data:');
      console.error(JSON.stringify(error.response.data, null, 2));
      console.error('='.repeat(80) + '\n');

      logError(`API error: ${error.response.status} - ${JSON.stringify(error.response.data || {})}`);

      // Check for token limit errors
      if (error.response.status === 400 &&
        error.response.data &&
        error.response.data.error &&
        error.response.data.error.message &&
        error.response.data.error.message.includes('maximum context length')) {
        throw new Error(`Token limit exceeded: ${error.response.data.error.message}`);
      }
      // Check for rate limit errors
      else if (error.response.status === 429) {
        const retryAfter = error.response.headers['retry-after'] || 60;

        console.log('\n' + '!'.repeat(80));
        console.log(`[RATE LIMIT - RETRY] ${new Date().toISOString()}`);
        console.log('!'.repeat(80));
        console.log(`Retry After: ${retryAfter} seconds`);
        console.log('!'.repeat(80) + '\n');

        logInfo(`Rate limit exceeded. Retrying after ${retryAfter} seconds.`);

        // Wait for the specified time and then retry
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return callMonicaApi(fileContent, prompt, model);
      } else {
        throw new Error(`API error: ${error.response.status} - ${error.response.data?.error?.message || 'Unknown error'}`);
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('\n' + '='.repeat(80));
      console.error(`[NO API RESPONSE] ${new Date().toISOString()}`);
      console.error('='.repeat(80));
      console.error(`Duration: ${duration}ms`);
      console.error(`Model: ${model || 'default'}`);
      console.error('Request was made but no response received');
      console.error('\nRequest Details:');
      console.error(`  Method: ${error.request.method}`);
      console.error(`  Path: ${error.request.path}`);
      console.error('='.repeat(80) + '\n');

      logError('No response received from API');
      throw new Error('No response received from API');
    } else {
      // Something happened in setting up the request
      console.error('\n' + '='.repeat(80));
      console.error(`[API REQUEST SETUP ERROR] ${new Date().toISOString()}`);
      console.error('='.repeat(80));
      console.error(`Error: ${error.message}`);
      console.error('\nStack Trace:');
      console.error(error.stack);
      console.error('='.repeat(80) + '\n');

      logError(`Error setting up API request: ${error.message}`);
      throw error;
    }
  }
}

module.exports = {
  processFile,
  getModelInfo,
  getProgress,
  setTotalFiles,
  resetProgress,
  cancelProcessing
};