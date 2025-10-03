// In a routes file (e.g., create a new file called progressRoutes.js)
const express = require('express');
const router = express.Router();
const { getProgress } = require('../services/monicaService');

// GET endpoint to retrieve processing progress
router.get('/api/progress', (req, res) => {
    try {
        const progress = getProgress();
        res.json(progress);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;