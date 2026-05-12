// ============================================================================
// Snave AI — Server Entry Point
// ============================================================================
// Express server that serves the frontend and all API routes.
// ============================================================================

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import database
import { initDatabase } from './db/database.js';

// Import services
import { initGemini } from './services/gemini.js';
import { initHuggingFace } from './services/huggingface.js';

// Import routes
import chatRoutes from './routes/chat.js';
import researchRoutes from './routes/research.js';
import imageRoutes from './routes/images.js';
import memoryRoutes from './routes/memory.js';
import fileRoutes from './routes/files.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ──────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'client')));

// ─── API Routes ──────────────────────────────────────────────────────────

app.use('/api', chatRoutes);
app.use('/api/research', researchRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/files', fileRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    name: 'Snave AI',
    version: '1.0.0',
    services: {
      gemini: initGemini.initialized || false,
      huggingface: initHuggingFace.initialized || false
    }
  });
});

// Catch-all: serve frontend for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: true, message: 'Internal server error' });
});

// ─── Start Server ────────────────────────────────────────────────────────

async function start() {
  console.log('\n🧠 Snave AI — Starting...\n');

  // Initialize database
  initDatabase();

  // Initialize AI services
  const geminiOk = initGemini(process.env.GEMINI_API_KEY);
  const hfOk = initHuggingFace(process.env.HF_API_TOKEN);

  if (!geminiOk && !hfOk) {
    console.warn('\n⚠️  No AI services configured!');
    console.warn('   Copy .env.example to .env and add your API keys.\n');
  }

  app.listen(PORT, () => {
    console.log(`\n🚀 Snave AI running at http://localhost:${PORT}\n`);
  });
}

start().catch(console.error);
