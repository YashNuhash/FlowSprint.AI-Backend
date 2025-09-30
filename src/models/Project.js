const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  // Basic project information
  name: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
  },
  
  description: {
    type: String,
    required: true,
    maxLength: 500
  },
  
  // Project configuration
  type: {
    type: String,
    enum: ['web-app', 'mobile-app', 'api', 'desktop-app', 'ai-project', 'other'],
    default: 'web-app'
  },
  
  industry: {
    type: String,
    enum: ['tech', 'finance', 'healthcare', 'education', 'e-commerce', 'gaming', 'other'],
    default: 'tech'
  },
  
  complexity: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  
  // AI-generated content
  mindmap: {
    type: mongoose.Schema.Types.Mixed, // JSON object
    default: null
  },
  
  prd: {
    type: mongoose.Schema.Types.Mixed, // JSON object with structured PRD
    default: null
  },
  
  generatedCode: [{
    language: {
      type: String,
      required: true
    },
    filename: {
      type: String,
      required: true
    },
    code: {
      type: String,
      required: true
    },
    description: String,
    generatedAt: {
      type: Date,
      default: Date.now
    },
    aiProvider: {
      type: String,
      enum: ['openrouter', 'cerebras', 'meta-llama'],
      required: true
    }
  }],
  
  // Project status and tracking
  status: {
    type: String,
    enum: ['planning', 'in-development', 'testing', 'deployed', 'archived'],
    default: 'planning'
  },
  
  progress: {
    mindmapCompleted: {
      type: Boolean,
      default: false
    },
    prdCompleted: {
      type: Boolean,
      default: false
    },
    codeGenerated: {
      type: Boolean,
      default: false
    },
    percentComplete: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  },
  
  // AI service usage tracking
  aiUsage: {
    totalRequests: {
      type: Number,
      default: 0
    },
    openRouterCalls: {
      type: Number,
      default: 0
    },
    cerebrasCalls: {
      type: Number,
      default: 0
    },
    metaLlamaCalls: {
      type: Number,
      default: 0
    },
    totalTokensUsed: {
      type: Number,
      default: 0
    },
    avgResponseTime: {
      type: Number,
      default: 0
    }
  },
  
  // Metadata
  createdBy: {
    type: String,
    required: true,
    default: 'user'
  },
  
  tags: [{
    type: String,
    trim: true,
    maxLength: 50
  }],
  
  collaborators: [{
    name: String,
    email: String,
    role: {
      type: String,
      enum: ['owner', 'editor', 'viewer'],
      default: 'viewer'
    }
  }],
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  lastGeneratedAt: {
    type: Date,
    default: null
  }
});

// Indexes for better query performance
ProjectSchema.index({ name: 1, createdBy: 1 });
ProjectSchema.index({ status: 1 });
ProjectSchema.index({ type: 1, industry: 1 });
ProjectSchema.index({ createdAt: -1 });

// Pre-save middleware to update timestamps and progress
ProjectSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Auto-calculate progress percentage
  let completed = 0;
  if (this.progress.mindmapCompleted) completed++;
  if (this.progress.prdCompleted) completed++;
  if (this.progress.codeGenerated) completed++;
  
  this.progress.percentComplete = Math.round((completed / 3) * 100);
  
  next();
});

// Virtual for formatted creation date
ProjectSchema.virtual('formattedCreatedAt').get(function() {
  return this.createdAt.toLocaleDateString();
});

// Instance methods
ProjectSchema.methods.addGeneratedCode = function(codeData) {
  this.generatedCode.push({
    ...codeData,
    generatedAt: new Date()
  });
  this.progress.codeGenerated = true;
  this.lastGeneratedAt = new Date();
  return this.save();
};

ProjectSchema.methods.updateMindmap = function(mindmapData, provider = 'unknown') {
  this.mindmap = mindmapData;
  this.progress.mindmapCompleted = true;
  this.lastGeneratedAt = new Date();
  
  // Update AI usage stats
  this.aiUsage.totalRequests++;
  if (provider === 'openrouter') this.aiUsage.openRouterCalls++;
  else if (provider === 'cerebras') this.aiUsage.cerebrasCalls++;
  else if (provider === 'meta-llama') this.aiUsage.metaLlamaCalls++;
  
  return this.save();
};

ProjectSchema.methods.updatePRD = function(prdData, provider = 'unknown') {
  this.prd = prdData;
  this.progress.prdCompleted = true;
  this.lastGeneratedAt = new Date();
  
  // Update AI usage stats
  this.aiUsage.totalRequests++;
  if (provider === 'openrouter') this.aiUsage.openRouterCalls++;
  else if (provider === 'cerebras') this.aiUsage.cerebrasCalls++;
  else if (provider === 'meta-llama') this.aiUsage.metaLlamaCalls++;
  
  return this.save();
};

ProjectSchema.methods.updateAIUsage = function(provider, responseTime, tokens = 0) {
  this.aiUsage.totalRequests++;
  this.aiUsage.totalTokensUsed += tokens;
  
  // Calculate rolling average response time
  const currentAvg = this.aiUsage.avgResponseTime || 0;
  const totalRequests = this.aiUsage.totalRequests;
  this.aiUsage.avgResponseTime = Math.round(
    (currentAvg * (totalRequests - 1) + responseTime) / totalRequests
  );
  
  // Update provider-specific counters
  if (provider === 'openrouter') this.aiUsage.openRouterCalls++;
  else if (provider === 'cerebras') this.aiUsage.cerebrasCalls++;
  else if (provider === 'meta-llama') this.aiUsage.metaLlamaCalls++;
  
  return this.save();
};

// Static methods
ProjectSchema.statics.getProjectsByStatus = function(status) {
  return this.find({ status }).sort({ updatedAt: -1 });
};

ProjectSchema.statics.getRecentProjects = function(limit = 10) {
  return this.find()
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select('name description status progress createdAt updatedAt');
};

ProjectSchema.statics.getProjectStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalProjects: { $sum: 1 },
        avgProgress: { $avg: '$progress.percentComplete' },
        totalAIRequests: { $sum: '$aiUsage.totalRequests' },
        avgResponseTime: { $avg: '$aiUsage.avgResponseTime' }
      }
    }
  ]);
};

// Export the model
module.exports = mongoose.model('Project', ProjectSchema);