// ============================================================================
// Snave AI — AI Orchestrator
// ============================================================================
// The brain of Snave — decides which models/tools to use for each request.
// Routes tasks to appropriate services and manages context.
// ============================================================================

import * as gemini from './gemini.js';
import * as huggingface from './huggingface.js';
import * as search from './search.js';
import { PERSONALITIES, TOOL_DECISION_PROMPT, RESEARCH_SYSTEM_PROMPT } from '../utils/prompts.js';
import { getRecentMessages, searchMemories } from '../db/database.js';

/**
 * Detect the type of task the user is requesting.
 * Uses heuristics first, then AI-based decision if ambiguous.
 */
export async function detectTask(message) {
  const lower = message.toLowerCase();

  // ── Heuristic detection (fast, no API call) ────────────────────────────

  // Image generation keywords
  if (/\b(generate|create|draw|make|paint|design)\s+(an?\s+)?(image|picture|photo|illustration|art|logo|icon|poster|banner)/i.test(lower)) {
    return { tool: 'image', reasoning: 'User explicitly requested image generation' };
  }

  // Code execution keywords
  if (/\b(run|execute|code|python|script|calculate|compute|plot|chart|graph|dataframe|pandas|numpy)\b/i.test(lower) &&
      /\b(run|execute|write|create|build|make|show|plot)\b/i.test(lower)) {
    return { tool: 'code', reasoning: 'User wants to run or write code' };
  }

  // Research keywords
  if (/\b(research|search|find|look\s+up|what\s+is|latest|current|news|recent|2024|2025|2026)\b/i.test(lower) &&
      lower.length > 30) {
    return { tool: 'research', reasoning: 'User is asking about current/factual information' };
  }

  // Default to chat
  return { tool: 'chat', reasoning: 'General conversation' };
}

/**
 * Get the system prompt for the current personality + any relevant memories.
 */
export async function buildSystemPrompt(personality = 'professional', conversationId = null) {
  const persona = PERSONALITIES[personality] || PERSONALITIES.professional;
  let systemPrompt = persona.system;

  // Inject relevant memories if available
  try {
    const memories = searchMemories('');
    if (memories.length > 0) {
      const memoryContext = memories
        .slice(0, 10)
        .map(m => `- [${m.category}] ${m.content}`)
        .join('\n');
      systemPrompt += `\n\nUser Memory (things you know about this user):\n${memoryContext}`;
    }
  } catch (e) {
    // Memories not critical — continue without
  }

  return systemPrompt;
}

/**
 * Get conversation context (recent messages) for the AI.
 */
export function getConversationContext(conversationId, maxMessages = 20) {
  try {
    return getRecentMessages(conversationId, maxMessages);
  } catch {
    return [];
  }
}

/**
 * Handle a standard chat request with streaming.
 */
export async function handleChat(conversationId, message, personality, onChunk, onDone, onError) {
  const systemPrompt = await buildSystemPrompt(personality, conversationId);
  const history = getConversationContext(conversationId);

  // Try Gemini first
  if (gemini.isGeminiAvailable()) {
    await gemini.streamChat(systemPrompt, history, message, onChunk, onDone, onError);
  } else if (huggingface.isHFAvailable()) {
    // Fallback to HuggingFace (non-streaming)
    try {
      const contextStr = history
        .slice(-6)
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');
      const prompt = `${systemPrompt}\n\n${contextStr}\nuser: ${message}\nassistant:`;
      const response = await huggingface.generateText(prompt);
      onChunk(response);
      onDone(response);
    } catch (error) {
      onError(error);
    }
  } else {
    onError(new Error('No AI service available. Please configure your API keys in .env'));
  }
}

/**
 * Handle a deep research request with streaming.
 */
export async function handleResearch(query, onProgress, onChunk, onDone, onError) {
  try {
    // Step 1: Notify — searching
    onProgress({ stage: 'searching', message: 'Searching the web...' });

    // Generate better search queries using Gemini
    let searchQueries = [query];
    if (gemini.isGeminiAvailable()) {
      try {
        const queryResult = await gemini.generateContent(
          `Generate 3 different search queries to research this topic. Return ONLY the queries, one per line, no numbering:\n\n"${query}"`
        );
        const generated = queryResult.split('\n').filter(q => q.trim().length > 5);
        if (generated.length > 0) searchQueries = generated.slice(0, 3);
      } catch {
        // Use original query as fallback
      }
    }

    // Step 2: Execute searches
    onProgress({ stage: 'reading', message: `Searching ${searchQueries.length} queries...` });

    const allSources = [];
    for (const sq of searchQueries) {
      const results = await search.deepResearch(sq, 3);
      allSources.push(...results.sources);
    }

    // Deduplicate by URL
    const uniqueSources = allSources.filter(
      (s, i, arr) => arr.findIndex(x => x.url === s.url) === i
    );

    if (uniqueSources.length === 0) {
      onChunk('I couldn\'t find any relevant sources for this query. Please try rephrasing your question.');
      onDone('No results found.');
      return;
    }

    // Step 3: Synthesize with Gemini
    onProgress({ stage: 'analyzing', message: `Analyzing ${uniqueSources.length} sources...` });

    const sourcesContext = uniqueSources.map((s, i) => (
      `[Source ${i + 1}] ${s.title}\nURL: ${s.url}\nContent: ${s.content.slice(0, 2000)}\n`
    )).join('\n---\n');

    const researchPrompt = `Based on the following web search results, provide a comprehensive research report about: "${query}"

${sourcesContext}

Instructions:
- Synthesize information from multiple sources
- Use [1], [2], etc. to cite sources inline
- Structure with clear headings
- Highlight key findings
- Note any conflicting information
- End with a Sources section listing all URLs`;

    if (gemini.isGeminiAvailable()) {
      onProgress({ stage: 'writing', message: 'Writing research report...' });
      
      await gemini.streamChat(
        RESEARCH_SYSTEM_PROMPT,
        [],
        researchPrompt,
        onChunk,
        (fullText) => {
          // Append sources list
          const sourcesList = uniqueSources
            .map((s, i) => `[${i + 1}] [${s.title}](${s.url})`)
            .join('\n');
          onDone(fullText, sourcesList);
        },
        onError
      );
    } else {
      // No Gemini — return raw results
      const rawReport = uniqueSources
        .map((s, i) => `### Source ${i + 1}: ${s.title}\n${s.snippet}\n[Link](${s.url})\n`)
        .join('\n');
      onChunk(rawReport);
      onDone(rawReport);
    }
  } catch (error) {
    onError(error);
  }
}

export default {
  detectTask,
  buildSystemPrompt,
  getConversationContext,
  handleChat,
  handleResearch
};
