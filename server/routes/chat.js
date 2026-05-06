// ============================================================================
// OmniMind AI — Chat Routes
// ============================================================================

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { setupSSE, sendSSE, sanitizeInput, apiError } from '../utils/helpers.js';
import { createConversation, getConversation, listConversations, updateConversationTitle, deleteConversation, addMessage, getMessages } from '../db/database.js';
import { handleChat, detectTask } from '../services/orchestrator.js';
import { generateTitle } from '../services/gemini.js';
import { extractMemories } from '../services/memory.js';

const router = Router();

// ─── SSE Streaming Chat ──────────────────────────────────────────────────

router.post('/chat', async (req, res) => {
  const { message, conversationId, personality = 'professional', agentMode = false } = req.body;

  if (!message || !message.trim()) {
    return apiError(res, 400, 'Message is required');
  }

  const sanitized = sanitizeInput(message);
  let convId = conversationId;

  // Create new conversation if needed
  if (!convId) {
    convId = uuidv4();
    createConversation(convId, 'New Chat', personality);
  } else if (!getConversation(convId)) {
    createConversation(convId, 'New Chat', personality);
  }

  // Save user message
  addMessage(convId, 'user', sanitized);

  // Detect task type if agent mode is on
  let taskInfo = { tool: 'chat', reasoning: 'Default chat' };
  if (agentMode) {
    taskInfo = await detectTask(sanitized);
  }

  // Setup SSE
  setupSSE(res);

  // Send conversation info
  sendSSE(res, 'info', { conversationId: convId, task: taskInfo });

  // Stream the response
  let fullResponse = '';

  await handleChat(
    convId,
    sanitized,
    personality,
    // onChunk
    (chunk) => {
      fullResponse += chunk;
      sendSSE(res, 'chunk', { text: chunk });
    },
    // onDone
    async (response) => {
      // Save assistant message
      addMessage(convId, 'assistant', fullResponse, { personality, task: taskInfo.tool });

      // Generate title for new conversations (first message)
      const messages = getMessages(convId);
      if (messages.length <= 2) {
        const title = await generateTitle(sanitized);
        updateConversationTitle(convId, title);
        sendSSE(res, 'title', { title });
      }

      // Auto-extract memories (async, don't block)
      extractMemories(sanitized, fullResponse).catch(() => {});

      sendSSE(res, 'done', { conversationId: convId });
      res.end();
    },
    // onError
    (error) => {
      sendSSE(res, 'error', { message: error.message });
      res.end();
    }
  );
});

// ─── Conversation CRUD ───────────────────────────────────────────────────

router.get('/conversations', (req, res) => {
  const conversations = listConversations(50);
  res.json({ conversations });
});

router.get('/conversations/:id', (req, res) => {
  const conv = getConversation(req.params.id);
  if (!conv) return apiError(res, 404, 'Conversation not found');
  const messages = getMessages(req.params.id);
  res.json({ conversation: conv, messages });
});

router.delete('/conversations/:id', (req, res) => {
  deleteConversation(req.params.id);
  res.json({ success: true });
});

export default router;
