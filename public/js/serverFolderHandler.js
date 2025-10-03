/**
 * serverFolderHandler.js
 * Handles server folder selection functionality
 * Compatible with existing file upload structure
 */

// ============================================
// DOM Elements for Server Folder Feature
// ============================================
const inputModeToggle = document.getElementById('inputModeToggle');
const uploadSection = document.getElementById('uploadSection');
const serverFolderSection = document.getElementById('serverFolderSection');
const serverFolderPath = document.getElementById('serverFolderPath');
const browseServerBtn = document.getElementById('browseServerBtn');
const availableFolders = document.getElementById('availableFolders');
const closeBrowserBtn = document.getElementById('closeBrowserBtn');
const foldersLoading = document.getElementById('foldersLoading');
const foldersList = document.getElementById('foldersList');
const serverFilesList = document.getElementById('serverFilesList');

// ============================================
// Global State for Server Folder Feature
// ============================================
let currentInputMode = 'upload'; // 'upload' or 'server'
let selectedServerFolder = null;

// ============================================
// Initialize Server Folder Feature
// ============================================
function initServerFolderFeature() {
    // Only initialize if the required elements exist
    if (!inputModeToggle || !serverFolderSection) {
        console.warn('Server folder feature elements not found. Feature disabled.');
        return;
    }

    // Mode toggle buttons
    const toggleButtons = inputModeToggle.querySelectorAll('.toggle-btn');
    toggleButtons.forEach(btn => {
        btn.addEventListener('click', handleModeToggle);
    });

    // Browse server folders button
    if (browseServerBtn) {
        browseServerBtn.addEventListener('click', loadServerFolders);
    }

    // Close browser button
    if (closeBrowserBtn) {
        closeBrowserBtn.addEventListener('click', closeFoldersBrowser);
    }

    // Server folder path input with debounce
    if (serverFolderPath) {
        serverFolderPath.addEventListener('input', debounce(handleFolderPathInput, 500));

        // Update placeholder to show relative path format
        serverFolderPath.placeholder = 'e.g., server-folders/batch1';
    }

    console.log('Server folder feature initialized');
}

// ============================================
// Mode Toggle Handler
// ============================================
function handleModeToggle(e) {
    const clickedBtn = e.currentTarget;
    const mode = clickedBtn.dataset.mode;

    // Update button active states
    const toggleButtons = inputModeToggle.querySelectorAll('.toggle-btn');
    toggleButtons.forEach(btn => btn.classList.remove('active'));
    clickedBtn.classList.add('active');

    // Toggle sections
    if (mode === 'upload') {
        if (uploadSection) uploadSection.classList.add('active');
        if (serverFolderSection) serverFolderSection.classList.remove('active');
        currentInputMode = 'upload';
    } else {
        if (uploadSection) uploadSection.classList.remove('active');
        if (serverFolderSection) serverFolderSection.classList.add('active');
        currentInputMode = 'server';
    }

    // Clear any errors
    if (typeof showError !== 'undefined') {
        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) errorMessage.classList.add('hidden');
    }
}

// ============================================
// Load Available Server Folders
// ============================================
async function loadServerFolders() {
    if (!availableFolders || !foldersLoading || !foldersList) return;

    // Show browser and loading state
    availableFolders.classList.remove('hidden');
    foldersLoading.classList.remove('hidden');
    foldersList.innerHTML = '';

    try {
        const response = await fetch('/api/server-folders/available');

        if (!response.ok) {
            throw new Error('Failed to load server folders');
        }

        const data = await response.json();

        // Hide loading
        foldersLoading.classList.add('hidden');

        if (!data.folders || data.folders.length === 0) {
            foldersList.innerHTML = `
                <div class="empty-state">
                    <p>📁 No folders found in server-folders/</p>
                    <p style="font-size: 12px; margin-top: 8px; color: #6b7280;">
                        Create folders in: monica-file-processor/server-folders/
                    </p>
                </div>
            `;
            return;
        }

        // Render folders
        data.folders.forEach(folder => {
            const folderItem = createFolderItem(folder);
            foldersList.appendChild(folderItem);
        });

    } catch (error) {
        foldersLoading.classList.add('hidden');
        foldersList.innerHTML = `<p class="empty-state" style="color: #ef4444;">Error: ${error.message}</p>`;
    }
}

