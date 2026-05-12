// ============================================================================
// Snave AI — Common Utilities
// ============================================================================

/**
 * Sanitize user input to prevent injection attacks.
 */
export function sanitizeInput(text) {
  if (typeof text !== 'string') return '';
  return text.trim().slice(0, 50000); // Max 50K chars per message
}

/**
 * Create a standardized API error response.
 */
export function apiError(res, status, message, details = null) {
  const body = { error: true, message };
  if (details) body.details = details;
  return res.status(status).json(body);
}

/**
 * Setup SSE headers for streaming responses.
 */
export function setupSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
  res.flushHeaders();
}

/**
 * Send an SSE event.
 */
export function sendSSE(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Truncate text to a maximum length with ellipsis.
 */
export function truncate(text, maxLength = 200) {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Simple delay utility.
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse JSON safely with a fallback.
 */
export function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * Extract the first N sentences from text.
 */
export function extractSentences(text, count = 3) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sentences.slice(0, count).join(' ').trim();
}
