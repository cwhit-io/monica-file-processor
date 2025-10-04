/**
 * Progress Viewer
 * Fetches and displays processing progress information
 */

// Configuration
const REFRESH_INTERVAL = 3000; // Refresh every 3 seconds
let refreshTimer = null;
let isViewingProgress = false;

// DOM Elements
let progressContainer;
let progressDetails;
let progressBar;
let refreshToggle;

// Initialize the progress viewer
function initProgressViewer() {
  console.log('Initializing Progress Viewer');

  // Create progress viewer elements if they don't exist
  if (!document.getElementById('progressViewer')) {
    createProgressViewerElements();
  }

  // Get references to DOM elements
  progressContainer = document.getElementById('progressViewer');
  progressDetails = document.getElementById('progressDetails');
  progressBar = document.getElementById('progressBar');
  refreshToggle = document.getElementById('autoRefreshToggle');

  // Set up event listeners
  document.getElementById('refreshProgressBtn').addEventListener('click', fetchProgress);
  document.getElementById('cancelProcessingBtn').addEventListener('click', cancelProcessing);
  refreshToggle.addEventListener('change', toggleAutoRefresh);
  document.getElementById('closeProgressBtn').addEventListener('click', hideProgressViewer);

  // Check for URL parameter to auto-show progress
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('showProgress') === 'true') {
    showProgressViewer();
  }
}

// Create the progress viewer HTML elements
function createProgressViewerElements() {
  const progressViewer = document.createElement('div');
  progressViewer.id = 'progressViewer';
  progressViewer.className = 'progress-viewer hidden';

  progressViewer.innerHTML = `
    <div class="progress-header">
      <h2>Processing Progress</h2>
      <button id="closeProgressBtn" class="close-btn">&times;</button>
    </div>
    <div class="progress-content">
      <div class="progress-bar-container">
        <div id="progressBar" class="progress-bar" style="width: 0%">0%</div>
      </div>
      <div id="progressDetails" class="progress-details">
        <p>No active processing</p>
      </div>
      <div class="progress-controls">
        <button id="refreshProgressBtn" class="refresh-btn">Refresh Now</button>
        <button id="cancelProcessingBtn" class="cancel-btn">Cancel Processing</button>
        <label class="auto-refresh">
          <input type="checkbox" id="autoRefreshToggle" checked>
          Auto-refresh
        </label>
      </div>
    </div>
  `;

  document.querySelector('.container').appendChild(progressViewer);

  // Add CSS styles that match the site theme
  const style = document.createElement('style');
  style.textContent = `
    .progress-viewer {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 350px;
      background: var(--card-bg);
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      overflow: hidden;
      transition: transform 0.3s ease;
      border: 1px solid var(--border-color);
    }
    
    .progress-viewer.hidden {
      transform: translateY(calc(100% + 20px));
    }
    
    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 15px;
      background: var(--drop-zone-bg);
      border-bottom: 1px solid var(--border-color);
    }
    
    .progress-header h2 {
      margin: 0;
      font-size: 16px;
      color: var(--text-color);
    }
    
    .close-btn {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: var(--text-color);
    }
    
    .close-btn:hover {
      color: var(--accent-color);
    }
    
    .progress-content {
      padding: 15px;
    }
    
    .progress-bar-container {
      height: 20px;
      background: var(--drop-zone-bg);
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 15px;
      border: 1px solid var(--border-color);
    }
    
    .progress-bar {
      height: 100%;
      background: var(--success-color);
      text-align: center;
      line-height: 20px;
      color: white;
      font-size: 12px;
      transition: width 0.5s ease;
    }
    
    .progress-details {
      margin-bottom: 15px;
      font-size: 14px;
      color: var(--text-color);
    }
    
    .progress-details p {
      margin: 5px 0;
    }
    
    .progress-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .refresh-btn {
      padding: 6px 12px;
      background: var(--primary-color);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9rem;
    }
    
    .refresh-btn:hover {
      background: var(--accent-color);
    }
    
    .cancel-btn {
      padding: 6px 12px;
      background: var(--error-color, #ef4444);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9rem;
      margin-left: 8px;
    }
    
    .cancel-btn:hover {
      background: #dc2626;
    }
    
    .auto-refresh {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 14px;
      color: var(--text-color);
    }
    
    .history-list {
      padding-left: 20px;
      margin: 8px 0;
      font-size: 13px;
    }
    
    .history-list li {
      margin-bottom: 4px;
    }
    
    .last-updated {
      font-size: 12px;
      color: var(--drop-zone-text);
      text-align: right;
      margin-top: 10px;
      margin-bottom: 0;
    }
    
    .status-idle { color: var(--drop-zone-text); }
    .status-processing { color: var(--primary-color); }
    .status-completed { color: var(--success-color); }
    .status-error { color: var(--error-color); }
    .status-cancelled { color: var(--error-color); }
    
    /* Improved button container styling */
    .form-group .button-container {
      display: flex;
      gap: 15px;
      align-items: center;
      flex-wrap: wrap;
    }
    
    /* Improved View Progress button styling */
    .view-progress-btn {
      padding: 0.75rem 1.5rem;
      background: var(--primary-color);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      cursor: pointer;
      transition: background-color 0.3s ease;
      white-space: nowrap;
    }
    
    .view-progress-btn:hover {
      background-color: var(--accent-color);
    }
    
    /* File count badge styling */
    .file-count-badge {
      display: inline-block;
      background-color: var(--accent-color);
      color: white;
      border-radius: 12px;
      padding: 2px 8px;
      font-size: 12px;
      margin-left: 6px;
      font-weight: bold;
    }
  `;

  document.head.appendChild(style);

  // Add a progress button to the main UI
  const viewProgressBtn = document.createElement('button');
  viewProgressBtn.id = 'viewProgressBtn';
  viewProgressBtn.className = 'view-progress-btn';
  viewProgressBtn.textContent = 'View Progress';
  viewProgressBtn.addEventListener('click', showProgressViewer);

  // Add the button after the submit button with better spacing
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    // Create a container for the buttons if it doesn't exist
    let buttonContainer = submitBtn.parentNode.querySelector('.button-container');

    if (!buttonContainer) {
      // If no button container exists, create one
      buttonContainer = document.createElement('div');
      buttonContainer.className = 'button-container';

      // Move the submit button into the container
      const parentNode = submitBtn.parentNode;
      parentNode.removeChild(submitBtn);
      buttonContainer.appendChild(submitBtn);

      // Add the container to the form group
      parentNode.appendChild(buttonContainer);
    }

    // Add the view progress button to the container
    buttonContainer.appendChild(viewProgressBtn);
  }
}

