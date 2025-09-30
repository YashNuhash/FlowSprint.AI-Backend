const { HfInference } = require('@huggingface/inference');
const logger = require('../utils/logger');

class MetaLlamaService {
  constructor() {
    this.apiKey = process.env.HUGGINGFACE_API_KEY;
    this.hf = new HfInference(this.apiKey);
    
    // Model configurations - using Meta Llama 4 models from HuggingFace
    this.models = {
      codeGeneration: 'meta-llama/Llama-4-Scout-17B-16E-Instruct',
      largePRD: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct', 
      fastChat: 'meta-llama/Llama-4-Scout-17B-16E-Instruct',
      codeCompletion: 'meta-llama/Llama-4-Scout-17B-16E-Instruct'
    };
    
    if (!this.apiKey) {
      logger.warn('Hugging Face API key not found in environment variables');
    }
  }

  async makeRequest(model, inputs, parameters = {}) {
    try {
      const startTime = Date.now();
      
      // Use chat completions API (correct format for HuggingFace Inference Providers)
      const response = await this.hf.chatCompletion({
        model,
        messages: [
          {
            role: 'user',
            content: inputs
          }
        ],
        max_tokens: parameters.max_tokens || 2000,
        temperature: parameters.temperature || 0.7,
        top_p: parameters.top_p || 0.9,
        stream: false
      });

      const responseTime = Date.now() - startTime;
      logger.info(`Meta Llama API call successful: ${model} (${responseTime}ms)`, {
        service: 'flowsprint-backend'
      });
      
      return {
        generated_text: response.choices?.[0]?.message?.content || '',
        metadata: {
          model,
          responseTime,
          provider: 'meta-llama-hf'
        }
      };
    } catch (error) {
      logger.error('Meta Llama API Error:', {
        message: error.message,
        model,
        status: error.status,
        service: 'flowsprint-backend'
      });
      throw new Error(`Meta Llama API Error: ${error.message}`);
    }
  }

  // Advanced code generation with CodeLlama
  async generateCode(requirements, language = 'javascript', complexity = 'medium') {
    const prompt = this.buildCodePrompt(requirements, language, complexity);
    
    const parameters = {
      max_tokens: complexity === 'high' ? 4000 : 2500,
      temperature: 0.3, // Lower for more consistent code
      top_p: 0.9
    };

    const result = await this.makeRequest(
      this.models.codeGeneration,
      prompt,
      parameters
    );

    return {
      code: this.extractCode(result.generated_text),
      fullResponse: result.generated_text,
      language,
      complexity,
      metadata: result.metadata
    };
  }

  // Generate comprehensive PRDs with large model
  async generateComprehensivePRD(projectIdea, industry = 'tech', targetAudience = 'general') {
    const prompt = this.buildPRDPrompt(projectIdea, industry, targetAudience);
    
    const parameters = {
      max_tokens: 5000, // Large PRDs need more tokens
      temperature: 0.7,
      top_p: 0.9
    };

    const result = await this.makeRequest(
      this.models.largePRD,
      prompt,
      parameters
    );

    return {
      prd: this.structurePRD(result.generated_text),
      rawContent: result.generated_text,
      metadata: {
        ...result.metadata,
        industry,
        targetAudience,
        sections: this.extractPRDSections(result.generated_text)
      }
    };
  }

  // Code completion and suggestions
  async getCodeCompletion(codeContext, language = 'javascript') {
    const prompt = `// ${language.toUpperCase()} Code Completion\n${codeContext}`;
    
    const parameters = {
      max_tokens: 500,
      temperature: 0.2, // Very low for precise completion
      top_p: 0.8,
      stop: ['\n\n', '// End', '/* End']
    };

    const result = await this.makeRequest(
      this.models.codeCompletion,
      prompt,
      parameters
    );

    return {
      completion: result.generated_text.trim(),
      confidence: this.calculateCompletionConfidence(result.generated_text),
      metadata: result.metadata
    };
  }

  // Technical documentation generation
  async generateTechnicalDocs(codeOrSpec, docType = 'api') {
    const prompt = this.buildDocsPrompt(codeOrSpec, docType);
    
    const parameters = {
      max_tokens: 3000,
      temperature: 0.5,
      top_p: 0.9
    };

    const result = await this.makeRequest(
      this.models.fastChat,
      prompt,
      parameters
    );

    return {
      documentation: result.generated_text,
      docType,
      metadata: result.metadata
    };
  }

  // Helper methods for prompt building
  buildCodePrompt(requirements, language, complexity) {
    const complexityInstructions = {
      low: 'Create simple, straightforward code.',
      medium: 'Create well-structured code with proper error handling.',
      high: 'Create production-ready code with comprehensive error handling, testing, and documentation.'
    };

    return `<|im_start|>system
You are an expert ${language} developer specializing in clean, maintainable code.
${complexityInstructions[complexity]}
Include proper comments and follow best practices.
<|im_end|>

<|im_start|>user
Generate ${language} code for the following requirements:
${requirements}

Please provide complete, working code with:
1. Proper error handling
2. Clear comments
3. Best practices
4. Type definitions (if applicable)
<|im_end|>

<|im_start|>assistant`;
  }

