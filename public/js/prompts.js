// Prompt management functionality
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const promptInput = document.getElementById('prompt');
  const promptsDropdown = document.getElementById('savedPrompts');
  const deletePromptBtn = document.getElementById('deletePromptBtn');
  const promptNameInput = document.getElementById('promptName');
  const savePromptModal = document.getElementById('savePromptModal');
  const savePromptForm = document.getElementById('savePromptForm');
  const closeModalBtn = document.getElementById('closeModal');
  const openSaveModalBtn = document.getElementById('openSaveModalBtn');
  const errorMessage = document.getElementById('errorMessage');

  // Force hide the modal with both class and style
  if (savePromptModal) {
    savePromptModal.classList.add('hidden');
    savePromptModal.style.display = 'none';
  }

  // Event Listeners
  if (openSaveModalBtn) {
    openSaveModalBtn.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent any default behavior
      openSaveModal();
    });
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent any default behavior
      closeModal();
    });
  }

  if (savePromptForm) {
    savePromptForm.addEventListener('submit', handleSavePrompt);
  }

  if (promptsDropdown) {
    promptsDropdown.addEventListener('change', loadSelectedPrompt);
  }

  if (deletePromptBtn) {
    deletePromptBtn.addEventListener('click', deleteSelectedPrompt);
  }

  // Load saved prompts on page load
  loadSavedPrompts();

  /**
   * Opens the save prompt modal
   */
  function openSaveModal() {
    const currentPrompt = promptInput.value.trim();
    if (!currentPrompt) {
      showError('Please enter a prompt before saving.');
      return;
    }

    promptNameInput.value = '';
    if (savePromptModal) {
      savePromptModal.classList.remove('hidden');
      savePromptModal.style.display = 'flex';
    }
  }

  /**
   * Closes the save prompt modal
   */
  function closeModal() {
    if (savePromptModal) {
      savePromptModal.classList.add('hidden');
      savePromptModal.style.display = 'none';
    }
  }

  /**
   * Handles saving a prompt
   * @param {Event} e - Form submit event
   */
  async function handleSavePrompt(e) {
    e.preventDefault();

    const promptName = promptNameInput.value.trim();
    const promptText = promptInput.value.trim();

    if (!promptName) {
      alert('Please enter a name for your prompt.');
      return;
    }

    if (!promptText) {
      alert('Cannot save an empty prompt.');
      return;
    }

    try {
      // Save prompt to server
      const response = await fetch('/api/prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: promptName, text: promptText })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save prompt');
      }

      // Update dropdown
      await loadSavedPrompts();

      // Close modal
      closeModal();

      // Show confirmation
      showSuccess(`Prompt "${promptName}" has been saved.`);
    } catch (error) {
      showError(`Error saving prompt: ${error.message}`);
    }
  }

  /**
   * Loads saved prompts into the dropdown
   */
  async function loadSavedPrompts() {
    if (!promptsDropdown) return;

    try {
      // Clear dropdown except for the first option
      while (promptsDropdown.options.length > 1) {
        promptsDropdown.remove(1);
      }

      // Get saved prompts from server
      const response = await fetch('/api/prompts');

      if (!response.ok) {
        throw new Error('Failed to load prompts');
      }

      const data = await response.json();
      const savedPrompts = data.prompts || [];

      if (savedPrompts.length === 0) {
        // If no saved prompts, disable the dropdown and delete button
        promptsDropdown.disabled = true;
        if (deletePromptBtn) deletePromptBtn.disabled = true;
        return;
      }

      // Enable the dropdown and delete button
      promptsDropdown.disabled = false;
      if (deletePromptBtn) deletePromptBtn.disabled = false;

      // Add prompts to dropdown
      savedPrompts.forEach(prompt => {
        const option = document.createElement('option');
        option.value = prompt.name;
        option.textContent = prompt.name;
        promptsDropdown.appendChild(option);
      });
    } catch (error) {
      console.error('Error loading prompts:', error);
      showError(`Error loading prompts: ${error.message}`);
    }
  }

  /**
   * Loads the selected prompt into the prompt input
   */
  async function loadSelectedPrompt() {
    const selectedPromptName = promptsDropdown.value;

    if (!selectedPromptName) {
      return;
    }

    try {
      // Get saved prompts from server
      const response = await fetch('/api/prompts');

      if (!response.ok) {
        throw new Error('Failed to load prompts');
      }

      const data = await response.json();
      const savedPrompts = data.prompts || [];

      const selectedPrompt = savedPrompts.find(p => p.name === selectedPromptName);

      if (selectedPrompt) {
        promptInput.value = selectedPrompt.text;
        // Enable delete button only when a prompt is selected
        if (deletePromptBtn) deletePromptBtn.disabled = false;
      }
    } catch (error) {
      console.error('Error loading prompt:', error);
      showError(`Error loading prompt: ${error.message}`);
    }
  }

  /**
   * Deletes the selected prompt
   */
  async function deleteSelectedPrompt() {
    const selectedPromptName = promptsDropdown.value;

    if (!selectedPromptName) {
      return;
    }

    if (confirm(`Are you sure you want to delete the prompt "${selectedPromptName}"?`)) {
      try {
        // Delete prompt from server
        const response = await fetch(`/api/prompts/${encodeURIComponent(selectedPromptName)}`, {
          method: 'DELETE'
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to delete prompt');
        }

        // Update dropdown
        await loadSavedPrompts();

        // Reset to default option
        promptsDropdown.selectedIndex = 0;

        // Disable delete button
        if (deletePromptBtn) deletePromptBtn.disabled = true;

        showSuccess(`Prompt "${selectedPromptName}" has been deleted.`);
      } catch (error) {
        showError(`Error deleting prompt: ${error.message}`);
      }
    }
  }

  /**
   * Shows an error message
   * @param {string} message - Error message to display
   */
  function showError(message) {
    if (errorMessage) {
      errorMessage.textContent = message;
      errorMessage.classList.remove('hidden');

      // Auto-hide error after 5 seconds
      setTimeout(() => {
        errorMessage.classList.add('hidden');
      }, 5000);
    } else {
      alert(message);
    }
  }

  /**
   * Shows a success message
   * @param {string} message - Success message to display
   */
  function showSuccess(message) {
    // You could create a dedicated success message element
    // For now, we'll reuse the error message element with different styling
    if (errorMessage) {
      errorMessage.textContent = message;
      errorMessage.classList.remove('hidden');
      errorMessage.style.color = 'var(--success-color, #059669)';

      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        errorMessage.classList.add('hidden');
        errorMessage.style.color = ''; // Reset color
      }, 5000);
    } else {
      alert(message);
    }
  }

  // Add event listener to close modal when clicking outside of it
  window.addEventListener('click', (e) => {
    if (e.target === savePromptModal) {
      closeModal();
    }
  });

  // Add keyboard event listener to close modal with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && savePromptModal && !savePromptModal.classList.contains('hidden')) {
      closeModal();
    }
  });
});