// ============================================
// Create Folder Item Element
// ============================================
function createFolderItem(folder) {
    const item = document.createElement('div');
    item.className = 'folder-item';
    item.dataset.path = folder.path;

    // Format date
    const modifiedDate = new Date(folder.modified).toLocaleDateString();

    item.innerHTML = `
    <div class="folder-info">
      <span class="folder-icon">📁</span>
      <div class="folder-details">
        <h4>${escapeHtml(folder.name)}</h4>
        <div class="folder-meta">
          ${folder.fileCount} files • ${escapeHtml(folder.path)} • ${modifiedDate}
        </div>
      </div>
    </div>
    <button type="button" class="select-folder-btn">Select</button>
  `;

    // Click on item to highlight selection
    item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('select-folder-btn')) {
            document.querySelectorAll('.folder-item').forEach(f => f.classList.remove('selected'));
            item.classList.add('selected');
            selectedServerFolder = folder;
        }
    });

    // Select button to confirm selection
    const selectBtn = item.querySelector('.select-folder-btn');
    selectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (serverFolderPath) {
            serverFolderPath.value = folder.path;
        }
        closeFoldersBrowser();
        previewServerFolder(folder.path);
    });

    return item;
}

// ============================================
// Close Folders Browser
// ============================================
function closeFoldersBrowser() {
    if (availableFolders) {
        availableFolders.classList.add('hidden');
    }
    selectedServerFolder = null;
}

// ============================================
// Handle Manual Folder Path Input
// ============================================
function handleFolderPathInput() {
    if (!serverFolderPath) return;

    const path = serverFolderPath.value.trim();
    if (path) {
        previewServerFolder(path);
    } else {
        if (serverFilesList) {
            serverFilesList.innerHTML = '';
        }
    }
}

// ============================================
// Preview Files in Server Folder
// ============================================
async function previewServerFolder(folderPath) {
    if (!serverFilesList) return;

    serverFilesList.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading files...</p></div>';

    try {
        const response = await fetch('/api/server-folders/files', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ folderPath })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Folder not found or inaccessible');
        }

        const data = await response.json();

        // Clear loading
        serverFilesList.innerHTML = '';

        if (!data.files || data.files.length === 0) {
            serverFilesList.innerHTML = '<p class="empty-state">No files found in this folder</p>';
            return;
        }

        // Create preview header
        const previewHeader = document.createElement('h4');
        previewHeader.innerHTML = `📄 ${data.files.length} file(s) found in ${escapeHtml(data.folder)}`;
        previewHeader.style.marginBottom = '12px';
        previewHeader.style.color = '#374151';
        serverFilesList.appendChild(previewHeader);

        // Create files list
        const previewList = document.createElement('div');
        previewList.className = 'files-preview-list';

        data.files.forEach(file => {
            const fileItem = createFilePreviewItem(file);
            previewList.appendChild(fileItem);
        });

        serverFilesList.appendChild(previewList);

    } catch (error) {
        serverFilesList.innerHTML = `<p class="empty-state" style="color: #ef4444;">❌ ${error.message}</p>`;
    }
}

// ============================================
// Create File Preview Item
// ============================================
function createFilePreviewItem(file) {
    const item = document.createElement('div');
    item.className = 'file-preview-item';

    const icon = getFileIcon(file.name);
    const size = formatFileSize(file.size);

    item.innerHTML = `
    <div class="file-preview-info">
      <span class="file-type-icon">${icon}</span>
      <div>
        <div class="file-preview-name">${escapeHtml(file.name)}</div>
        <div class="file-preview-size">${size}</div>
      </div>
    </div>
  `;

    return item;
}

