// ============================================================================
// Snave AI — AgentRouter Service (OpenAI-compatible gateway)
// ============================================================================
// Handles interactions with AgentRouter (https://agentrouter.org/v1).
// ============================================================================

import OpenAI from 'openai';

let openai = null;
let currentModel = 'gpt-5.6-sol';
let currentBaseUrl = 'https://agentrouter.org/v1';

let wafCookie = '';
let cookieExpiry = 0;

/**
 * Fetch and cache the Alibaba Cloud WAF session cookie (acw_tc) required
 * by AgentRouter to prevent 405 Method Not Allowed / WAF block errors.
 */
async function getWafCookie(baseUrl) {
  const now = Date.now();
  if (wafCookie && now < cookieExpiry) {
    return wafCookie;
  }

  try {
    const origin = new URL(baseUrl).origin;
    const res = await fetch(origin, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      }
    });

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/acw_tc=[^;]+/);
      if (match) {
        wafCookie = match[0];
        cookieExpiry = now + 25 * 60 * 1000; // cache for 25 minutes
        return wafCookie;
      }
    }
  } catch (e) {
    // Continue if initial probe fails
  }
  return wafCookie;
}

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

function cleanErrorMessage(msg) {
  if (!msg) return 'An unexpected error occurred while communicating with AgentRouter.';
  if (msg.includes('data-spm') || msg.includes('405') || msg.includes('<!doctype')) {
    return 'AgentRouter temporary connection gateway block (WAF). Please retry in a few seconds.';
  }
  return msg;
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
    fetch: async (url, init) => {
      const cookie = await getWafCookie(currentBaseUrl);
      const headers = new Headers(init?.headers || {});
      if (cookie) {
        headers.set('Cookie', cookie);
      }
      headers.set('User-Agent', 'codex_cli_rs/0.101.0 (Mac OS; arm64)');
      headers.set('Originator', 'codex_cli_rs');
      headers.set('Version', '0.101.0');

      const response = await fetch(url, { ...init, headers });

      // Save refreshed WAF cookie if returned
      const newCookie = response.headers.get('set-cookie');
      if (newCookie) {
        const match = newCookie.match(/acw_tc=[^;]+/);
        if (match) {
          wafCookie = match[0];
          cookieExpiry = Date.now() + 25 * 60 * 1000;
        }
      }

      return response;
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
      // If WAF 405 occurred, clear cached cookie so next try probes a fresh one
      if (err.message && (err.message.includes('405') || err.message.includes('data-spm'))) {
        wafCookie = '';
      }

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
    onError(new Error(cleanErrorMessage(error.message)));
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
    if (err.message && (err.message.includes('405') || err.message.includes('data-spm'))) {
      wafCookie = '';
    }
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
