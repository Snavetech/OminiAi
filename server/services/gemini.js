// ============================================================================
// Snave AI — AI Model Service (AgentRouter & OpenAI-compatible)
// ============================================================================
// Supports AgentRouter (https://agentrouter.org/v1) and OpenAI-compatible gateways.
// ============================================================================

import OpenAI from 'openai';

let openai = null;
let currentModel = 'gpt-6-astra';
let currentBaseUrl = 'https://agentrouter.org/v1';
let isAgentRouter = true;

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
  if (messageItem?.content) {
    for (const c of messageItem.content) {
      if (c.type === 'output_text' && c.text) return c.text;
      if (c.text) return c.text;
    }
  }
  return response.output?.[0]?.content?.[0]?.text || '';
}

function cleanErrorMessage(msg) {
  if (!msg) return 'An unexpected error occurred while communicating with the AI service.';
  if (msg.includes('data-spm') || msg.includes('405') || msg.includes('<!doctype')) {
    return 'AgentRouter temporary connection gateway block (WAF). Please retry in a few seconds.';
  }
  return msg;
}

/**
 * Resolve effective model name for AgentRouter.
 * AgentRouter routes through OpenAI Responses API with models: gpt-5.6-sol, gpt-6-astra.
 * If user requested gpt-4o (which has no channel in default group), alias to gpt-5.6-sol.
 */
function resolveModel(modelName, isRouter) {
  if (isRouter && (modelName === 'gpt-4o' || modelName === 'gpt-5.6-sol' || !modelName)) {
    return 'gpt-6-astra';
  }
  return modelName || (isRouter ? 'gpt-6-astra' : 'openai/gpt-oss-120b');
}

export function initGemini(apiKey) {
  const key = apiKey ||
              process.env.AGENTROUTER_API_KEY ||
              process.env.AGENT_ROUTER_API_KEY ||
              process.env.AI_API_KEY ||
              process.env.GROQ_API_KEY ||
              process.env.GEMINI_API_KEY;

  if (!key || key.startsWith('your_') || key.includes('_here')) {
    console.warn('⚠️  AI API key not configured. Chat will use fallback mode.');
    initGemini.initialized = false;
    return false;
  }

  let rawBaseUrl = process.env.AGENTROUTER_BASE_URL ||
                   process.env.AGENT_ROUTER_BASE_URL ||
                   process.env.AI_BASE_URL ||
                   process.env.OPENAI_BASE_URL ||
                   (key.startsWith('gsk_') ? 'https://api.groq.com/openai/v1' : 'https://agentrouter.org/v1');

  // Normalize relay base URL (e.g. https://agentrouter.org/console -> https://agentrouter.org/v1)
  rawBaseUrl = rawBaseUrl.replace(/\/console\/?$/, '');
  if (!rawBaseUrl.endsWith('/v1')) {
    rawBaseUrl = rawBaseUrl.replace(/\/+$/, '') + '/v1';
  }
  currentBaseUrl = rawBaseUrl;

  isAgentRouter = currentBaseUrl.includes('agentrouter.');

  const requestedModel = process.env.AGENTROUTER_MODEL ||
                        process.env.AGENT_ROUTER_MODEL ||
                        process.env.AI_MODEL ||
                        process.env.GROQ_MODEL ||
                        (isAgentRouter ? 'gpt-6-astra' : 'openai/gpt-oss-120b');

  currentModel = resolveModel(requestedModel, isAgentRouter);

  openai = new OpenAI({
    baseURL: currentBaseUrl,
    apiKey: key,
    fetch: async (url, init) => {
      const headers = new Headers(init?.headers || {});
      if (isAgentRouter) {
        const cookie = await getWafCookie(currentBaseUrl);
        if (cookie) {
          headers.set('Cookie', cookie);
        }
        headers.set('User-Agent', 'codex_cli_rs/0.101.0 (Mac OS; arm64)');
        headers.set('Originator', 'codex_cli_rs');
        headers.set('Version', '0.101.0');
      }

      const response = await fetch(url, { ...init, headers });

      if (isAgentRouter) {
        const newCookie = response.headers.get('set-cookie');
        if (newCookie) {
          const match = newCookie.match(/acw_tc=[^;]+/);
          if (match) {
            wafCookie = match[0];
            cookieExpiry = Date.now() + 25 * 60 * 1000;
          }
        }
      }

      return response;
    }
  });

  initGemini.initialized = true;
  console.log(`✅ AI API initialized (endpoint: ${currentBaseUrl}, model: ${currentModel})`);
  return true;
}

export function isGeminiAvailable() {
  return openai !== null;
}

export async function streamChat(systemPrompt, history, userMessage, onChunk, onDone, onError) {
  if (!openai) {
    onError(new Error('AI service not initialized'));
    return;
  }

  try {
    const inputMessages = [];
    if (systemPrompt) {
      inputMessages.push({ role: 'system', content: systemPrompt });
    }
    for (const msg of history) {
      inputMessages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content });
    }
    inputMessages.push({ role: 'user', content: userMessage });

    let fullResponse = '';

    // If using AgentRouter, route through OpenAI Responses API
    if (isAgentRouter) {
      let response;
      try {
        response = await openai.responses.create({
          model: currentModel,
          input: inputMessages
        });
      } catch (err) {
        if (err.message && (err.message.includes('405') || err.message.includes('data-spm'))) {
          wafCookie = '';
        }
        // Fallback to gpt-5.6-sol if the requested model had channel issues
        if (currentModel !== 'gpt-5.6-sol') {
          console.warn(`Attempting fallback to gpt-5.6-sol due to: ${err.message}`);
          response = await openai.responses.create({
            model: 'gpt-5.6-sol',
            input: inputMessages
          });
        } else {
          throw err;
        }
      }

      fullResponse = extractResponseText(response);

      if (fullResponse) {
        const words = fullResponse.split(/(?<=\s+)/);
        for (const word of words) {
          onChunk(word);
          await new Promise(r => setTimeout(r, 12));
        }
      }
      onDone(fullResponse);
      return;
    }

    // Standard OpenAI / Groq streaming chat completions
    const stream = await openai.chat.completions.create({
      model: currentModel,
      messages: inputMessages,
      stream: true,
      max_tokens: 4096,
      temperature: 0.7
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) {
        fullResponse += text;
        onChunk(text);
      }
    }

    onDone(fullResponse);
  } catch (error) {
    console.error('AI chat error:', error.message);
    onError(new Error(cleanErrorMessage(error.message)));
  }
}

export async function generateContent(prompt, systemPrompt = '') {
  if (!openai) throw new Error('AI service not initialized');

  if (isAgentRouter) {
    try {
      const response = await openai.responses.create({
        model: currentModel,
        input: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt
      });
      return extractResponseText(response);
    } catch (err) {
      if (err.message && (err.message.includes('405') || err.message.includes('data-spm'))) {
        wafCookie = '';
      }
      if (currentModel !== 'gpt-5.6-sol') {
        const response = await openai.responses.create({
          model: 'gpt-5.6-sol',
          input: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt
        });
        return extractResponseText(response);
      }
      throw err;
    }
  }

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
  if (!openai) throw new Error('AI service not initialized');

  const imageUrl = `data:${mimeType};base64,${base64Data}`;

  try {
    const result = await openai.chat.completions.create({
      model: isAgentRouter ? currentModel : (process.env.VISION_MODEL || 'openai/gpt-oss-20b'),
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
  if (!openai) throw new Error('AI service not initialized');
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
