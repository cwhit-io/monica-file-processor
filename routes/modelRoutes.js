const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// GET available models from models.json
router.get('/models', (req, res) => {
  try {
    const modelsPath = path.join(__dirname, '..', 'data', 'models.json');

    console.log(`[MODELS REQUEST] ${new Date().toISOString()}`);
    console.log(`Looking for models at: ${modelsPath}`);

    // Check if file exists
    if (!fs.existsSync(modelsPath)) {
      console.error(`✗ Models file not found at: ${modelsPath}`);
      return res.status(404).json({
        success: false,
        error: 'Models file not found',
        path: modelsPath
      });
    }

    const modelsData = fs.readFileSync(modelsPath, 'utf8');
    const parsedData = JSON.parse(modelsData);

    console.log(`✓ Models data served successfully (${parsedData.models?.length || 0} models)`);
    res.json(parsedData);

  } catch (error) {
    console.error('✗ Error reading models file:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to load models',
      message: error.message
    });
  }
});

module.exports = router;
