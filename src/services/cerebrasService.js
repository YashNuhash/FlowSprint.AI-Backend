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

  // Ultra-fast mindmap generation (primary use case for Cerebras)
  async generateMindmapUltraFast(projectDescription, options = {}) {
    const messages = [
      {
        role: 'system',
        content: 'You are a rapid project structuring AI. Create a concise mindmap in JSON format with main branches and sub-branches. Be fast and efficient while maintaining quality.'
      },
      {
        role: 'user',
        content: `Quick mindmap for project: ${projectDescription}`
      }
    ];

    const startTime = Date.now();
    const result = await this.makeRequest('/chat/completions', {
      messages,
      temperature: 0.6,
      max_tokens: 1200,
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