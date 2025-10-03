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
        <label class="auto-refresh">
          <input type="checkbox" id="autoRefreshToggle" checked>
          Auto-refresh
        </label>
      </div>
    </div>
  `;
  
  document.querySelector('.container').appendChild(progressViewer);
  
  // Add CSS styles
  const style = document.createElement('style');
  style.textContent = `
    .progress-viewer {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 350px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      overflow: hidden;
      transition: transform 0.3s ease;
    }
    
    .progress-viewer.hidden {
      transform: translateY(calc(100% + 20px));
    }
    
    .dark-mode .progress-viewer {
      background: #2a2a2a;
      color: #f0f0f0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    
    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 15px;
      background: #f5f5f5;
      border-bottom: 1px solid #e0e0e0;
    }
    
    .dark-mode .progress-header {
      background: #333;
      border-color: #444;
    }
    
    .progress-header h2 {
      margin: 0;
      font-size: 16px;
    }
    
    .close-btn {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #666;
    }
    
    .dark-mode .close-btn {
      color: #ccc;
    }
    
    .progress-content {
      padding: 15px;
    }
    
    .progress-bar-container {
      height: 20px;
      background: #f0f0f0;
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 15px;
    }
    
    .dark-mode .progress-bar-container {
      background: #444;
    }
    
    .progress-bar {
      height: 100%;
      background: #4CAF50;
      text-align: center;
      line-height: 20px;
      color: white;
      font-size: 12px;
      transition: width 0.5s ease;
    }
    
    .progress-details {
      margin-bottom: 15px;
      font-size: 14px;
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
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .dark-mode .refresh-btn {
      background: #388E3C;
    }
    
    .auto-refresh {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 14px;
    }
    
    .status-idle { color: #888; }
    .status-processing { color: #2196F3; }
    .status-completed { color: #4CAF50; }
    .status-error { color: #F44336; }
  `;
  
  document.head.appendChild(style);
  
  // Add a progress button to the main UI
  const viewProgressBtn = document.createElement('button');
  viewProgressBtn.id = 'viewProgressBtn';
  viewProgressBtn.className = 'view-progress-btn';
  viewProgressBtn.textContent = 'View Progress';
  viewProgressBtn.addEventListener('click', showProgressViewer);
  
  // Add the button after the submit button
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    submitBtn.parentNode.appendChild(viewProgressBtn);
    
    // Add style for the button
    const btnStyle = document.createElement('style');
    btnStyle.textContent = `
      .view-progress-btn {
        margin-left: 10px;
        padding: 10px 15px;
        background: #2196F3;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      
      .dark-mode .view-progress-btn {
        background: #1976D2;
      }
    `;
    document.head.appendChild(btnStyle);
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
    html += `
      <p><strong>Current File:</strong> ${data.currentFile || 'Unknown'}</p>
      <p><strong>Progress:</strong> ${data.processedChunks} of ${data.totalChunks} chunks (${progressPercent}%)</p>
      <p><strong>Started:</strong> ${startTime}</p>
      <p><strong>Estimated Completion:</strong> ${estimatedEndTime}</p>
    `;
  } else if (data.status === 'completed') {
    html += `
      <p><strong>Last File:</strong> ${data.currentFile || 'Unknown'}</p>
      <p><strong>Completed At:</strong> ${lastUpdated}</p>
    `;
  } else if (data.status === 'error') {
    html += `
      <p><strong>File:</strong> ${data.currentFile || 'Unknown'}</p>
      <p><strong>Error:</strong> ${data.error || 'Unknown error'}</p>
      <p><strong>Time:</strong> ${lastUpdated}</p>
    `;
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
}

// Helper function to capitalize first letter
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initProgressViewer);