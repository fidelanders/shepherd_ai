'use strict';

// ─── Validate environment before anything else ────────────────────────────────
const env = require('./src/config/env');

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./src/config/swagger');


// ─── Middleware ───────────────────────────────────────────────────────────────
const { apiKeyAuth } = require('./src/middleware/auth');
const { generalLimiter } = require('./src/middleware/rateLimiter');
const { errorHandler } = require('./src/middleware/errorHandler');

// ─── Routes ───────────────────────────────────────────────────────────────────
const healthRoutes = require('./src/routes/health');
const transcribeRoutes = require('./src/routes/transcribe');
const jobRoutes = require('./src/routes/jobs');
const exportRoutes = require('./src/routes/export');

// ─── Worker (runs in same process in dev; run separately in prod) ─────────────
require('./src/workers/transcriptionWorker');

// ─── Ensure required directories exist ───────────────────────────────────────
['uploads', 'exports', 'temp', 'processed'].forEach(dir => {
  fs.mkdirSync(path.join(__dirname, dir), { recursive: true });
});

if (process.env.NODE_ENV === 'production') {
  require('./src/workers/transcriptionWorker');
}
// ─── App ──────────────────────────────────────────────────────────────────────
const app = express();


// CORS — restrict origins in production via ALLOWED_ORIGINS env var
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
app.use(cors({
  origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (dev: coloured, prod: combined)
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiting on all API routes
app.use('/api', generalLimiter);
app.set('trust proxy', true); // <-- TRUST the X-Forwarded-For header for correct client IPs when behind a proxy (e.g. in production)

// Static file serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/exports', express.static(path.join(__dirname, 'exports')));

// ─── Swagger docs (no auth required) ─────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Shepherd AI API',
  customCss: `
    .swagger-ui .topbar { background-color: #1e3a5f; }
    .swagger-ui .topbar-wrapper::after {
      content: '🐑 Shepherd AI';
      color: white;
      font-size: 1.4rem;
      font-weight: 700;
      padding-left: 1rem;
    }
  `,
  swaggerOptions: { persistAuthorization: true },
}));

app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ─── Public routes (no auth) ──────────────────────────────────────────────────
app.use('/api', healthRoutes);

// ─── Protected routes ─────────────────────────────────────────────────────────
app.use('/api', apiKeyAuth, transcribeRoutes);
app.use('/api', apiKeyAuth, jobRoutes);
app.use('/api', apiKeyAuth, exportRoutes);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', docs: '/api-docs' });
});

// ─── Error handler (must be last) ────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
const Port = env.PORT || 5000;
app.listen(Port, () => {
  console.log('');
  console.log('✨  Shepherd AI Backend v3.0');
  console.log(`🚀  Server:   http://localhost:${env.PORT}`);
  console.log(`📚  Docs:     http://localhost:${env.PORT}/api-docs`);
  console.log(`💡  Health:   http://localhost:${env.PORT}/api/health`);
  console.log(`🔐  Auth:     ${process.env.API_KEYS ? 'enabled (X-API-Key)' : 'disabled (set API_KEYS to enable)'}`);
  console.log(`🌐  Mode:     ${env.NODE_ENV}`);
  console.log('');
});

module.exports = app;
