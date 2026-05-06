// ============================================================================
// OmniMind AI — Research Routes
// ============================================================================

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { setupSSE, sendSSE, sanitizeInput, apiError } from '../utils/helpers.js';
import { createConversation, getConversation, addMessage } from '../db/database.js';
import { handleResearch } from '../services/orchestrator.js';
import { generateTitle } from '../services/gemini.js';

const router = Router();

router.post('/research', async (req, res) => {
  const { query, conversationId } = req.body;

  if (!query || !query.trim()) {
    return apiError(res, 400, 'Query is required');
  }

  const sanitized = sanitizeInput(query);
  let convId = conversationId || uuidv4();

  if (!getConversation(convId)) {
    createConversation(convId, 'Research: ' + sanitized.slice(0, 40), 'research');
  }

  addMessage(convId, 'user', `[Deep Research] ${sanitized}`);
  setupSSE(res);
  sendSSE(res, 'info', { conversationId: convId, mode: 'research' });

  await handleResearch(
    sanitized,
    (progress) => sendSSE(res, 'progress', progress),
    (chunk) => sendSSE(res, 'chunk', { text: chunk }),
    async (fullText, sourcesList) => {
      const finalContent = sourcesList ? `${fullText}\n\n---\n### Sources\n${sourcesList}` : fullText;
      addMessage(convId, 'assistant', finalContent, { mode: 'research' });
      
      const title = await generateTitle(sanitized);
      if (title) sendSSE(res, 'title', { title: `🔬 ${title}` });
      
      sendSSE(res, 'done', { conversationId: convId });
      res.end();
    },
    (error) => {
      sendSSE(res, 'error', { message: error.message });
      res.end();
    }
  );
});

export default router;
