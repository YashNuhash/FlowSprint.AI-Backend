const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// AI Generation endpoints
router.post('/mindmap', aiController.generateMindmap);
router.post('/code', aiController.generateCode);
router.post('/prd', aiController.generatePRD);

// AI Service health and info endpoints
router.get('/health', aiController.healthCheck);
router.get('/providers', aiController.getProviders);

// Streaming endpoint
router.post('/stream', aiController.streamResponse);

module.exports = router;