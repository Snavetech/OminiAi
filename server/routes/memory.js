// ============================================================================
// OmniMind AI — Memory Routes
// ============================================================================

import { Router } from 'express';
import { apiError } from '../utils/helpers.js';
import { addMemory, listMemories, searchMemories, deleteMemory } from '../services/memory.js';

const router = Router();

router.get('/', (req, res) => {
  const { category } = req.query;
  const memories = listMemories(category || null);
  res.json({ memories });
});

router.post('/', (req, res) => {
  const { category = 'general', content } = req.body;
  if (!content) return apiError(res, 400, 'Content is required');
  const memory = addMemory(category, content, 'manual');
  res.json({ success: true, memory });
});

router.get('/recall', (req, res) => {
  const { q } = req.query;
  if (!q) return apiError(res, 400, 'Query parameter "q" is required');
  const results = searchMemories(q);
  res.json({ memories: results });
});

router.delete('/:id', (req, res) => {
  deleteMemory(parseInt(req.params.id));
  res.json({ success: true });
});

export default router;
