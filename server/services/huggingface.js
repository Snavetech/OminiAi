// ============================================================================
// Snave AI — HuggingFace Inference Service
// ============================================================================
// Fallback text generation + image generation via HuggingFace free API.
// ============================================================================

const HF_API_URL = 'https://api-inference.huggingface.co/models';
let hfToken = null;

// Model choices
const TEXT_MODEL = 'mistralai/Mistral-7B-Instruct-v0.3';
const IMAGE_MODEL = 'black-forest-labs/FLUX.1-schnell';

/**
 * Initialize HuggingFace with API token.
 */
export function initHuggingFace(token) {
  if (!token || token === 'your_huggingface_token_here') {
    console.warn('⚠️  HuggingFace token not configured. Fallback & image gen limited.');
    return false;
  }
  hfToken = token;
  console.log('✅ HuggingFace API initialized');
  return true;
}

/**
 * Check if HuggingFace is available.
 */
export function isHFAvailable() {
  return hfToken !== null;
}

/**
 * Generate text using HuggingFace Inference API (fallback).
 */
export async function generateText(prompt, maxTokens = 1024) {
  if (!hfToken) throw new Error('HuggingFace not initialized');

  const HF_TEXT_URL = 'https://router.huggingface.co/hf-inference/models';
  const response = await fetch(`${HF_TEXT_URL}/${TEXT_MODEL}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${hfToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: maxTokens,
        temperature: 0.7,
        return_full_text: false
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HuggingFace API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  if (Array.isArray(data) && data[0]?.generated_text) {
    return data[0].generated_text;
  }
  
  throw new Error('Unexpected HuggingFace response format');
}

/**
 * Generate an image using HuggingFace Inference API.
 * Returns a base64-encoded image string.
 */
export async function generateImage(prompt) {
  if (!hfToken) throw new Error('HuggingFace not initialized');

  const HF_IMAGE_URL = 'https://router.huggingface.co/hf-inference/models';
  const response = await fetch(`${HF_IMAGE_URL}/${IMAGE_MODEL}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${hfToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        num_inference_steps: 4 // FLUX.1-schnell is optimized for few steps
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Image generation error: ${response.status} - ${error}`);
  }

  // Response is a raw image blob
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return {
    base64,
    mimeType: 'image/png',
    dataUrl: `data:image/png;base64,${base64}`
  };
}

export default {
  initHuggingFace,
  isHFAvailable,
  generateText,
  generateImage
};
