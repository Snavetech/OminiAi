// ============================================================================
// Snave AI — AgentRouter Service (OpenAI-compatible gateway)
// ============================================================================
// Handles interactions with AgentRouter (https://agentrouter.org/v1).
// ============================================================================

import OpenAI from 'openai';

let openai = null;
let currentModel = 'gpt-5.6-sol';
let currentBaseUrl = 'https://agentrouter.org/v1';

function extractResponseText(response) {
  if (!response) return '';
  if (typeof response.output_text === 'string' && response.output_text) {
    return response.output_text;
  }
  const messageItem = response.output?.find(o => o.type === 'message');
  if (messageItem?.content?.[0]?.text) {
    return messageItem.content[0].text;
  }
  return response.output?.[0]?.content?.[0]?.text || '';
}

export function initGemini(apiKey) {
  const key = apiKey || process.env.AGENTROUTER_API_KEY || process.env.GEMINI_API_KEY;

  if (!key || key.startsWith('your_') || key.includes('_here')) {
    console.warn('⚠️  AgentRouter API key not configured. Chat will use fallback mode.');
    initGemini.initialized = false;
    return false;
  }

  currentBaseUrl = process.env.AGENTROUTER_BASE_URL || process.env.AI_BASE_URL || 'https://agentrouter.org/v1';
  currentModel = process.env.AGENTROUTER_MODEL || process.env.AI_MODEL || 'gpt-5.6-sol';

  openai = new OpenAI({
    baseURL: currentBaseUrl,
    apiKey: key,
    defaultHeaders: {
      'User-Agent': 'codex_cli_rs/0.101.0 (Mac OS; arm64)',
      'Originator': 'codex_cli_rs',
      'Version': '0.101.0'
    }
  });

  initGemini.initialized = true;
  console.log(`✅ AgentRouter API initialized (endpoint: ${currentBaseUrl}, model: ${currentModel})`);
  return true;
}

export function isGeminiAvailable() {
  return openai !== null;
}

export async function streamChat(systemPrompt, history, userMessage, onChunk, onDone, onError) {
  if (!openai) {
    onError(new Error('AgentRouter not initialized'));
    return;
  }

  try {
    const inputMessages = [];
    for (const msg of history) {
      inputMessages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content });
    }
    inputMessages.push({ role: 'user', content: userMessage });

    let fullResponse = '';

    // Primary: AgentRouter Responses API
    try {
      const response = await openai.responses.create({
        model: currentModel,
        instructions: systemPrompt || undefined,
        input: inputMessages
      });
      fullResponse = extractResponseText(response);
    } catch (err) {
      // Secondary fallback: standard chat completions
      const messages = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      messages.push(...inputMessages);

      const stream = await openai.chat.completions.create({
        model: currentModel,
        messages: messages,
        stream: true,
        max_tokens: 4000
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) {
          fullResponse += text;
          onChunk(text);
        }
      }
      onDone(fullResponse);
      return;
    }

    if (fullResponse) {
      // Smoothly stream words to the SSE client
      const words = fullResponse.split(/(?<=\s+)/);
      for (const word of words) {
        onChunk(word);
        await new Promise(r => setTimeout(r, 15));
      }
    }

    onDone(fullResponse);
  } catch (error) {
    console.error('AgentRouter error:', error.message);
    onError(error);
  }
}

export async function generateContent(prompt, systemPrompt = '') {
  if (!openai) throw new Error('AgentRouter not initialized');

  try {
    const response = await openai.responses.create({
      model: currentModel,
      instructions: systemPrompt || undefined,
      input: prompt
    });
    return extractResponseText(response);
  } catch (err) {
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const result = await openai.chat.completions.create({
      model: currentModel,
      messages: messages,
      max_tokens: 4000
    });
    return result.choices?.[0]?.message?.content || '';
  }
}

export async function analyzeImage(base64Data, mimeType, prompt = 'Describe this image in detail.') {
  if (!openai) throw new Error('AgentRouter not initialized');

  const imageUrl = `data:${mimeType};base64,${base64Data}`;
  
  try {
    const result = await openai.chat.completions.create({
      model: currentModel,
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
  } catch {
    return generateContent(`[Image analysis requested: ${mimeType}] ${prompt}`);
  }
}

export async function analyzeDocument(documentText, prompt) {
  if (!openai) throw new Error('AgentRouter not initialized');
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