// Show the progress viewer
function showProgressViewer() {
  progressContainer.classList.remove('hidden');
  isViewingProgress = true;
  fetchProgress();

  // Start auto-refresh if enabled
  if (refreshToggle.checked) {
    startAutoRefresh();
  }
}

// Hide the progress viewer
function hideProgressViewer() {
  progressContainer.classList.add('hidden');
  isViewingProgress = false;
  stopAutoRefresh();
}

// Toggle auto-refresh
function toggleAutoRefresh() {
  if (refreshToggle.checked) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
}

// Start auto-refresh timer
function startAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  refreshTimer = setInterval(() => {
    if (isViewingProgress) {
      fetchProgress();
    }
  }, REFRESH_INTERVAL);
}

// Stop auto-refresh timer
function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// Cancel current processing
function cancelProcessing() {
  if (confirm('Are you sure you want to cancel the current processing?')) {
    fetch('/api/cancel-processing', {
      method: 'POST'
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Processing cancelled:', data);
        // Refresh progress immediately to show cancelled status
        fetchProgress();
      })
      .catch(error => {
        console.error('Error cancelling processing:', error);
        alert('Failed to cancel processing: ' + error.message);
      });
  }
}

// Fetch progress data from the API
function fetchProgress() {
  fetch('/api/progress')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      updateProgressDisplay(data);
    })
    .catch(error => {
      console.error('Error fetching progress:', error);
      progressDetails.innerHTML = `<p class="status-error">Error fetching progress: ${error.message}</p>`;
    });
}

