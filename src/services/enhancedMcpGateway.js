const Docker = require('dockerode');
const consul = require('consul');
const logger = require('../utils/logger');
const openRouterService = require('./openRouterService');
const cerebrasService = require('./cerebrasService');
const metaLlamaService = require('./metaLlamaService');

class EnhancedMcpGateway {
  constructor() {
    this.docker = new Docker();
    this.consul = new consul({
      host: process.env.CONSUL_HOST || 'localhost',
      port: process.env.CONSUL_PORT || 8500
    });
    
    this.services = new Map();
    this.loadBalancer = {
      mindmapServices: [],
      codeServices: [],
      prdServices: []
    };
    
    this.serviceHealth = new Map();
    this.requestQueue = [];
    this.isProcessingQueue = false;
    
    // Initialize services
    this.initializeServices();
  }

  async initializeServices() {
    logger.info('Initializing Enhanced MCP Gateway...');
    
    // Register AI services
    this.registerService('openrouter', openRouterService);
    this.registerService('cerebras', cerebrasService);
    this.registerService('meta-llama', metaLlamaService);
    
    // Start health monitoring
    this.startHealthMonitoring();
    
    // Initialize Docker services if enabled
    if (process.env.MCP_ENABLED === 'true') {
      await this.initializeDockerServices();
    }
  }

  registerService(name, service) {
    this.services.set(name, {
      instance: service,
      healthy: true,
      lastHealthCheck: Date.now(),
      requestCount: 0,
      avgResponseTime: 0,
      errors: 0
    });
    
    logger.info(`Registered service: ${name}`);
  }

