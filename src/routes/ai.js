const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// AI Generation endpoints - properly bind context
router.post('/mindmap', (req, res) => aiController.generateMindmap(req, res));
router.post('/code', (req, res) => aiController.generateCode(req, res));
router.post('/node-code', (req, res) => aiController.generateNodeCode(req, res));  // FlowSurf.AI style PRD + Code generation
router.post('/prd', (req, res) => aiController.generatePRD(req, res));

// AI Service health and info endpoints
router.get('/health', (req, res) => aiController.healthCheck(req, res));
router.get('/providers', (req, res) => aiController.getProviders(req, res));

// Streaming endpoint
router.post('/stream', (req, res) => aiController.streamResponse(req, res));

module.exports = router;