// ============================================
// Get File Icon Based on Extension
// ============================================
function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
        'pdf': '📕',
        'doc': '📘',
        'docx': '📘',
        'txt': '📄',
        'srt': '📝',
        'vtt': '📝',
        'wav': '🎵',
        'mp3': '🎵',
        'mp4': '🎬',
        'avi': '🎬',
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'png': '🖼️',
        'gif': '🖼️',
        'webp': '🖼️'
    };
    return iconMap[ext] || '📄';
}

// ============================================
// Format File Size
// ============================================
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ============================================
// Debounce Utility
// ============================================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// Escape HTML to Prevent XSS
// ============================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// Get Current Input Mode (for form submission)
// ============================================
function getCurrentInputMode() {
    return currentInputMode;
}

// ============================================
// Get Server Folder Path (for form submission)
// ============================================
function getServerFolderPath() {
    return serverFolderPath ? serverFolderPath.value.trim() : '';
}

// ============================================
// Validate Server Folder Input
// ============================================
function validateServerFolderInput() {
    if (currentInputMode === 'server') {
        const path = getServerFolderPath();
        if (!path) {
            if (typeof showError === 'function') {
                showError('Please specify a server folder path.');
            }
            return false;
        }
        // Basic validation - should start with server-folders/
        if (!path.startsWith('server-folders/')) {
            if (typeof showError === 'function') {
                showError('Path must start with "server-folders/"');
            }
            return false;
        }
        return true;
    }
    return true; // Not in server mode, validation passes
}

// ============================================
// Initialize on DOM Load
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initServerFolderFeature();
});

// ============================================
// Export functions for use in main app.js
// ============================================
// If using modules, export these:
// export { getCurrentInputMode, getServerFolderPath, validateServerFolderInput };
// Load server folders on page load
document.addEventListener('DOMContentLoaded', function () {
    loadServerFolders();

    // Refresh button handler
    document.getElementById('refreshFoldersBtn').addEventListener('click', function () {
        loadServerFolders();
    });

    // Dropdown change handler - update the manual input field
    document.getElementById('serverFolderDropdown').addEventListener('change', function () {
        const selectedPath = this.value;
        document.getElementById('serverFolderPath').value = selectedPath;
    });

    // Manual input change handler - clear dropdown selection
    document.getElementById('serverFolderPath').addEventListener('input', function () {
        const dropdown = document.getElementById('serverFolderDropdown');
        if (this.value !== dropdown.value) {
            dropdown.value = '';
        }
    });
});

// Function to load server folders
async function loadServerFolders() {
    const dropdown = document.getElementById('serverFolderDropdown');
    const refreshBtn = document.getElementById('refreshFoldersBtn');

    try {
        // Show loading state
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';

        const response = await fetch('/api/server-folders');
        const data = await response.json();

        if (data.success) {
            // Clear existing options except the first one
            dropdown.innerHTML = '<option value="">-- Select a folder --</option>';

            // Add folders to dropdown
            if (data.folders.length === 0) {
                dropdown.innerHTML += '<option value="" disabled>No folders found in server-folders/</option>';
            } else {
                data.folders.forEach(folder => {
                    const option = document.createElement('option');
                    option.value = folder.path;
                    option.textContent = folder.name;
                    dropdown.add(option);
                });
            }

            console.log(`✓ Loaded ${data.folders.length} server folders`);
        } else {
            console.error('Failed to load server folders:', data.message);
            showNotification('Failed to load server folders', 'error');
        }

    } catch (error) {
        console.error('Error loading server folders:', error);
        dropdown.innerHTML = '<option value="">-- Error loading folders --</option>';
        showNotification('Error loading server folders', 'error');
    } finally {
        // Restore button state
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
    }
}

// Helper function to show notifications (if you don't have one already)
function showNotification(message, type = 'info') {
    // You can implement this based on your existing notification system
    // For now, just console log
    console.log(`[${type.toUpperCase()}] ${message}`);
}