  buildPRDPrompt(projectIdea, industry, targetAudience) {
    return `<|im_start|>system
You are a senior product manager with expertise in the ${industry} industry.
Create a comprehensive Product Requirements Document (PRD) for ${targetAudience} audience.
<|im_end|>

<|im_start|>user
Create a detailed PRD for: ${projectIdea}

Structure the PRD with these sections:
1. Executive Summary
2. Problem Statement
3. Solution Overview
4. User Stories & Use Cases
5. Functional Requirements
6. Technical Requirements
7. Success Metrics & KPIs
8. Timeline & Milestones
9. Risk Assessment
10. Go-to-Market Strategy

Make it comprehensive and actionable.
<|im_end|>

<|im_start|>assistant`;
  }

  buildDocsPrompt(codeOrSpec, docType) {
    const docInstructions = {
      api: 'Create comprehensive API documentation with endpoints, parameters, responses, and examples.',
      code: 'Create detailed code documentation with function descriptions, parameters, and usage examples.',
      user: 'Create user-friendly documentation with step-by-step guides and screenshots descriptions.',
      technical: 'Create technical documentation for developers with architecture details and implementation notes.'
    };

    return `<|im_start|>system
You are a technical writer specializing in ${docType} documentation.
${docInstructions[docType]}
<|im_end|>

<|im_start|>user
Create ${docType} documentation for:
${codeOrSpec}
<|im_end|>

<|im_start|>assistant`;
  }

  // Utility methods
  extractCode(response) {
    // Extract code blocks from response
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)\n```/g;
    const matches = response.match(codeBlockRegex);
    
    if (matches) {
      return matches.map(match => 
        match.replace(/```[\w]*\n/, '').replace(/\n```$/, '')
      ).join('\n\n');
    }
    
    return response;
  }

  structurePRD(response) {
    const sections = {
      executive_summary: '',
      problem_statement: '',
      solution_overview: '',
      user_stories: '',
      functional_requirements: '',
      technical_requirements: '',
      success_metrics: '',
      timeline: '',
      risks: '',
      go_to_market: ''
    };

    // Parse sections from the response
    const sectionRegex = /(?:^|\n)(?:\d+\.?\s*)?([A-Z][^:\n]+):?\s*\n([\s\S]*?)(?=\n(?:\d+\.?\s*)?[A-Z][^:\n]+:|\n*$)/g;
    let match;

    while ((match = sectionRegex.exec(response)) !== null) {
      const title = match[1].toLowerCase().replace(/[^a-z]/g, '_');
      const content = match[2].trim();
      
      if (sections.hasOwnProperty(title)) {
        sections[title] = content;
      }
    }

    return sections;
  }

  extractPRDSections(response) {
    const sectionHeaders = response.match(/(?:^|\n)(?:\d+\.?\s*)?([A-Z][^:\n]+)/g) || [];
    return sectionHeaders.map(header => header.replace(/^\n?\d+\.?\s*/, '').trim());
  }

  calculateCompletionConfidence(completion) {
    // Simple confidence calculation based on completion characteristics
    const factors = {
      length: completion.length > 10 ? 0.3 : 0.1,
      syntax: /[{}();]/.test(completion) ? 0.3 : 0.1,
      indentation: /^\s+/.test(completion) ? 0.2 : 0.1,
      keywords: /\b(function|class|const|let|var|if|for|while)\b/.test(completion) ? 0.2 : 0.1
    };

    return Math.min(Object.values(factors).reduce((a, b) => a + b, 0), 1.0);
  }

  // Health check for Meta Llama services
  async healthCheck() {
    try {
      const testPrompt = '<|im_start|>user\nSay "healthy"\n<|im_end|>\n<|im_start|>assistant';
      
      const result = await this.makeRequest(
        this.models.fastChat,
        testPrompt,
        { max_tokens: 10, temperature: 0.1 }
      );

      return {
        status: 'healthy',
        models: Object.keys(this.models),
        responseTime: result.metadata.responseTime,
        testResponse: result.generated_text.trim(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Meta Llama health check failed:', error.message);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Get model information and capabilities
  async getModelInfo() {
    return {
      provider: 'meta-llama-huggingface',
      models: {
        codeGeneration: {
          name: this.models.codeGeneration,
          use_case: 'Advanced code generation and completion',
          context_length: '16K tokens',
          strengths: ['Code generation', 'Bug fixing', 'Code explanation']
        },
        largePRD: {
          name: this.models.largePRD,
          use_case: 'Comprehensive document generation',
          context_length: '4K tokens',
          strengths: ['Long-form content', 'Strategic planning', 'Analysis']
        },
        fastChat: {
          name: this.models.fastChat,
          use_case: 'Quick responses and general tasks',
          context_length: '4K tokens',
          strengths: ['Speed', 'General knowledge', 'Conversations']
        },
        codeCompletion: {
          name: this.models.codeCompletion,
          use_case: 'Real-time code completion',
          context_length: '16K tokens',
          strengths: ['Code completion', 'Syntax suggestions', 'IDE integration']
        }
      }
    };
  }
}

module.exports = new MetaLlamaService();