// Update the progress display with data
function updateProgressDisplay(data) {
  // Calculate progress percentage
  let progressPercent = 0;
  if (data.totalChunks > 0) {
    progressPercent = Math.round((data.processedChunks / data.totalChunks) * 100);
  }

  // Update progress bar
  progressBar.style.width = `${progressPercent}%`;
  progressBar.textContent = `${progressPercent}%`;

  // Format times
  const startTime = data.startTime ? new Date(data.startTime).toLocaleTimeString() : 'N/A';
  const currentTime = new Date(data.currentTime).toLocaleTimeString();
  const lastUpdated = new Date(data.lastUpdated).toLocaleTimeString();
  const estimatedEndTime = data.estimatedEndTime ? new Date(data.estimatedEndTime).toLocaleTimeString() : 'Calculating...';

  // Get status class
  const statusClass = `status-${data.status}`;

  // Build HTML for progress details
  let html = `
    <p><strong>Status:</strong> <span class="${statusClass}">${capitalizeFirstLetter(data.status)}</span></p>
  `;

  if (data.status === 'processing') {
    // Show file count if available
    let fileCountHtml = '';
    if (data.totalFiles > 0) {
      fileCountHtml = `
        <p><strong>File:</strong> ${data.currentFileNumber} of ${data.totalFiles} 
          <span class="file-count-badge">${Math.round((data.currentFileNumber / data.totalFiles) * 100)}%</span>
        </p>
      `;
    }

    html += `
      <p><strong>Current File:</strong> ${data.currentFile || 'Unknown'}</p>
      ${fileCountHtml}
      <p><strong>Progress:</strong> ${data.processedChunks} of ${data.totalChunks} chunks (${progressPercent}%)</p>
      <p><strong>Started:</strong> ${startTime}</p>
      <p><strong>Estimated Completion:</strong> ${estimatedEndTime}</p>
    `;
  } else if (data.status === 'completed') {
    html += `
      <p><strong>Last File:</strong> ${data.currentFile || 'Unknown'}</p>
      <p><strong>Completed At:</strong> ${lastUpdated}</p>
    `;

    // Show file count summary if available
    if (data.totalFiles > 0) {
      html += `<p><strong>Files Processed:</strong> ${data.currentFileNumber} of ${data.totalFiles}</p>`;
    }
  } else if (data.status === 'error') {
    html += `
      <p><strong>File:</strong> ${data.currentFile || 'Unknown'}</p>
      <p><strong>Error:</strong> ${data.error || 'Unknown error'}</p>
      <p><strong>Time:</strong> ${lastUpdated}</p>
    `;

    // Show file count even for errors
    if (data.totalFiles > 0) {
      html += `<p><strong>File Progress:</strong> ${data.currentFileNumber} of ${data.totalFiles}</p>`;
    }
  } else if (data.status === 'cancelled') {
    html += `
      <p><strong>Last File:</strong> ${data.currentFile || 'Unknown'}</p>
      <p><strong>Cancelled At:</strong> ${lastUpdated}</p>
    `;

    // Show file count for cancelled processing
    if (data.totalFiles > 0) {
      html += `<p><strong>Files Processed Before Cancellation:</strong> ${data.currentFileNumber} of ${data.totalFiles}</p>`;
    }
  }

  // Add processing history if available
  if (data.processingHistory && data.processingHistory.length > 0) {
    html += `<p><strong>Recent Processing:</strong></p><ul class="history-list">`;

    // Show last 3 items
    const recentHistory = data.processingHistory.slice(-3);

    recentHistory.forEach(item => {
      const itemTime = new Date(item.timestamp).toLocaleTimeString();
      const duration = (item.duration / 1000).toFixed(1);
      const statusIcon = item.success ? '✅' : '❌';

      html += `
        <li>${statusIcon} ${item.file} (${duration}s) - ${itemTime}</li>
      `;
    });

    html += `</ul>`;
  }

  html += `<p class="last-updated"><small>Last updated: ${currentTime}</small></p>`;

  // Update the DOM
  progressDetails.innerHTML = html;

  // Show/hide cancel button based on processing status
  const cancelBtn = document.getElementById('cancelProcessingBtn');
  if (cancelBtn) {
    if (data.status === 'processing') {
      cancelBtn.style.display = 'inline-block';
    } else {
      cancelBtn.style.display = 'none';
    }
  }
}

// Helper function to capitalize first letter
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initProgressViewer);