const express = require('express');
const router = express.Router();

// Simple test route
router.get('/', (req, res) => {
  res.json({ message: 'Test route working!', timestamp: new Date().toISOString() });
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'test-routes' });
});

module.exports = router;