  // Intelligent routing based on request type and service health
  async routeRequest(requestType, payload, options = {}) {
    const startTime = Date.now();
    
    try {
      let result;
      
      switch (requestType) {
        case 'mindmap':
          result = await this.routeMindmapRequest(payload, options);
          break;
        case 'code':
          result = await this.routeCodeRequest(payload, options);
          break;
        case 'node-code':
          result = await this.routeNodeCodeRequest(payload, options);
          break;
        case 'prd':
          result = await this.routePRDRequest(payload, options);
          break;
        default:
          throw new Error(`Unknown request type: ${requestType}`);
      }

      const responseTime = Date.now() - startTime;
      this.updateServiceMetrics(result.provider, responseTime, true);
      
      return {
        ...result,
        routingMetadata: {
          responseTime,
          provider: result.provider,
          requestType,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error(`Routing error for ${requestType}:`, error.message);
      
      // Try fallback routing
      return await this.handleRoutingFallback(requestType, payload, options, error);
    }
  }

  // Smart mindmap routing: Cerebras first (speed), then OpenRouter with Llama 4
  async routeMindmapRequest(payload, options) {
    const { prompt, projectDescription, priority = 'speed' } = payload;
    const description = prompt || projectDescription;
    
    if (priority === 'speed' && this.isServiceHealthy('cerebras')) {
      try {
        logger.info('🚀 MCP Gateway: Using Cerebras for ultra-fast mindmap generation');
        const rawResult = await cerebrasService.generateMindmapUltraFast(description, options);
        
        // Extract content from Cerebras API response format
        const content = rawResult.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('No content in Cerebras response');
        }
        
        // Try to parse as JSON, fallback to text parsing if needed
        let mindmapData;
        try {
          mindmapData = JSON.parse(content);
        } catch (parseError) {
          logger.warn('Cerebras returned non-JSON, attempting text parsing...');
          // Basic text-to-mindmap conversion
          mindmapData = this.parseTextToMindmap(content);
        }
        
        logger.info('✅ MCP Gateway: Cerebras mindmap parsed successfully', {
          contentLength: content.length,
          hasNodes: !!mindmapData.nodes,
          nodeCount: mindmapData.nodes?.length || 0
        });
        
        return { 
          data: mindmapData, 
          provider: 'cerebras', 
          model: 'llama3.1-8b',
          responseTime: rawResult.metadata?.responseTime
        };
      } catch (error) {
        logger.warn('Cerebras mindmap failed, falling back to OpenRouter:', error.message);
      }
    }
    
    // Fallback to OpenRouter with Llama 4 Scout (free)
    logger.info('🔄 MCP Gateway: Falling back to OpenRouter for mindmap generation');
    const result = await openRouterService.generateMindmap(description, options);
    return { ...result, provider: 'openrouter', model: 'llama-4-scout' };
  }

  // Helper function to convert text response to mindmap tree structure
  parseTextToMindmap(content) {
    // Parse lines and organize into hierarchical structure
    const lines = content.split('\n').filter(line => line.trim());
    const children = [];
    let nodeId = 1;
    
    // Group lines by sections/phases
    let currentSection = null;
    const sections = [];
    
    for (const line of lines) {
      let trimmed = line.trim();
      if (!trimmed || trimmed.length < 5) continue;
      
      // Skip meta-text lines
      if (trimmed.toLowerCase().includes('here is a') || 
          trimmed.toLowerCase().includes('this mindmap') ||
          trimmed.toLowerCase().includes('detailed technical development') ||
          trimmed.toLowerCase().includes('comprehensive roadmap')) {
        continue;
      }
      
      // Clean title: remove markdown formatting
      const cleanTitle = this.cleanNodeTitle(trimmed);
      if (!cleanTitle || cleanTitle.length < 3) continue;
      
      // Generate meaningful description
      const description = this.generateMeaningfulDescription(cleanTitle);
      
      // Detect section headers (SETUP, DEVELOPMENT, etc.)
      if (trimmed.match(/^[A-Z\s]+:/) || trimmed.includes('PHASE') || trimmed.includes('SETUP') || trimmed.includes('DEVELOPMENT')) {
        if (currentSection) sections.push(currentSection);
        currentSection = {
          id: `section_${sections.length + 1}`,
          text: cleanTitle,
          title: cleanTitle,
          description: description,
          type: 'milestone',
          children: []
        };
      } else if (currentSection) {
        // Add task to current section
        currentSection.children.push({
          id: `node_${nodeId++}`,
          text: cleanTitle,
          title: cleanTitle,
          description: description,
          type: this.determineTaskType(cleanTitle)
        });
      } else {
        // Standalone task
        children.push({
          id: `node_${nodeId++}`,
          text: cleanTitle,
          title: cleanTitle,
          description: description,
          type: nodeId <= 3 ? 'start' : this.determineTaskType(cleanTitle)
        });
      }
    }
    
    // Add final section
    if (currentSection) sections.push(currentSection);
    
    // If we have sections, use them as children
    if (sections.length > 0) {
      children.push(...sections);
    }
    
    // Create root tree structure
    return {
      id: 'root',
      text: 'Project Development Roadmap',
      title: 'Project Development Roadmap', 
      description: 'Comprehensive technical development roadmap with detailed implementation tasks and milestones',
      type: 'start',
      children: children.length > 0 ? children : [
        {
          id: 'node_1',
          text: 'Development tasks generated from AI',
          title: 'Development tasks generated from AI',
          description: 'AI-generated development tasks and technical implementation details',
          type: 'task'
        }
      ]
    };
  }

  // Clean node titles - remove markdown and formatting
  cleanNodeTitle(text) {
    return text
      .replace(/^\*\*|\*\*$/g, '') // Remove bold markdown (**text**)
      .replace(/^[-*•]\s*/, '') // Remove bullet points
      .replace(/^\d+\.\s*/, '') // Remove numbering (1. 2.)
      .replace(/^#+\s*/, '') // Remove headers (# ##)
      .replace(/^[A-Z\s]+:\s*/, '') // Remove "PHASE:" patterns
      .replace(/[*_]{1,2}/g, '') // Remove remaining markdown
      .trim();
  }

  // Generate meaningful descriptions instead of "title: Implementation and technical details"
  generateMeaningfulDescription(title) {
    const lowerTitle = title.toLowerCase();
    
    if (lowerTitle.includes('setup') || lowerTitle.includes('initialize')) {
      return `Configure and set up ${title.toLowerCase()}, including necessary dependencies, environment variables, and initial configuration`;
    } else if (lowerTitle.includes('implement') || lowerTitle.includes('develop') || lowerTitle.includes('create')) {
      return `Build and implement ${title.toLowerCase()}, including core functionality, error handling, validation, and integration`;
    } else if (lowerTitle.includes('test') || lowerTitle.includes('testing')) {
      return `Write comprehensive tests for ${title.toLowerCase()}, including unit tests, integration tests, and validation scenarios`;
    } else if (lowerTitle.includes('deploy') || lowerTitle.includes('deployment')) {
      return `Deploy and configure ${title.toLowerCase()} in production environment with monitoring, logging, and performance optimization`;
    } else if (lowerTitle.includes('database') || lowerTitle.includes('schema')) {
      return `Design and implement ${title.toLowerCase()}, including data models, relationships, indexes, and migration scripts`;
    } else if (lowerTitle.includes('api') || lowerTitle.includes('endpoint')) {
      return `Develop ${title.toLowerCase()} with proper routing, validation, authentication, rate limiting, and error responses`;
    } else if (lowerTitle.includes('component') || lowerTitle.includes('ui')) {
      return `Build ${title.toLowerCase()} with responsive design, proper state management, accessibility, and user interactions`;
    } else {
      return `Complete the technical implementation of ${title.toLowerCase()} with proper integration, testing, and documentation`;
    }
  }

  // Determine appropriate task type based on content
  determineTaskType(title) {
    const lowerTitle = title.toLowerCase();
    
    if (lowerTitle.includes('deploy') || lowerTitle.includes('launch') || lowerTitle.includes('production')) return 'end';
    if (lowerTitle.includes('milestone') || lowerTitle.includes('phase') || lowerTitle.includes('mvp')) return 'milestone';
    if (lowerTitle.includes('component') || lowerTitle.includes('ui') || lowerTitle.includes('frontend')) return 'component';
    
    return 'task';
  }

  // Code routing: Meta Llama first (quality), then OpenRouter with Llama 4
  async routeCodeRequest(payload, options) {
    const { requirements, language, complexity = 'medium' } = payload;
    
    if (this.isServiceHealthy('meta-llama') && complexity !== 'low') {
      try {
        const result = await metaLlamaService.generateCode(requirements, language, complexity);
        return { ...result, provider: 'meta-llama', model: 'llama-4-scout' };
      } catch (error) {
        logger.warn('Meta Llama code generation failed, falling back to OpenRouter');
      }
    }
    
    // Fallback to OpenRouter with Llama 4 Maverick (free)
    const result = await openRouterService.generateCode(requirements, language, options);
    return { ...result, provider: 'openrouter', model: 'llama-4-maverick' };
  }

  // Node Code routing: FlowSurf.AI style PRD + Code generation
  async routeNodeCodeRequest(payload, options) {
    const { prompt, nodeTitle, complexity = 'medium' } = payload;
    
    logger.info(`Routing node code request for: ${nodeTitle}`);
    logger.info(`Complexity: ${complexity}`);
    
    // First try Meta Llama for highest quality PRD + Code generation
    if (this.isServiceHealthy('meta-llama') && complexity !== 'low') {
      try {
        logger.info('🎯 MCP Gateway: Using Meta Llama for node code generation');
        const result = await metaLlamaService.generateNodeCode(prompt, payload);
        return { ...result, provider: 'meta-llama', model: 'llama-4-scout' };
      } catch (error) {
        logger.warn('Meta Llama node code generation failed, falling back to OpenRouter:', error.message);
      }
    }
    
    // Fallback to OpenRouter with enhanced prompt for PRD + Code
    logger.info('🔄 MCP Gateway: Using OpenRouter for node code generation');
    const enhancedPrompt = this.enhanceNodeCodePrompt(prompt, payload);
    const result = await openRouterService.generateCode(enhancedPrompt, payload.codeOptions?.language || 'typescript', {
      ...options,
      includePRD: true,
      nodeContext: payload
    });
    
    return { ...result, provider: 'openrouter', model: 'llama-4-maverick' };
  }

  // Helper method to enhance prompt for better PRD + Code generation
  enhanceNodeCodePrompt(originalPrompt, payload) {
    const { nodeTitle, nodeDescription, nodeType, projectContext, codeOptions } = payload;
    
    return `${originalPrompt}

🚨 CRITICAL REQUIREMENTS:
1. Generate BOTH comprehensive PRD documentation AND production-ready code
2. PRD must include: Purpose, Requirements, User Stories, Acceptance Criteria, Technical Specs
3. Code must be complete, functional, and ready for production use
4. Format response as structured JSON if possible with separate "prd" and "code" fields for each file
5. Include proper TypeScript interfaces, error handling, and responsive design
6. Follow ${projectContext?.name || 'modern web'} application patterns and conventions

Return multiple files if needed (component + styles + tests), each with its own PRD section.`;
  }

  // PRD routing: Meta Llama for comprehensive, OpenRouter for standard
  async routePRDRequest(payload, options) {
    const { projectIdea, complexity = 'standard' } = payload;
    
    if (complexity === 'comprehensive' && this.isServiceHealthy('meta-llama')) {
      try {
        const result = await metaLlamaService.generateComprehensivePRD(projectIdea);
        return { ...result, provider: 'meta-llama' };
      } catch (error) {
        logger.warn('Meta Llama PRD generation failed, falling back to OpenRouter');
      }
    }
    
    // Use OpenRouter for standard PRDs
    const result = await openRouterService.generatePRD(projectIdea, options);
    return { ...result, provider: 'openrouter' };
  }

  // Fallback routing when primary service fails
  async handleRoutingFallback(requestType, payload, options, originalError) {
    logger.info(`Attempting fallback routing for ${requestType}`);
    
    const fallbackOrder = this.getFallbackOrder(requestType);
    
    for (const serviceName of fallbackOrder) {
      if (this.isServiceHealthy(serviceName)) {
        try {
          let result;
          const service = this.services.get(serviceName).instance;
          
          switch (requestType) {
            case 'mindmap':
              if (serviceName === 'openrouter') {
                result = await service.generateMindmap(payload.projectDescription, options);
              }
              break;
            case 'code':
              if (serviceName === 'openrouter') {
                result = await service.generateCode(payload.requirements, payload.language, options);
              } else if (serviceName === 'meta-llama') {
                result = await service.generateCode(payload.requirements, payload.language);
              }
              break;
            case 'prd':
              if (serviceName === 'openrouter') {
                result = await service.generatePRD(payload.projectIdea, options);
              } else if (serviceName === 'meta-llama') {
                result = await service.generateComprehensivePRD(payload.projectIdea);
              }
              break;
          }
          
          if (result) {
            return { 
              ...result, 
              provider: serviceName,
              fallback: true,
              originalError: originalError.message
            };
          }
        } catch (fallbackError) {
          logger.warn(`Fallback ${serviceName} also failed:`, fallbackError.message);
        }
      }
    }
    
    throw new Error(`All services failed for ${requestType}. Original error: ${originalError.message}`);
  }

  getFallbackOrder(requestType) {
    const fallbackMap = {
      mindmap: ['openrouter', 'meta-llama'],
      code: ['openrouter', 'meta-llama'],
      prd: ['openrouter', 'meta-llama']
    };
    
    return fallbackMap[requestType] || ['openrouter'];
  }

  // Docker MCP service management
  async initializeDockerServices() {
    try {
      logger.info('Initializing Docker MCP services...');
      
      // Check if Docker is available
      await this.docker.ping();
      
      // Start microservices
      await this.startMicroservice('mindmap-service', 'flowsprint/mindmap-service');
      await this.startMicroservice('code-service', 'flowsprint/code-service');
      await this.startMicroservice('prd-service', 'flowsprint/prd-service');
      
      // Register with Consul
      await this.registerWithConsul();
      
      logger.info('Docker MCP services initialized successfully');
    } catch (error) {
      logger.warn('Docker MCP initialization failed:', error.message);
    }
  }

  async startMicroservice(serviceName, imageName) {
    try {
      // Check if container already exists
      const containers = await this.docker.listContainers({ all: true });
      const existingContainer = containers.find(c => c.Names.includes(`/${serviceName}`));
      
      if (existingContainer) {
        if (existingContainer.State !== 'running') {
          const container = this.docker.getContainer(existingContainer.Id);
          await container.start();
          logger.info(`Restarted existing container: ${serviceName}`);
        }
        return;
      }
      
      // Create and start new container
      const container = await this.docker.createContainer({
        Image: imageName,
        name: serviceName,
        ExposedPorts: { '3000/tcp': {} },
        HostConfig: {
          PortBindings: { '3000/tcp': [{ HostPort: this.getNextPort().toString() }] }
        },
        Env: [
          `SERVICE_NAME=${serviceName}`,
          `CONSUL_HOST=${process.env.CONSUL_HOST || 'localhost'}`
        ]
      });
      
      await container.start();
      logger.info(`Started microservice: ${serviceName}`);
      
    } catch (error) {
      logger.error(`Failed to start microservice ${serviceName}:`, error.message);
    }
  }

  getNextPort() {
    // Simple port allocation starting from 3100
    const basePort = 3100;
    const serviceCount = this.loadBalancer.mindmapServices.length + 
                        this.loadBalancer.codeServices.length + 
                        this.loadBalancer.prdServices.length;
    return basePort + serviceCount;
  }

  async registerWithConsul() {
    try {
      const services = ['mindmap-service', 'code-service', 'prd-service'];
      
      for (const serviceName of services) {
        await this.consul.agent.service.register({
          name: serviceName,
          id: `${serviceName}-${Date.now()}`,
          port: this.getServicePort(serviceName),
          check: {
            http: `http://localhost:${this.getServicePort(serviceName)}/health`,
            interval: '10s'
          }
        });
      }
      
      logger.info('Services registered with Consul');
    } catch (error) {
      logger.error('Consul registration failed:', error.message);
    }
  }

  getServicePort(serviceName) {
    const portMap = {
      'mindmap-service': 3100,
      'code-service': 3101,
      'prd-service': 3102
    };
    return portMap[serviceName] || 3100;
  }

  // Health monitoring
  startHealthMonitoring() {
    setInterval(async () => {
      await this.checkAllServicesHealth();
    }, 30000); // Check every 30 seconds
  }

  async checkAllServicesHealth() {
    for (const [serviceName, serviceData] of this.services) {
      try {
        const healthResult = await serviceData.instance.healthCheck();
        
        this.serviceHealth.set(serviceName, {
          ...healthResult,
          lastCheck: Date.now()
        });
        
        serviceData.healthy = healthResult.status === 'healthy';
        serviceData.lastHealthCheck = Date.now();
        
      } catch (error) {
        logger.error(`Health check failed for ${serviceName}:`, error.message);
        this.serviceHealth.set(serviceName, {
          status: 'unhealthy',
          error: error.message,
          lastCheck: Date.now()
        });
        serviceData.healthy = false;
      }
    }
  }

  isServiceHealthy(serviceName) {
    const service = this.services.get(serviceName);
    return service && service.healthy;
  }

  updateServiceMetrics(serviceName, responseTime, success) {
    const service = this.services.get(serviceName);
    if (service) {
      service.requestCount++;
      service.avgResponseTime = (service.avgResponseTime + responseTime) / 2;
      if (!success) {
        service.errors++;
      }
    }
  }

  // Gateway status and metrics
  async getGatewayStatus() {
    const services = {};
    
    for (const [name, data] of this.services) {
      services[name] = {
        healthy: data.healthy,
        requestCount: data.requestCount,
        avgResponseTime: Math.round(data.avgResponseTime),
        errorRate: data.requestCount > 0 ? (data.errors / data.requestCount * 100).toFixed(2) + '%' : '0%',
        lastHealthCheck: new Date(data.lastHealthCheck).toISOString()
      };
    }
    
    return {
      gateway: 'Enhanced MCP Gateway',
      status: 'operational',
      services,
      totalRequests: Array.from(this.services.values()).reduce((sum, s) => sum + s.requestCount, 0),
      timestamp: new Date().toISOString()
    };
  }

  // Scaling and load balancing
  async scaleService(serviceName, instances = 1) {
    if (!process.env.MCP_ENABLED === 'true') {
      throw new Error('Docker MCP not enabled');
    }
    
    logger.info(`Scaling ${serviceName} to ${instances} instances`);
    
    // Implementation would depend on your orchestration setup
    // This is a placeholder for the scaling logic
    
    return {
      service: serviceName,
      targetInstances: instances,
      status: 'scaling'
    };
  }
}

module.exports = new EnhancedMcpGateway();