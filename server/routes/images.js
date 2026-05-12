// ============================================================================
// Snave AI — Image Generation Routes
// ============================================================================

import { Router } from 'express';
import { apiError } from '../utils/helpers.js';
import { generateImage } from '../services/imageGen.js';

const router = Router();

router.post('/generate', async (req, res) => {
  const { prompt, enhance = true } = req.body;

  if (!prompt || !prompt.trim()) {
    return apiError(res, 400, 'Prompt is required');
  }

  try {
    const result = await generateImage(prompt.trim(), enhance);
    res.json({
      success: true,
      image: result.dataUrl,
      prompt: result.prompt,
      enhancedPrompt: result.enhancedPrompt
    });
  } catch (error) {
    apiError(res, 500, error.message);
  }
});

export default router;
