// ============================================================================
// OmniMind AI — OpenRouter Service (formerly Google Gemini)
// ============================================================================
// Handles interactions with OpenRouter using the OpenAI SDK.
// ============================================================================

import OpenAI from 'openai';

let openai = null;
const MODEL = 'google/gemini-2.5-flash';

export function initGemini(apiKey) {
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    console.warn('⚠️  OpenRouter API key not configured. Chat will use fallback mode.');
    return false;
  }
  openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: apiKey,
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/Snavetech/OminiAi', 
      'X-Title': 'OmniMind AI'
    }
  });
  console.log('✅ OpenRouter API initialized (using ' + MODEL + ')');
  return true;
}

export function isGeminiAvailable() {
  return openai !== null;
}

export async function streamChat(systemPrompt, history, userMessage, onChunk, onDone, onError) {
  if (!openai) {
    onError(new Error('OpenRouter not initialized'));
    return;
  }

  try {
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    // Map history to OpenAI format
    for (const msg of history) {
      messages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content });
    }
    
    // Add current user message
    messages.push({ role: 'user', content: userMessage });

    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages: messages,
      stream: true,
      max_tokens: 4000,
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
    console.error('OpenRouter stream error:', error.message);
    onError(error);
  }
}

export async function generateContent(prompt, systemPrompt = '') {
  if (!openai) throw new Error('OpenRouter not initialized');

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const result = await openai.chat.completions.create({
    model: MODEL,
    messages: messages,
    max_tokens: 4000,
  });
  return result.choices[0].message.content;
}

export async function analyzeImage(base64Data, mimeType, prompt = 'Describe this image in detail.') {
  if (!openai) throw new Error('OpenRouter not initialized');

  // OpenAI vision format
  const imageUrl = `data:${mimeType};base64,${base64Data}`;
  
  const result = await openai.chat.completions.create({
    model: MODEL, // gemini-1.5-flash on openrouter supports vision
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } }
        ]
      }
    ],
    max_tokens: 4000,
  });
  
  return result.choices[0].message.content;
}

export async function analyzeDocument(documentText, prompt) {
  if (!openai) throw new Error('OpenRouter not initialized');

  const fullPrompt = `Here is a document's content:\n\n---\n${documentText}\n---\n\nUser's question: ${prompt}`;
  
  const result = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: fullPrompt }],
    max_tokens: 4000,
  });
  
  return result.choices[0].message.content;
}

export async function generateTitle(message) {
  if (!openai) return 'New Chat';

  try {
    const result = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ 
        role: 'user', 
        content: `Generate a very short title (max 5 words) for a conversation starting with: "${message.slice(0, 200)}". Return ONLY the title.` 
      }],
      max_tokens: 100,
    });
    
    const title = result.choices[0].message.content.trim().replace(/["']/g, '');
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
