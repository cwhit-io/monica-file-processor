// DOM Elements
const uploadForm = document.getElementById('uploadForm');
const fileInput = document.getElementById('files');
const dropZone = document.getElementById('dropZone');
const fileList = document.getElementById('fileList');
const submitBtn = document.getElementById('submitBtn');
const processingStatus = document.getElementById('processingStatus');
const results = document.getElementById('results');
const resultsList = document.getElementById('resultsList');
const errorMessage = document.getElementById('errorMessage');
const modelSelect = document.getElementById('model');
const modelInfo = document.getElementById('modelInfo');

// Global model data and results tracking
let modelsData = [];
let currentTimestampFolder = null;
let isSubmitting = false;

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  fileInput.addEventListener('change', updateFileList);
  uploadForm.addEventListener('submit', handleFormSubmit);
  modelSelect.addEventListener('change', updateModelInfo);

  // Drag and drop event listeners
  if (dropZone) {
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, preventDefaults, false);
      document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, highlight, false);
    });

    // Remove highlight when item is dragged out or dropped
    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, unhighlight, false);
    });

    // Handle dropped files
    dropZone.addEventListener('drop', handleDrop, false);

    // Also handle click to select files
    dropZone.addEventListener('click', (e) => {
      // Only trigger file input if clicking the drop zone itself, not the label
      if (e.target === dropZone || e.target.classList.contains('drop-zone-prompt') || e.target.classList.contains('drop-icon')) {
        fileInput.click();
      }
    });
  }

  // Load models from API
  loadModels();
});

/**
 * Prevent default drag and drop behaviors
 */
function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

/**
 * Highlight drop zone when file is dragged over
 */
function highlight() {
  dropZone.classList.add('active');
}

/**
 * Remove highlight when file leaves the drop zone
 */
function unhighlight() {
  dropZone.classList.remove('active');
}

/**
 * Handle dropped files
 */
function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;

  // Update the file input with the dropped files
  if (files.length > 0) {
    // We can't directly set files to the input, but we can use the DataTransfer API
    // to programmatically trigger a change event with the new files
    fileInput.files = files;

    // Trigger the change event to update the file list
    const event = new Event('change');
    fileInput.dispatchEvent(event);
  }
}

/**
 * Loads model data from the API and populates the dropdown
 */
async function loadModels() {
  try {
    const response = await fetch('/api/models');

    if (!response.ok) {
      throw new Error('Failed to load models');
    }

    const data = await response.json();
    modelsData = data.models;

    // Group models by provider
    const modelsByProvider = {};

    modelsData.forEach(model => {
      if (!modelsByProvider[model.provider]) {
        modelsByProvider[model.provider] = [];
      }
      modelsByProvider[model.provider].push(model);
    });

    // Clear loading option
    modelSelect.innerHTML = '';

    // Add models to dropdown grouped by provider
    Object.keys(modelsByProvider).forEach(provider => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = provider;

      modelsByProvider[provider].forEach(model => {
        const option = document.createElement('option');
        option.value = model.key;
        option.textContent = `${model.name} ($${model.inputCost.toFixed(2)}/1M input, $${model.outputCost.toFixed(2)}/1M output)`;

        // Set default model if it matches the DEFAULT_MODEL from .env
        if (model.key === 'gemini-2.0-flash-001') {
          option.selected = true;
        }

        optgroup.appendChild(option);
      });

      modelSelect.appendChild(optgroup);
    });

    // Update model info for the initially selected model
    updateModelInfo();
  } catch (error) {
    console.error('Error loading models:', error);
    modelSelect.innerHTML = '<option value="gpt-4o">GPT-4o (Default)</option>';
  }
}

/**
 * Updates the model information display when a model is selected
 */
function updateModelInfo() {
  const selectedModelKey = modelSelect.value;
  const model = modelsData.find(m => m.key === selectedModelKey);

  if (model) {
    modelInfo.innerHTML = `
      <div>Token Limit: ${model.tokenLimit.toLocaleString()} tokens</div>
      <div>Rate Limits: ${model.rpm} requests/min, ${model.tpm.toLocaleString()} tokens/min</div>
    `;
  } else {
    modelInfo.innerHTML = '';
  }
}

/**
 * Updates the file list display when files are selected
 */
function updateFileList() {
  fileList.innerHTML = '';

  if (fileInput.files.length > 0) {
    Array.from(fileInput.files).forEach((file, index) => {
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';

      const fileName = document.createElement('span');
      fileName.className = 'file-name';
      fileName.textContent = file.name;

      const removeBtn = document.createElement('span');
      removeBtn.className = 'remove-file';
      removeBtn.textContent = '×';
      removeBtn.setAttribute('data-index', index);
      removeBtn.addEventListener('click', removeFile);

      fileItem.appendChild(fileName);
      fileItem.appendChild(removeBtn);
      fileList.appendChild(fileItem);
    });
  } else {
    fileList.innerHTML = '<p>No files selected</p>';
  }
}

/**
 * Removes a file from the file input
 * Note: This is a bit tricky since file inputs can't easily have files removed
 * This implementation just visually removes the file and will filter it out during submission
 */
