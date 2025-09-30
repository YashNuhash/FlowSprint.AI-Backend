const axios = require('axios');
const logger = require('../utils/logger');

class OpenRouterService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.baseURL = 'https://openrouter.ai/api/v1';
    this.httpReferer = process.env.YOUR_SITE_URL || 'http://localhost:3000';
    this.siteName = 'FlowSprint.AI';
    
    if (!this.apiKey) {
      logger.warn('OpenRouter API key not found in environment variables');
    }
  }

  async makeRequest(endpoint, data, model = 'meta-llama/llama-4-maverick-17b-128e-instruct:free') {
    try {
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': this.httpReferer,
        'X-Title': this.siteName,
        'Content-Type': 'application/json'
      };

      const response = await axios.post(`${this.baseURL}${endpoint}`, {
        model,
        messages: data.messages,
        temperature: data.temperature || 0.7,
        max_tokens: data.max_tokens || 2000,
        stream: data.stream || false
      }, { headers });

      logger.info(`OpenRouter API call successful: ${model}`);
      return response.data;
    } catch (error) {
      logger.error('OpenRouter API Error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw new Error(`OpenRouter API Error: ${error.message}`);
    }
  }

  // Mindmap generation with ultra-fast Cerebras routing
  async generateMindmap(projectDescription, options = {}) {
    const messages = [
      {
        role: 'system',
        content: 'You are an expert project manager. Create a comprehensive mindmap in JSON format for the given project description. Focus on main branches, sub-branches, and actionable items.'
      },
      {
        role: 'user',
        content: `Create a detailed mindmap for this project: ${projectDescription}`
      }
    ];

    return await this.makeRequest('/chat/completions', {
      messages,
      temperature: 0.6,
      max_tokens: 1500,
      ...options
    }, 'meta-llama/llama-4-scout-17b-16e-instruct:free'); // Use Llama 4 Scout for speed
  }

  // Code generation with Meta Llama
  async generateCode(requirements, codeType = 'javascript', options = {}) {
    const messages = [
      {
        role: 'system',
        content: `You are an expert ${codeType} developer. Generate clean, production-ready code based on the requirements. Include proper error handling and comments.`
      },
      {
        role: 'user',
        content: `Generate ${codeType} code for: ${requirements}`
      }
    ];

    return await this.makeRequest('/chat/completions', {
      messages,
      temperature: 0.3,
      max_tokens: 3000,
      ...options
    }, 'meta-llama/llama-4-maverick-17b-128e-instruct:free'); // Use Llama 4 Maverick for quality
  }

  // PRD generation with large Llama model
  async generatePRD(projectIdea, options = {}) {
    const messages = [
      {
        role: 'system',
        content: 'You are a senior product manager. Create a comprehensive Product Requirements Document (PRD) with sections: Overview, Objectives, User Stories, Technical Requirements, Success Metrics, and Timeline.'
      },
      {
        role: 'user',
        content: `Create a detailed PRD for: ${projectIdea}`
      }
    ];

    return await this.makeRequest('/chat/completions', {
      messages,
      temperature: 0.7,
      max_tokens: 4000,
      ...options
    }, 'meta-llama/llama-4-maverick-17b-128e-instruct:free'); // Use Llama 4 Maverick for comprehensive docs
  }

  // Health check for OpenRouter
  async healthCheck() {
    try {
      const response = await axios.get(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': this.httpReferer
        }
      });
      
      return {
        status: 'healthy',
        availableModels: response.data.data?.length || 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('OpenRouter health check failed:', error.message);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Get available models and pricing
  async getAvailableModels() {
    try {
      const response = await axios.get(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': this.httpReferer
        }
      });

      const models = response.data.data?.filter(model => 
        model.id.includes('llama') || model.id.includes('cerebras')
      ) || [];

      return {
        success: true,
        models: models.map(model => ({
          id: model.id,
          name: model.name,
          context_length: model.context_length
        }))
      };
    } catch (error) {
      logger.error('Failed to fetch OpenRouter models:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new OpenRouterService();