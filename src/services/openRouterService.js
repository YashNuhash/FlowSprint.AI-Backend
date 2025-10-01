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

  // Mindmap generation with comprehensive technical breakdown (FlowSurf-style)
  async generateMindmap(projectDescription, options = {}) {
    // Extract project details from description
    const cleanData = this.parseProjectData(projectDescription);
    
    const prompt = `Create a comprehensive project analysis for "${cleanData.name}" with the following specifications:

Project Description: ${cleanData.description}

Features: ${cleanData.features}

Tech Stack: ${cleanData.techStack}

Please generate a detailed mindmap in the following JSON format.

🎯 MINDMAP STRUCTURE REQUIREMENTS:
- Generate AT LEAST 5-8 main feature nodes with 2-4 children each (minimum 15-20 total nodes)
- Use DESCRIPTIVE, informative node titles (8-15 words) explaining what the feature does
- Include detailed descriptions for each node (different from title)
- Create logical feature groupings based on user workflows
- NO generic categories like "Features" or "Technology Stack"
- Focus on specific user actions, components, and business functionality
- Each main branch should represent a core feature area
- Sub-nodes should represent specific functionalities within that area

EXAMPLE for TaskManager with DESCRIPTIVE titles:
{
  "mindmap": {
    "id": "root",
    "text": "${cleanData.name}",
    "children": [
      {
        "id": "user_auth",
        "text": "User Authentication & Security: Secure login system with password protection and session management",
        "description": "Implements secure user registration, login, password reset, and session handling to protect user data and ensure authorized access only",
        "children": [
          { "id": "signup", "text": "User Registration: Create new accounts with email verification and profile setup", "description": "Allows new users to join the platform with secure account creation process" },
          { "id": "signin", "text": "Secure Login: Authenticate users with email/password and remember me functionality", "description": "Provides safe and convenient access to user accounts with session persistence" },
          { "id": "password_reset", "text": "Password Reset: Secure password recovery with email verification and token validation", "description": "Enables users to regain access to their accounts through secure password reset workflow" },
          { "id": "session_mgmt", "text": "Session Management: Handle user sessions, auto-logout, and security token refresh", "description": "Maintains secure user sessions with proper timeout handling and token management" }
        ]
      },
      {
        "id": "task_mgmt", 
        "text": "Task Creation & Management: Create, edit, organize tasks with priorities, due dates, and categories",
        "description": "Core functionality for managing personal and team tasks with comprehensive metadata and organizational features",
        "children": [
          { "id": "create_task", "text": "Task Creation: Add new tasks with titles, descriptions, due dates, and priority levels", "description": "Enables users to capture and organize all their work with detailed task information" },
          { "id": "edit_task", "text": "Task Editing: Modify existing task details, status, and assignments", "description": "Allows users to update task information as requirements change" },
          { "id": "priority", "text": "Priority Management: Set and adjust task importance levels for better focus", "description": "Helps users identify and focus on the most critical tasks first" },
          { "id": "categories", "text": "Task Categorization: Organize tasks into projects, labels, and custom categories", "description": "Provides flexible organization system for grouping related tasks" }
        ]
      },
      {
        "id": "dashboard",
        "text": "Dashboard & Analytics: Overview of tasks, progress tracking, and productivity insights", 
        "description": "Provides visual summary of user's tasks, completion rates, and performance metrics for better productivity management",
        "children": [
          { "id": "task_list", "text": "Interactive Task List: Display, filter, and sort all user tasks with status indicators", "description": "Main interface for viewing and managing all tasks with powerful filtering options" },
          { "id": "analytics", "text": "Progress Analytics: Visual charts showing completion rates, productivity trends, and time tracking", "description": "Helps users understand their productivity patterns and identify areas for improvement" },
          { "id": "calendar", "text": "Calendar Integration: Show tasks and deadlines in calendar view with scheduling features", "description": "Provides timeline visualization of tasks and helps with deadline management" }
        ]
      },
      {
        "id": "collaboration",
        "text": "Team Collaboration: Share tasks, assign responsibilities, and track team progress",
        "description": "Enables team-based task management with assignment, sharing, and collaborative features",
        "children": [
          { "id": "task_sharing", "text": "Task Sharing: Share individual tasks or projects with team members and collaborators", "description": "Allows collaborative work on tasks with proper permission management" },
          { "id": "assignments", "text": "Task Assignment: Assign tasks to team members with notification and tracking", "description": "Enables delegation and responsibility tracking within teams" },
          { "id": "comments", "text": "Task Comments: Add comments, updates, and discussions to tasks for better communication", "description": "Facilitates communication and documentation within task context" }
        ]
      },
      {
        "id": "notifications",
        "text": "Notifications & Reminders: Alert system for deadlines, updates, and task changes",
        "description": "Comprehensive notification system to keep users informed and prevent missed deadlines",
        "children": [
          { "id": "deadline_alerts", "text": "Deadline Alerts: Automated reminders for upcoming and overdue tasks", "description": "Prevents missed deadlines through timely notifications via email and in-app alerts" },
          { "id": "task_updates", "text": "Task Update Notifications: Notify users of changes, comments, and assignments", "description": "Keeps team members informed of task progress and changes in real-time" },
          { "id": "daily_summary", "text": "Daily Summary: Daily digest of tasks, progress, and upcoming deadlines", "description": "Provides daily overview to help users plan their day effectively" }
        ]
      }
    ]
  }
}

🚨 CRITICAL JSON STRUCTURE REQUIREMENTS:
- EVERY mindmap node MUST have both "text" (title) AND "description" fields
- Do NOT omit the "description" field - it is MANDATORY for all nodes
- Descriptions must be different from titles and provide additional value
- Focus on specific technical implementation and user value
- Each node should represent actionable development tasks

Make the mindmap detailed, practical, and comprehensive. Include specific technical considerations, user flows, implementation details, and realistic development phases.

EXAMPLE structure for a Task Manager with TECHNICAL BREAKDOWN:
{
  "mindmap": {
    "id": "root",
    "text": "TaskManager - Complete Development Lifecycle",
    "children": [
      {
        "id": "project_setup",
        "text": "Project Setup & Environment Configuration: Initialize development environment with modern tooling, version control, and CI/CD pipeline",
        "description": "Set up the foundation for scalable development including repository structure, development tools, and automated workflows",
        "children": [
          { "id": "repo_init", "text": "Repository Initialization: Create Git repository with proper .gitignore, README, and branching strategy", "description": "Establish version control foundation with organized folder structure and documentation" },
          { "id": "dev_env", "text": "Development Environment Setup: Configure Node.js, package managers, IDE extensions, and development servers", "description": "Install and configure all necessary development tools for efficient coding workflow" },
          { "id": "ci_cd", "text": "CI/CD Pipeline Configuration: Set up GitHub Actions for automated testing, building, and deployment", "description": "Automate code quality checks, testing, and deployment processes for reliable releases" }
        ]
      },
      {
        "id": "backend_api",
        "text": "Backend API Development: Build RESTful API with authentication, database integration, and comprehensive task management endpoints",
        "description": "Develop robust server-side architecture with secure authentication, data persistence, and scalable API design",
        "children": [
          { "id": "auth_system", "text": "Authentication System: Implement JWT-based auth with registration, login, password reset, and session management", "description": "Secure user authentication system with token-based authorization and security best practices" },
          { "id": "database_design", "text": "Database Schema Design: Create normalized database structure for users, tasks, categories, and relationships", "description": "Design efficient database schema with proper indexing, relationships, and data integrity constraints" },
          { "id": "task_crud", "text": "Task CRUD Operations: Build comprehensive task management API with create, read, update, delete, and advanced filtering", "description": "Implement full task lifecycle management with priority handling, due dates, and status tracking" },
          { "id": "api_validation", "text": "Input Validation & Error Handling: Implement comprehensive request validation, sanitization, and error responses", "description": "Ensure data integrity and security through proper validation, sanitization, and error handling middleware" }
        ]
      },
      {
        "id": "frontend_ui",
        "text": "Frontend User Interface: Develop responsive React application with modern UI components, state management, and user interactions",
        "description": "Build intuitive and responsive user interface with efficient state management and seamless user experience",
        "children": [
          { "id": "ui_components", "text": "Reusable UI Component Library: Create modular components for forms, buttons, modals, and task displays", "description": "Build scalable component architecture with consistent styling and reusable functionality" },
          { "id": "state_management", "text": "Global State Management: Implement Redux/Context for user state, task data, and application-wide state synchronization", "description": "Manage complex application state with predictable updates and efficient data flow" },
          { "id": "routing", "text": "Client-Side Routing: Set up React Router for navigation between dashboard, task views, settings, and user pages", "description": "Implement smooth navigation experience with protected routes and dynamic URL handling" }
        ]
      },
      {
        "id": "testing_qa",
        "text": "Testing & Quality Assurance: Implement comprehensive testing strategy with unit, integration, and end-to-end tests",
        "description": "Ensure code quality and reliability through automated testing, code coverage, and quality metrics",
        "children": [
          { "id": "unit_tests", "text": "Unit Testing Suite: Write comprehensive unit tests for components, utilities, and API endpoints with high coverage", "description": "Test individual functions and components in isolation to ensure correctness and prevent regressions" },
          { "id": "integration_tests", "text": "Integration Testing: Test API endpoints, database interactions, and component integration workflows", "description": "Verify that different parts of the application work correctly together in realistic scenarios" },
          { "id": "e2e_tests", "text": "End-to-End Testing: Automate user journey testing with Cypress/Playwright for critical user workflows", "description": "Test complete user scenarios from login to task completion to ensure seamless user experience" }
        ]
      },
      {
        "id": "deployment",
        "text": "Production Deployment & Infrastructure: Deploy application to cloud platforms with monitoring, logging, and scalability",
        "description": "Set up production-ready infrastructure with monitoring, security, and scalability considerations",
        "children": [
          { "id": "cloud_deploy", "text": "Cloud Platform Deployment: Deploy to AWS/Vercel/Heroku with environment configuration and domain setup", "description": "Configure production environment with proper scaling, security, and performance optimization" },
          { "id": "monitoring", "text": "Application Monitoring: Implement logging, error tracking, and performance monitoring with analytics", "description": "Set up comprehensive monitoring to track application health, errors, and user behavior" }
        ]
      },
      {
        "id": "maintenance",
        "text": "Maintenance & Scaling: Ongoing optimization, security updates, and feature enhancements for long-term success",
        "description": "Establish processes for maintaining, updating, and scaling the application over time",
        "children": [
          { "id": "performance", "text": "Performance Optimization: Database query optimization, caching strategies, and frontend bundle optimization", "description": "Continuously improve application speed and efficiency through various optimization techniques" },
          { "id": "security", "text": "Security Hardening: Regular security audits, dependency updates, and vulnerability assessments", "description": "Maintain security best practices and keep the application protected against emerging threats" }
        ]
      }
    ]
  }
}

Generate a similar detailed technical breakdown for the given project description with specific development tasks, implementation details, and technical considerations.`;

    const messages = [
      {
        role: 'system',
        content: "You are an expert software architect and product manager who creates detailed mindmaps with DESCRIPTIVE, INFORMATIVE nodes.\n\n🚨 CRITICAL MINDMAP NODE REQUIREMENTS:\n1. Node titles should be DESCRIPTIVE and INFORMATIVE (8-15 words) explaining what the feature does and why it's needed\n2. Node descriptions should provide additional implementation details (1-2 sentences)\n3. ABSOLUTELY NO 'Level X' text anywhere in titles or descriptions\n4. NEVER repeat the title in the description - add new information\n5. Use clear, explanatory language that helps users understand the purpose\n6. Each node represents ONE specific feature with clear business value\n7. Explain the 'why' and 'what' in the title, 'how' in the description\n8. Focus on user benefits and business value\n\n✅ GOOD EXAMPLES:\n- Title: 'Task Creation & Organization: Create tasks with titles, descriptions, due dates, and categorize them using labels, tags, or project folders', Description: 'Provides comprehensive task management with metadata and organizational features for better productivity'\n- Title: 'Real-time Notifications & Reminders: Alert users about upcoming deadlines and overdue tasks', Description: 'Keeps users informed and prevents missed deadlines through timely alerts'\n- Title: 'User Authentication & Security: Secure login system with password protection and session management', Description: 'Ensures user data privacy and prevents unauthorized access to personal task information'\n\n❌ BAD EXAMPLES:\n- Title: 'Create Task', Description: 'Add new tasks'\n- Title: 'Features - Level 1', Description: 'Features - Level 1'\n- Title: 'Dashboard', Description: 'Main interface'\n\nAlways respond with valid JSON that follows the exact structure requested."
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    return await this.makeRequest('/chat/completions', {
      messages,
      temperature: 0.7,
      max_tokens: 4000,
      ...options
    }, 'meta-llama/llama-4-scout-17b-16e-instruct:free');
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

  // Helper method to parse and clean project data
  parseProjectData(projectDescription) {
    // Try to extract structured data from the description
    const lines = projectDescription.split('\n');
    let name = 'Untitled Project';
    let description = projectDescription;
    let features = 'Core functionality';
    let techStack = 'React, Node.js, MongoDB';

    // Look for project name patterns
    const nameMatch = projectDescription.match(/(?:Project|technical project mindmap for|mindmap for):\s*([^\n]+)/i) || 
                     projectDescription.match(/for\s+"([^"]+)"/i) ||
                     projectDescription.match(/^([A-Z][a-zA-Z\s]+)(?:\s-|\s:|$)/);
    if (nameMatch) {
      name = nameMatch[1].trim();
    }

    // Look for features section
    const featuresMatch = projectDescription.match(/Features:\s*([\s\S]*?)(?:\n\n|Tech Stack:|Project Type:|$)/i);
    if (featuresMatch) {
      features = featuresMatch[1].trim();
    }

    // Look for tech stack patterns
    const techMatch = projectDescription.match(/Tech Stack:\s*([^\n]+)/i);
    if (techMatch) {
      techStack = techMatch[1].trim();
    }

    // Look for description section
    const descMatch = projectDescription.match(/Project Description:\s*([\s\S]*?)(?:\n\nFeatures:|$)/i);
    if (descMatch) {
      description = descMatch[1].trim();
    }

    return {
      name: name,
      description: description,
      features: features,
      techStack: techStack
    };
  }
}

module.exports = new OpenRouterService();