// ============================================================================
// Snave AI — Groq AI Service (Ultra-fast, 100% Free Tier)
// ============================================================================
// Uses OpenAI-compatible SDK with Groq Cloud (https://api.groq.com/openai/v1).
// ============================================================================

import OpenAI from 'openai';

let openai = null;
let currentModel = 'openai/gpt-oss-120b';
const VISION_MODEL = 'openai/gpt-oss-20b';
const BASE_URL = 'https://api.groq.com/openai/v1';

export function initGemini(apiKey) {
  const key = apiKey || process.env.GROQ_API_KEY || (process.env.GEMINI_API_KEY?.startsWith('gsk_') ? process.env.GEMINI_API_KEY : null);

  if (!key || key.startsWith('your_') || key.includes('_here')) {
    console.warn('⚠️  Groq API key not configured. Chat will use fallback mode.');
    initGemini.initialized = false;
    return false;
  }

  currentModel = process.env.GROQ_MODEL || process.env.AI_MODEL || 'openai/gpt-oss-120b';

  openai = new OpenAI({
    baseURL: BASE_URL,
    apiKey: key
  });

  initGemini.initialized = true;
  console.log(`✅ Groq API initialized (model: ${currentModel}, speed: 500+ tok/s)`);
  return true;
}

export function isGeminiAvailable() {
  return openai !== null;
}

export async function streamChat(systemPrompt, history, userMessage, onChunk, onDone, onError) {
  if (!openai) {
    onError(new Error('Groq not initialized'));
    return;
  }

  try {
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of history) {
      messages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content });
    }

    messages.push({ role: 'user', content: userMessage });

    const stream = await openai.chat.completions.create({
      model: currentModel,
      messages: messages,
      stream: true,
      max_tokens: 4096,
      temperature: 0.7
    });

    let fullResponse = '';

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) {
        fullResponse += text;
        onChunk(text);
      }
    }

    onDone(fullResponse);
  } catch (error) {
    console.error('Groq stream error:', error.message);
    onError(error);
  }
}

export async function generateContent(prompt, systemPrompt = '') {
  if (!openai) throw new Error('Groq not initialized');

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const result = await openai.chat.completions.create({
    model: currentModel,
    messages: messages,
    max_tokens: 4096,
    temperature: 0.7
  });

  return result.choices?.[0]?.message?.content || '';
}

export async function analyzeImage(base64Data, mimeType, prompt = 'Describe this image in detail.') {
  if (!openai) throw new Error('Groq not initialized');

  const imageUrl = `data:${mimeType};base64,${base64Data}`;

  try {
    const result = await openai.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ],
      max_tokens: 2048
    });
    return result.choices?.[0]?.message?.content || '';
  } catch {
    return generateContent(`[Image analysis requested: ${mimeType}] ${prompt}`);
  }
}

export async function analyzeDocument(documentText, prompt) {
  if (!openai) throw new Error('Groq not initialized');
  return generateContent(`Here is a document's content:\n\n---\n${documentText}\n---\n\nUser's question: ${prompt}`);
}

export async function generateTitle(message) {
  if (!openai) return 'New Chat';

  try {
    const prompt = `Generate a very short title (max 5 words) for a conversation starting with: "${message.slice(0, 200)}". Return ONLY the title.`;
    const title = await generateContent(prompt);
    return title.trim().replace(/["']/g, '').slice(0, 60) || 'New Chat';
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
