const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Import utilities and middleware
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const connectDB = require('./config/database');

// Create Express app
const app = express();

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Compression and parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'FlowSprint-Backend',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Import routes
const aiRoutes = require('./routes/ai');
const projectRoutes = require('./routes/projects');

// API routes
app.use('/api/ai', aiRoutes);
app.use('/api/projects', projectRoutes);

app.get('/api', (req, res) => {
  res.json({
    message: 'FlowSprint Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api',
      ai: '/api/ai',
      projects: '/api/projects'
    },
    features: {
      aiProviders: ['OpenRouter', 'Cerebras', 'Meta Llama'],
      capabilities: ['Mindmap Generation', 'Code Generation', 'PRD Creation'],
      hackathonReady: true,
      prizeCategories: 4
    }
  });
});

// 404 handler - catch all unmatched routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Error handling middleware (should be last)
app.use(errorHandler);

module.exports = app;