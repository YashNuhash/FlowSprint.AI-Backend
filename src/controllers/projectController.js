const Project = require('../models/Project');
const logger = require('../utils/logger');
const mcpGateway = require('../services/enhancedMcpGateway');

class ProjectController {
  
  // Create a new project
  async createProject(req, res) {
    try {
      const {
        name,
        description,
        type = 'web-app',
        industry = 'tech',
        complexity = 'medium',
        tags = [],
        collaborators = []
      } = req.body;

      // Validation
      if (!name || !description) {
        return res.status(400).json({
          success: false,
          error: 'Name and description are required'
        });
      }

      const project = new Project({
        name: name.trim(),
        description: description.trim(),
        type,
        industry,
        complexity,
        tags,
        collaborators,
        createdBy: req.user?.id || 'anonymous'
      });

      await project.save();

      logger.info('Project created successfully', {
        projectId: project._id,
        name: project.name,
        service: 'flowsprint-backend'
      });

      res.status(201).json({
        success: true,
        data: project,
        message: 'Project created successfully'
      });

    } catch (error) {
      logger.error('Error creating project:', {
        error: error.message,
        service: 'flowsprint-backend'
      });

      res.status(500).json({
        success: false,
        error: 'Failed to create project',
        details: error.message
      });
    }
  }

  // Get all projects with pagination and filtering
  async getProjects(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        type,
        industry,
        sortBy = 'updatedAt',
        sortOrder = 'desc'
      } = req.query;

      // Build filter object
      const filter = {};
      if (status) filter.status = status;
      if (type) filter.type = type;
      if (industry) filter.industry = industry;

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const projects = await Project.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-generatedCode.code'); // Exclude large code content from list view

      const total = await Project.countDocuments(filter);

