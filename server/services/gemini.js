// ============================================================================
// OmniMind AI — Google Gemini Service
// ============================================================================
// Handles all interactions with Google Gemini API (free tier - Flash models).
// Supports streaming responses, vision (multimodal), and structured output.
// ============================================================================

import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI = null;
let model = null;

/**
 * Initialize the Gemini API client.
 */
export function initGemini(apiKey) {
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    console.warn('⚠️  Gemini API key not configured. Chat will use fallback mode.');
    return false;
  }
  genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  console.log('✅ Gemini API initialized (gemini-1.5-flash)');
  return true;
}

/**
 * Check if Gemini is available.
 */
export function isGeminiAvailable() {
  return model !== null;
}

/**
 * Generate a streaming response from Gemini.
 * @param {string} systemPrompt - System instruction
 * @param {Array} history - Conversation history [{role, content}]
 * @param {string} userMessage - Current user message
 * @param {Function} onChunk - Callback for each text chunk
 * @param {Function} onDone - Callback when generation completes
 * @param {Function} onError - Callback on error
 */
export async function streamChat(systemPrompt, history, userMessage, onChunk, onDone, onError) {
  if (!model) {
    onError(new Error('Gemini not initialized'));
    return;
  }

  try {
    // Build the chat with system instruction
    const chat = model.startChat({
      systemInstruction: { role: 'user', parts: [{ text: systemPrompt }] },
      history: history.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }))
    });

    // Stream the response
    const result = await chat.sendMessageStream(userMessage);
    let fullResponse = '';

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        fullResponse += text;
        onChunk(text);
      }
    }

    onDone(fullResponse);
  } catch (error) {
    console.error('Gemini stream error:', error.message);
    onError(error);
  }
}

/**
 * Generate a single (non-streaming) response from Gemini.
 */
export async function generateContent(prompt, systemPrompt = '') {
  if (!model) throw new Error('Gemini not initialized');

  const genModel = systemPrompt 
    ? genAI.getGenerativeModel({ model: 'gemini-1.5-flash', systemInstruction: { role: 'user', parts: [{ text: systemPrompt }] } })
    : model;

  const result = await genModel.generateContent(prompt);
  return result.response.text();
}

/**
 * Analyze an image with Gemini Vision.
 * @param {string} base64Data - Base64-encoded image data
 * @param {string} mimeType - Image MIME type (e.g., 'image/jpeg')
 * @param {string} prompt - User's question about the image
 */
export async function analyzeImage(base64Data, mimeType, prompt = 'Describe this image in detail.') {
  if (!model) throw new Error('Gemini not initialized');

  const imagePart = {
    inlineData: { data: base64Data, mimeType }
  };

  const result = await model.generateContent([prompt, imagePart]);
  return result.response.text();
}

/**
 * Analyze a document's text content with Gemini.
 */
export async function analyzeDocument(documentText, prompt) {
  if (!model) throw new Error('Gemini not initialized');

  const fullPrompt = `Here is a document's content:\n\n---\n${documentText}\n---\n\nUser's question: ${prompt}`;
  const result = await model.generateContent(fullPrompt);
  return result.response.text();
}

/**
 * Generate a short conversation title from the first message.
 */
export async function generateTitle(message) {
  if (!model) return 'New Chat';

  try {
    const result = await model.generateContent(
      `Generate a very short title (max 5 words) for a conversation starting with: "${message.slice(0, 200)}". Return ONLY the title.`
    );
    const title = result.response.text().trim().replace(/["']/g, '');
    return title.slice(0, 60) || 'New Chat';
  } catch {
    return 'New Chat';
  }
}

export default {
  initGemini,
  isGeminiAvailable,
  streamChat,
  generateContent,
  analyzeImage,
  analyzeDocument,
  generateTitle
};
