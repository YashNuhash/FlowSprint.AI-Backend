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
    const { projectDescription, priority = 'speed' } = payload;
    
    if (priority === 'speed' && this.isServiceHealthy('cerebras')) {
      try {
        const result = await cerebrasService.generateMindmapUltraFast(projectDescription, options);
        return { ...result, provider: 'cerebras', model: 'llama3.1-8b' };
      } catch (error) {
        logger.warn('Cerebras mindmap failed, falling back to OpenRouter');
      }
    }
    
    // Fallback to OpenRouter with Llama 4 Scout (free)
    const result = await openRouterService.generateMindmap(projectDescription, options);
    return { ...result, provider: 'openrouter', model: 'llama-4-scout' };
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