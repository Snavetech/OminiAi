// ============================================================================
// OmniMind AI — Image Generation Service
// ============================================================================

import * as huggingface from './huggingface.js';
import * as gemini from './gemini.js';

async function enhancePrompt(prompt) {
  if (!gemini.isGeminiAvailable()) return prompt;
  try {
    const enhanced = await gemini.generateContent(
      `Enhance this image prompt for a text-to-image AI. Keep under 200 words. Focus on visual details, style, lighting. Return ONLY the enhanced prompt.\n\nOriginal: "${prompt}"`
    );
    return enhanced.trim() || prompt;
  } catch { return prompt; }
}

export async function generateImage(prompt, enhance = true) {
  if (!huggingface.isHFAvailable()) {
    throw new Error('Image generation requires HuggingFace API token. Configure HF_API_TOKEN in .env');
  }
  const enhancedPrompt = enhance ? await enhancePrompt(prompt) : prompt;
  const result = await huggingface.generateImage(enhancedPrompt);
  return { ...result, prompt, enhancedPrompt };
}

export default { generateImage };
