// ============================================================================
// OmniMind AI — Memory Management Service
// ============================================================================

import { addMemory, listMemories, searchMemories, deleteMemory } from '../db/database.js';
import * as gemini from './gemini.js';

/**
 * Auto-extract memorable information from a conversation exchange.
 */
export async function extractMemories(userMessage, assistantResponse) {
  if (!gemini.isGeminiAvailable()) return [];
  try {
    const result = await gemini.generateContent(
      `Analyze this exchange and extract important user facts/preferences to remember. Return a JSON array of {"category":"preference"|"fact"|"instruction","content":"..."} or empty array [].

User: ${userMessage.slice(0, 500)}
Assistant: ${assistantResponse.slice(0, 500)}

Return ONLY valid JSON array:`
    );
    const cleaned = result.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const memories = JSON.parse(cleaned);
    if (Array.isArray(memories)) {
      for (const m of memories) {
        if (m.content && m.category) {
          addMemory(m.category, m.content, 'auto-extracted');
        }
      }
      return memories;
    }
  } catch { /* Silent fail */ }
  return [];
}

export { addMemory, listMemories, searchMemories, deleteMemory };
export default { extractMemories, addMemory, listMemories, searchMemories, deleteMemory };