function removeFile(e) {
  const index = parseInt(e.target.getAttribute('data-index'));
  const fileItem = e.target.parentElement;
  fileItem.classList.add('removed-file');
  fileItem.style.display = 'none';

  // We can't actually remove files from a file input, so we'll handle this during submission
}

/**
 * Handles form submission
 * @param {Event} e - Form submit event
 */

async function handleFormSubmit(e) {
  e.preventDefault();

  if (isSubmitting) {
    return;
  }
  isSubmitting = true;

  resultsList.innerHTML = '';
  errorMessage.classList.add('hidden');
  errorMessage.textContent = '';

  submitBtn.disabled = true;

  const formData = new FormData();
  const prompt = document.getElementById('prompt').value.trim();
  const selectedModel = modelSelect.value;

  // Get server folder path from either dropdown or manual input
  const dropdown = document.getElementById('serverFolderDropdown');
  const manualInput = document.getElementById('serverFolderPath');
  const serverFolderPath = (dropdown?.value || manualInput?.value || '').trim();

  if (!prompt) {
    showError('Please enter a prompt.');
    return;
  }

  formData.append('prompt', prompt);
  formData.append('model', selectedModel);

  // Add server folder path if provided
  if (serverFolderPath) {
    formData.append('serverFolderPath', serverFolderPath);
    console.log(`Using server folder: ${serverFolderPath}`);
  }

  // Add uploaded files
  const files = Array.from(fileInput.files);
  const removedElements = document.querySelectorAll('.removed-file');
  const removedIndices = Array.from(removedElements).map(el =>
    parseInt(el.querySelector('.remove-file').getAttribute('data-index'))
  );

  files.forEach((file, index) => {
    if (!removedIndices.includes(index)) {
      formData.append('files', file);
    }
  });

  // Validate that we have at least one source
  if (!serverFolderPath && files.length === 0) {
    showError('Please upload files or specify a server folder path.');
    isSubmitting = false;
    return;
  }

  processingStatus.classList.remove('hidden');
  results.classList.add('hidden');

  try {
    const response = await fetch('/api/process-files', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to process files');
    }

    currentTimestampFolder = data.timestampFolder;
    displayResults(data.results);
  } catch (error) {
    showError(error.message || 'An error occurred while processing the files.');
  } finally {
    processingStatus.classList.add('hidden');
    submitBtn.disabled = false;
    isSubmitting = false;
  }
}

/**
 * Displays the processing results
 * @param {Array} resultsData - Array of result objects
 */
function displayResults(resultsData) {
  if (!resultsData || resultsData.length === 0) {
    showError('No results returned from the server.');
    return;
  }

  resultsList.innerHTML = '';

  // Count successful files
  const successfulFiles = resultsData.filter(result => !result.error).length;

  // Add download all button if there are successful files
  if (successfulFiles > 0 && currentTimestampFolder) {
    const downloadAllContainer = document.createElement('div');
    downloadAllContainer.className = 'download-all-container';

    const downloadAllBtn = document.createElement('button');
    downloadAllBtn.type = 'button';
    downloadAllBtn.className = 'download-all-btn';
    downloadAllBtn.innerHTML = '<span class="download-icon">📥</span> Download All Files';
    downloadAllBtn.addEventListener('click', () => downloadAllFiles(currentTimestampFolder));

    downloadAllContainer.appendChild(downloadAllBtn);
    resultsList.appendChild(downloadAllContainer);
  }

  // Add individual results
  resultsData.forEach(result => {
    const resultItem = document.createElement('div');
    resultItem.className = result.error ? 'result-item error-item' : 'result-item';

    if (result.error) {
      resultItem.innerHTML = `
        <p><strong>${result.originalFile}</strong>: Error - ${result.error}</p>
      `;
    } else {
      // Find model details to display
      let modelDetails = '';
      if (result.model) {
        const model = modelsData.find(m => m.key === result.model);
        if (model) {
          modelDetails = `${model.name} (${model.provider})`;
        } else {
          modelDetails = result.model;
        }
      }

      // Use the new path format that includes the timestamp folder
      const downloadPath = result.outputPath || `/api/outputs/${result.timestampFolder}/${result.outputFile}`;

      resultItem.innerHTML = `
        <p><strong>${result.originalFile}</strong> was processed successfully.</p>
        <p>Model used: <span class="model-used">${modelDetails}</span></p>
        <p>Output: <a href="${downloadPath}" target="_blank" download>${result.outputFile}</a></p>
      `;
    }

    resultsList.appendChild(resultItem);
  });

  // Show results section
  results.classList.remove('hidden');
}

/**
 * Downloads all files from a specific timestamp folder as a zip
 * @param {string} folder - Timestamp folder name
 */
function downloadAllFiles(folder) {
  if (!folder) {
    showError('No folder specified for download.');
    return;
  }

  // Create the download URL
  const downloadUrl = `/api/download-all/${folder}`;

  // Create a temporary link element to trigger the download
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `${folder}_processed_files.zip`;

  // Append to the document, click it, and remove it
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Shows an error message
 * @param {string} message - Error message to display
 */
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');

  // Auto-hide error after 5 seconds
  setTimeout(() => {
    errorMessage.classList.add('hidden');
  }, 5000);
}