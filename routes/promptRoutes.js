const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { logInfo, logError } = require('../utils/logger');
const { paths } = require('../config/paths');

// Path to prompts.json
const promptsPath = paths.prompts;

// GET route to serve prompt information
router.get('/prompts', async (req, res) => {
    try {
        // Check if file exists
        try {
            await fs.access(promptsPath);
        } catch (error) {
            return res.status(404).json({
                success: false,
                message: 'Prompts data not found'
            });
        }

        // Read the file
        const data = await fs.readFile(promptsPath, 'utf8');
        const promptData = JSON.parse(data);

        res.json({
            success: true,
            prompts: promptData.prompts
        });
    } catch (error) {
        logError(`Error serving prompts data: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Error retrieving prompts data'
        });
    }
});

// POST route to save a new prompt
router.post('/prompts', async (req, res) => {
    try {
        const { name, text } = req.body;

        // Validate input
        if (!name || !text) {
            return res.status(400).json({
                success: false,
                message: 'Prompt name and text are required'
            });
        }

        // Read existing prompts
        let promptData;
        try {
            const data = await fs.readFile(promptsPath, 'utf8');
            promptData = JSON.parse(data);
        } catch (error) {
            // If file doesn't exist or is invalid, create a new structure
            promptData = { prompts: [] };
        }

        // Check if prompt with same name already exists
        const existingIndex = promptData.prompts.findIndex(p => p.name === name);

        if (existingIndex !== -1) {
            // Update existing prompt
            promptData.prompts[existingIndex] = { name, text };
            logInfo(`Updated existing prompt: ${name}`);
        } else {
            // Add new prompt
            promptData.prompts.push({ name, text });
            logInfo(`Added new prompt: ${name}`);
        }

        // Write back to file
        await fs.writeFile(promptsPath, JSON.stringify(promptData, null, 2), 'utf8');

        res.json({
            success: true,
            message: existingIndex !== -1 ? 'Prompt updated successfully' : 'Prompt saved successfully',
            prompt: { name, text }
        });
    } catch (error) {
        logError(`Error saving prompt: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Error saving prompt',
            error: error.message
        });
    }
});

// DELETE route to remove a prompt
router.delete('/prompts/:name', async (req, res) => {
    try {
        const promptName = req.params.name;

        // Read existing prompts
        let promptData;
        try {
            const data = await fs.readFile(promptsPath, 'utf8');
            promptData = JSON.parse(data);
        } catch (error) {
            return res.status(404).json({
                success: false,
                message: 'Prompts data not found'
            });
        }

        // Find the prompt to delete
        const initialLength = promptData.prompts.length;
        promptData.prompts = promptData.prompts.filter(p => p.name !== promptName);

        if (promptData.prompts.length === initialLength) {
            return res.status(404).json({
                success: false,
                message: `Prompt "${promptName}" not found`
            });
        }

        // Write back to file
        await fs.writeFile(promptsPath, JSON.stringify(promptData, null, 2), 'utf8');

        logInfo(`Deleted prompt: ${promptName}`);
        res.json({
            success: true,
            message: `Prompt "${promptName}" deleted successfully`
        });
    } catch (error) {
        logError(`Error deleting prompt: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Error deleting prompt',
            error: error.message
        });
    }
});

module.exports = router;