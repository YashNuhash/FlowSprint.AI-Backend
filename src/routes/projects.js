const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');

// Project CRUD routes
router.post('/', projectController.createProject);
router.get('/', projectController.getProjects);
router.get('/stats', projectController.getProjectStats);
router.get('/:id', projectController.getProject);
router.put('/:id', projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

// AI Generation routes
router.post('/:id/mindmap', projectController.generateMindmap);
router.post('/:id/prd', projectController.generatePRD);
router.post('/:id/code', projectController.generateCode);
router.get('/:id/code', projectController.getProjectCode);

module.exports = router;