const enhancedMcpGateway = require('../services/enhancedMcpGateway');
const logger = require('../utils/logger');

/**
 * AI Controller - Handles all AI generation endpoints
 * 
 * This controller provides endpoints for:
 * - Mindmap generation (Cerebras ultra-fast)
 * - Code generation (Meta Llama CodeLlama)
 * - PRD generation (Meta Llama large models)
 * - Multi-provider routing and fallbacks
 */

class AIController {
  
  // POST /api/v1/ai/generate-mindmap
  async generateMindmap(req, res) {
    const startTime = Date.now();
    
    try {
      const { 
        projectDescription, 
        priority = 'speed',  // 'speed' | 'quality'
        format = 'json',     // 'json' | 'markdown' | 'text'
        complexity = 'medium' // 'low' | 'medium' | 'high'
      } = req.body;

      if (!projectDescription) {
        return res.status(400).json({
          error: 'Project description is required',
          code: 'MISSING_PROJECT_DESCRIPTION'
        });
      }

      logger.info(`Generating mindmap: ${projectDescription.substring(0, 50)}...`);

      const result = await enhancedMcpGateway.routeRequest('mindmap', {
        projectDescription,
        priority,
        format,
        complexity
      });

      const responseTime = Date.now() - startTime;

      res.json({
        success: true,
        data: {
          mindmap: result.choices?.[0]?.message?.content || result.generated_text,
          provider: result.provider,
          format,
          complexity
        },
        metadata: {
          responseTime,
          provider: result.provider,
          model: result.model || 'unknown',
          timestamp: new Date().toISOString(),
          fallback: result.fallback || false
        }
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('Mindmap generation failed:', error.message);

      res.status(500).json({
        error: 'Failed to generate mindmap',
        message: error.message,
        code: 'MINDMAP_GENERATION_FAILED',
        metadata: {
          responseTime,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  // POST /api/v1/ai/generate-code
  async generateCode(req, res) {
    const startTime = Date.now();
    
    try {
      const { 
        requirements, 
        language = 'javascript',
        complexity = 'medium',  // 'low' | 'medium' | 'high'
        framework = null,       // 'react' | 'vue' | 'express' | etc.
        includeTests = false,
        includeComments = true
      } = req.body;

      if (!requirements) {
        return res.status(400).json({
          error: 'Code requirements are required',
          code: 'MISSING_REQUIREMENTS'
        });
      }

      logger.info(`Generating ${language} code: ${requirements.substring(0, 50)}...`);

      const result = await enhancedMcpGateway.routeRequest('code', {
        requirements,
        language,
        complexity,
        framework,
        includeTests,
        includeComments
      });

      const responseTime = Date.now() - startTime;

      // Extract code from response
      let generatedCode = result.code || result.choices?.[0]?.message?.content || result.generated_text;
      
      // Clean up code formatting
      generatedCode = this.cleanCodeResponse(generatedCode, language);

      res.json({
        success: true,
        data: {
          code: generatedCode,
          language,
          complexity,
          framework,
          provider: result.provider,
          confidence: result.confidence || 0.8
        },
        metadata: {
          responseTime,
          provider: result.provider,
          model: result.model || 'unknown',
          timestamp: new Date().toISOString(),
          fallback: result.fallback || false,
          tokensUsed: result.usage?.total_tokens || 0
        }
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('Code generation failed:', error.message);

      res.status(500).json({
        error: 'Failed to generate code',
        message: error.message,
        code: 'CODE_GENERATION_FAILED',
        metadata: {
          responseTime,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  // POST /api/v1/ai/generate-prd
  async generatePRD(req, res) {
    const startTime = Date.now();
    
    try {
      const { 
        projectIdea,
        complexity = 'standard',  // 'standard' | 'comprehensive'
        industry = 'tech',
        targetAudience = 'general',
        timeline = '3-6 months',
        budget = 'startup'
      } = req.body;

      if (!projectIdea) {
        return res.status(400).json({
          error: 'Project idea is required',
          code: 'MISSING_PROJECT_IDEA'
        });
      }

      logger.info(`Generating PRD: ${projectIdea.substring(0, 50)}...`);

      const result = await enhancedMcpGateway.routeRequest('prd', {
        projectIdea,
        complexity,
        industry,
        targetAudience,
        timeline,
        budget
      });

      const responseTime = Date.now() - startTime;

      // Structure PRD response
      let prdContent = result.prd || result.choices?.[0]?.message?.content || result.generated_text;
      const structuredPRD = this.structurePRDResponse(prdContent);

      res.json({
        success: true,
        data: {
          prd: structuredPRD,
          rawContent: prdContent,
          complexity,
          industry,
          targetAudience,
          provider: result.provider
        },
        metadata: {
          responseTime,
          provider: result.provider,
          model: result.model || 'unknown',
          timestamp: new Date().toISOString(),
          fallback: result.fallback || false,
          sections: structuredPRD.sections?.length || 0
        }
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('PRD generation failed:', error.message);

      res.status(500).json({
        error: 'Failed to generate PRD',
        message: error.message,
        code: 'PRD_GENERATION_FAILED',
        metadata: {
          responseTime,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  // GET /api/v1/ai/providers
  async getProviders(req, res) {
    try {
      const gatewayStatus = await enhancedMcpGateway.getGatewayStatus();
      
      res.json({
        success: true,
        data: {
          gateway: gatewayStatus.gateway,
          status: gatewayStatus.status,
          services: gatewayStatus.services,
          totalRequests: gatewayStatus.totalRequests,
          providers: {
            openrouter: {
              name: 'OpenRouter',
              description: 'Multi-model routing with Cerebras integration',
              models: ['meta-llama/llama-3.1-8b-instruct', 'cerebras/llama3.1-8b'],
              useCases: ['Fallback routing', 'Model diversity', 'Cost optimization']
            },
            cerebras: {
              name: 'Cerebras',
              description: 'Ultra-fast inference (<100ms)',
              models: ['llama3.1-8b'],
              useCases: ['Real-time mindmaps', 'Live code completion', 'Instant insights']
            },
            'meta-llama': {
              name: 'Meta Llama',
              description: 'High-quality code and content generation',
              models: ['CodeLlama-34b', 'Llama-2-70b-chat', 'Llama-2-13b-chat'],
              useCases: ['Code generation', 'Technical documentation', 'Comprehensive PRDs']
            }
          }
        },
        metadata: {
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to get providers status:', error.message);

      res.status(500).json({
        error: 'Failed to get providers status',
        message: error.message,
        code: 'PROVIDERS_STATUS_FAILED'
      });
    }
  }

  // POST /api/v1/ai/stream-response
  async streamResponse(req, res) {
    try {
      const { 
        prompt, 
        provider = 'cerebras',  // Default to Cerebras for streaming
        maxTokens = 1500
      } = req.body;

      if (!prompt) {
        return res.status(400).json({
          error: 'Prompt is required',
          code: 'MISSING_PROMPT'
        });
      }

      // Set up Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      const messages = [
        { role: 'user', content: prompt }
      ];

      // Stream response chunks
      if (provider === 'cerebras') {
        const cerebrasService = require('../services/cerebrasService');
        
        await cerebrasService.streamResponse(messages, (chunk) => {
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        }, { max_tokens: maxTokens });
      }

      // Send completion signal
      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
      res.end();

    } catch (error) {
      logger.error('Streaming failed:', error.message);
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
  }

  // GET /api/v1/ai/health
  async healthCheck(req, res) {
    try {
      const gatewayStatus = await enhancedMcpGateway.getGatewayStatus();
      
      const healthySources = Object.values(gatewayStatus.services)
        .filter(service => service.healthy).length;
      const totalServices = Object.keys(gatewayStatus.services).length;
      
      const overallHealth = healthySources === totalServices ? 'healthy' : 
                           healthySources > 0 ? 'degraded' : 'unhealthy';

      res.json({
        status: overallHealth,
        services: gatewayStatus.services,
        summary: {
          healthyServices: healthySources,
          totalServices,
          healthPercentage: Math.round((healthySources / totalServices) * 100)
        },
        capabilities: {
          mindmapGeneration: healthySources > 0,
          codeGeneration: healthySources > 0,
          prdGeneration: healthySources > 0,
          realTimeStreaming: gatewayStatus.services.cerebras?.healthy || false
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Health check failed:', error.message);

      res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Helper methods
  cleanCodeResponse(code, language) {
    if (!code) return '';
    
    // Remove markdown code blocks
    code = code.replace(/```[\w]*\n?/g, '').replace(/```/g, '');
    
    // Remove explanation text before code
    const codeStart = code.indexOf('{') !== -1 ? code.indexOf('{') : 
                     code.indexOf('function') !== -1 ? code.indexOf('function') :
                     code.indexOf('const') !== -1 ? code.indexOf('const') :
                     code.indexOf('import') !== -1 ? code.indexOf('import') : 0;
    
    if (codeStart > 0) {
      code = code.substring(codeStart);
    }
    
    return code.trim();
  }

  structurePRDResponse(content) {
    const sections = [];
    const lines = content.split('\n');
    let currentSection = null;
    
    for (const line of lines) {
      // Check if line is a section header
      if (line.match(/^\s*(?:\d+\.?\s*)?([A-Z][^:\n]+):?\s*$/)) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          title: line.replace(/^\s*\d+\.?\s*/, '').replace(/:$/, '').trim(),
          content: []
        };
      } else if (currentSection && line.trim()) {
        currentSection.content.push(line.trim());
      }
    }
    
    if (currentSection) {
      sections.push(currentSection);
    }
    
    return {
      sections,
      rawContent: content,
      summary: sections.find(s => s.title.toLowerCase().includes('summary'))?.content.join(' ') || '',
      totalSections: sections.length
    };
  }
}

module.exports = new AIController();