      res.json({
        success: true,
        data: {
          projects,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            totalProjects: total,
            hasNextPage: skip + projects.length < total,
            hasPrevPage: parseInt(page) > 1
          }
        }
      });

    } catch (error) {
      logger.error('Error fetching projects:', {
        error: error.message,
        service: 'flowsprint-backend'
      });

      res.status(500).json({
        success: false,
        error: 'Failed to fetch projects',
        details: error.message
      });
    }
  }

  // Get a single project by ID
  async getProject(req, res) {
    try {
      const { id } = req.params;

      const project = await Project.findById(id);

      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found'
        });
      }

      res.json({
        success: true,
        data: project
      });

    } catch (error) {
      logger.error('Error fetching project:', {
        error: error.message,
        projectId: req.params.id,
        service: 'flowsprint-backend'
      });

      res.status(500).json({
        success: false,
        error: 'Failed to fetch project',
        details: error.message
      });
    }
  }

  // Update a project
  async updateProject(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Remove fields that shouldn't be directly updated
      delete updates.createdAt;
      delete updates.aiUsage;
      delete updates._id;

      const project = await Project.findByIdAndUpdate(
        id,
        { ...updates, updatedAt: new Date() },
        { new: true, runValidators: true }
      );

      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found'
        });
      }

      logger.info('Project updated successfully', {
        projectId: project._id,
        service: 'flowsprint-backend'
      });

      res.json({
        success: true,
        data: project,
        message: 'Project updated successfully'
      });

    } catch (error) {
      logger.error('Error updating project:', {
        error: error.message,
        projectId: req.params.id,
        service: 'flowsprint-backend'
      });

      res.status(500).json({
        success: false,
        error: 'Failed to update project',
        details: error.message
      });
    }
  }

  // Delete a project
  async deleteProject(req, res) {
    try {
      const { id } = req.params;

      const project = await Project.findByIdAndDelete(id);

      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found'
        });
      }

      logger.info('Project deleted successfully', {
        projectId: id,
        name: project.name,
        service: 'flowsprint-backend'
      });

      res.json({
        success: true,
        message: 'Project deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting project:', {
        error: error.message,
        projectId: req.params.id,
        service: 'flowsprint-backend'
      });

      res.status(500).json({
        success: false,
        error: 'Failed to delete project',
        details: error.message
      });
    }
  }

  // Generate mindmap for a project
  async generateMindmap(req, res) {
    try {
      const { id } = req.params;
      const { complexity = 'medium' } = req.body;

      const project = await Project.findById(id);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found'
        });
      }

      // Use MCP Gateway for intelligent routing
      const mindmapPrompt = `Create a detailed project mindmap for: ${project.name}
Description: ${project.description}
Type: ${project.type}
Industry: ${project.industry}
Complexity: ${complexity}`;

      const result = await mcpGateway.routeMindmapRequest({
        prompt: mindmapPrompt,
        complexity,
        project_type: project.type
      });

      // Update project with generated mindmap
      await project.updateMindmap(result.data, result.provider);

      res.json({
        success: true,
        data: {
          mindmap: result.data,
          provider: result.provider,
          responseTime: result.responseTime,
          project: {
            id: project._id,
            name: project.name,
            progress: project.progress
          }
        },
        message: 'Mindmap generated successfully'
      });

    } catch (error) {
      logger.error('Error generating mindmap:', {
        error: error.message,
        projectId: req.params.id,
        service: 'flowsprint-backend'
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate mindmap',
        details: error.message
      });
    }
  }

  // Generate PRD for a project
  async generatePRD(req, res) {
    try {
      const { id } = req.params;
      const { sections = 'all', targetAudience = 'general' } = req.body;

      const project = await Project.findById(id);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found'
        });
      }

      // Use MCP Gateway for intelligent routing
      const prdPrompt = `Create a comprehensive Product Requirements Document for: ${project.name}
Description: ${project.description}
Type: ${project.type}
Industry: ${project.industry}
Target Audience: ${targetAudience}
Sections: ${sections}`;

      const result = await mcpGateway.routePRDRequest({
        prompt: prdPrompt,
        project_type: project.type,
        industry: project.industry,
        target_audience: targetAudience
      });

      // Update project with generated PRD
      await project.updatePRD(result.data, result.provider);

      res.json({
        success: true,
        data: {
          prd: result.data,
          provider: result.provider,
          responseTime: result.responseTime,
          project: {
            id: project._id,
            name: project.name,
            progress: project.progress
          }
        },
        message: 'PRD generated successfully'
      });

    } catch (error) {
      logger.error('Error generating PRD:', {
        error: error.message,
        projectId: req.params.id,
        service: 'flowsprint-backend'
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate PRD',
        details: error.message
      });
    }
  }

  // Generate code for a project
  async generateCode(req, res) {
    try {
      const { id } = req.params;
      const { 
        language = 'javascript', 
        framework = '', 
        features = [],
        complexity = 'medium'
      } = req.body;

      const project = await Project.findById(id);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found'
        });
      }

      // Build code generation prompt
      const codePrompt = `Generate ${language} code for: ${project.name}
Description: ${project.description}
Framework: ${framework}
Features: ${features.join(', ')}
Complexity: ${complexity}
Type: ${project.type}`;

      // Use MCP Gateway for intelligent routing
      const result = await mcpGateway.routeCodeRequest({
        prompt: codePrompt,
        language,
        complexity,
        framework
      });

      // Add generated code to project
      await project.addGeneratedCode({
        language,
        filename: `${project.name.toLowerCase().replace(/\s+/g, '-')}.${this.getFileExtension(language)}`,
        code: result.data,
        description: `Generated ${language} code for ${project.name}`,
        aiProvider: result.provider
      });

      res.json({
        success: true,
        data: {
          code: result.data,
          language,
          provider: result.provider,
          responseTime: result.responseTime,
          project: {
            id: project._id,
            name: project.name,
            progress: project.progress,
            totalCodeFiles: project.generatedCode.length
          }
        },
        message: 'Code generated successfully'
      });

    } catch (error) {
      logger.error('Error generating code:', {
        error: error.message,
        projectId: req.params.id,
        service: 'flowsprint-backend'
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate code',
        details: error.message
      });
    }
  }

  // Get project statistics
  async getProjectStats(req, res) {
    try {
      const stats = await Project.getProjectStats();
      const recentProjects = await Project.getRecentProjects(5);

      // Get status distribution
      const statusStats = await Project.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      // Get type distribution
      const typeStats = await Project.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          overview: stats[0] || {
            totalProjects: 0,
            avgProgress: 0,
            totalAIRequests: 0,
            avgResponseTime: 0
          },
          recentProjects,
          statusDistribution: statusStats,
          typeDistribution: typeStats
        }
      });

    } catch (error) {
      logger.error('Error fetching project stats:', {
        error: error.message,
        service: 'flowsprint-backend'
      });

      res.status(500).json({
        success: false,
        error: 'Failed to fetch project statistics',
        details: error.message
      });
    }
  }

  // Utility method to get file extension based on language
  getFileExtension(language) {
    const extensions = {
      'javascript': 'js',
      'typescript': 'ts',
      'python': 'py',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'html': 'html',
      'css': 'css',
      'php': 'php',
      'ruby': 'rb',
      'go': 'go',
      'rust': 'rs',
      'swift': 'swift',
      'kotlin': 'kt'
    };

    return extensions[language.toLowerCase()] || 'txt';
  }

  // Get project's generated code files
  async getProjectCode(req, res) {
    try {
      const { id } = req.params;

      const project = await Project.findById(id).select('name generatedCode');

      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found'
        });
      }

      res.json({
        success: true,
        data: {
          projectName: project.name,
          codeFiles: project.generatedCode,
          totalFiles: project.generatedCode.length
        }
      });

    } catch (error) {
      logger.error('Error fetching project code:', {
        error: error.message,
        projectId: req.params.id,
        service: 'flowsprint-backend'
      });

      res.status(500).json({
        success: false,
        error: 'Failed to fetch project code',
        details: error.message
      });
    }
  }
}

module.exports = new ProjectController();