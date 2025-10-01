const axios = require('axios');
const logger = require('../utils/logger');

class CerebrasService {
  constructor() {
    this.apiKey = process.env.CEREBRAS_API_KEY;
    this.baseURL = 'https://api.cerebras.ai/v1';
    
    if (!this.apiKey) {
      logger.warn('Cerebras API key not found in environment variables');
    }
  }

  async makeRequest(endpoint, data, model = 'llama3.1-8b') {
    try {
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      };

      const response = await axios.post(`${this.baseURL}${endpoint}`, {
        model,
        messages: data.messages,
        temperature: data.temperature || 0.7,
        max_tokens: data.max_tokens || 2000,
        stream: data.stream || false,
        top_p: data.top_p || 1.0
      }, { headers });

      logger.info(`Cerebras API call successful: ${model} (${response.data.usage?.total_tokens || 0} tokens)`);
      return response.data;
    } catch (error) {
      logger.error('Cerebras API Error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw new Error(`Cerebras API Error: ${error.message}`);
    }
  }

  // Ultra-fast detailed mindmap generation (primary use case for Cerebras)
  async generateMindmapUltraFast(projectDescription, options = {}) {
    const messages = [
      {
        role: 'system',
        content: `You are a rapid technical architect. Generate a detailed technical development mindmap with clean, actionable tasks.

CRITICAL FORMATTING RULES:
- Each node title: Plain text only (NO markdown, NO bold, NO asterisks)
- Node titles: 3-8 words maximum, specific and actionable
- Node descriptions: Practical implementation details (NOT "title + generic text")
- Avoid meta-text like "Here is a mindmap" or "This project"
- Strip all markdown formatting from titles

GOOD NODE EXAMPLES:
Title: "Setup MongoDB Atlas cluster"
Description: "Create database cluster, configure authentication, set connection strings in environment variables"

Title: "Implement JWT authentication" 
Description: "Create login endpoint, generate tokens, add middleware for protected routes, handle token refresh"

BAD NODE EXAMPLES:
Title: "**Setup Phase**" (has markdown)
Title: "Here is the authentication system" (meta-text)
Description: "Implement JWT authentication: Implementation and technical details" (redundant)

Focus on: setup → development → testing → deployment → maintenance phases.`
      },
      {
        role: 'user',
        content: `${projectDescription}

Generate a comprehensive technical development mindmap with specific implementation tasks covering:

SETUP PHASE:
- Repository setup with proper .gitignore, README, and CI/CD pipeline
- Development environment configuration with package managers and tools
- Database schema design and connection setup

DEVELOPMENT PHASE:
- Authentication system implementation (registration, login, JWT, password reset)
- Backend API development with CRUD operations and validation
- Frontend component architecture with reusable UI elements
- State management and data flow implementation
- Real-time features and integrations

TESTING & DEPLOYMENT:
- Unit testing for components and API endpoints
- Integration testing for user workflows
- Production deployment with monitoring and logging
- Performance optimization and scaling strategies

Each node should be specific, actionable task with clear deliverables and technical details.`
      }
    ];

    const startTime = Date.now();
    const result = await this.makeRequest('/chat/completions', {
      messages,
      temperature: 0.7,
      max_tokens: 2500,
      ...options
    }, 'llama3.1-8b');

    const responseTime = Date.now() - startTime;
    logger.info(`Cerebras ultra-fast response: ${responseTime}ms`);

    return {
      ...result,
      metadata: {
        responseTime,
        provider: 'cerebras',
        model: 'llama3.1-8b'
      }
    };
  }

  // Real-time code suggestions (under 100ms target)
  async getCodeSuggestions(codeContext, currentLine, options = {}) {
    const messages = [
      {
        role: 'system',
        content: 'You are a fast code completion AI. Provide quick, relevant code suggestions for the given context. Be concise but accurate.'
      },
      {
        role: 'user',
        content: `Code context: ${codeContext}\nCurrent line: ${currentLine}\nSuggest next lines:`
      }
    ];

    const startTime = Date.now();
    const result = await this.makeRequest('/chat/completions', {
      messages,
      temperature: 0.3,
      max_tokens: 500,
      ...options
    }, 'llama3.1-8b');

    const responseTime = Date.now() - startTime;
    
    return {
      suggestions: result.choices?.[0]?.message?.content || '',
      responseTime,
      provider: 'cerebras'
    };
  }

  // Real-time project insights
  async getProjectInsights(projectData, options = {}) {
    const messages = [
      {
        role: 'system',
        content: 'You are a project analysis AI. Provide quick insights about project progress, potential risks, and recommendations. Be concise and actionable.'
      },
      {
        role: 'user',
        content: `Analyze this project data and provide insights: ${JSON.stringify(projectData)}`
      }
    ];

    return await this.makeRequest('/chat/completions', {
      messages,
      temperature: 0.5,
      max_tokens: 800,
      ...options
    }, 'llama3.1-8b');
  }

  // Streaming responses for real-time UI updates
  async streamResponse(messages, onChunk, options = {}) {
    try {
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      };

      const response = await axios.post(`${this.baseURL}/chat/completions`, {
        model: 'llama3.1-8b',
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 1500,
        stream: true,
        ...options
      }, { 
        headers,
        responseType: 'stream'
      });

      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices?.[0]?.delta?.content) {
                onChunk(parsed.choices[0].delta.content);
              }
            } catch (e) {
              // Skip invalid JSON chunks
            }
          }
        }
      });

      response.data.on('end', () => {
        logger.info('Cerebras streaming completed');
      });

    } catch (error) {
      logger.error('Cerebras streaming error:', error.message);
      throw error;
    }
  }

  // Health check and performance metrics
  async healthCheck() {
    try {
      const startTime = Date.now();
      
      const response = await this.makeRequest('/chat/completions', {
        messages: [
          { role: 'system', content: 'You are a test AI.' },
          { role: 'user', content: 'Say "healthy"' }
        ],
        max_tokens: 10
      });

      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        responseTime,
        isUltraFast: responseTime < 100,
        model: 'llama3.1-8b',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Cerebras health check failed:', error.message);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Get usage and rate limit info
  async getUsageInfo() {
    try {
      // Cerebras doesn't have a direct usage endpoint, so we'll track internally
      return {
        provider: 'cerebras',
        model: 'llama3.1-8b',
        features: [
          'Ultra-fast inference (<100ms)',
          'Real-time streaming',
          'Code completion',
          'Project insights'
        ],
        rateLimit: 'High throughput available',
        pricing: 'Check Cerebras pricing page'
      };
    } catch (error) {
      logger.error('Failed to get Cerebras usage info:', error.message);
      return { error: error.message };
    }
  }
}

module.exports = new CerebrasService();