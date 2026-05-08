// ============================================================================
// Snave AI — Client Utilities
// ============================================================================

const API_BASE = window.location.origin + '/api';

/**
 * Make a fetch request with error handling.
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options
  };
  const response = await fetch(url, config);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || `API error: ${response.status}`);
  }
  return response.json();
}

/**
 * Open an SSE stream and return an EventSource-like interface.
 */
function streamFetch(endpoint, body) {
  return new Promise((resolve) => {
    const handlers = {};
    
    fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(async response => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (handlers['end']) handlers['end']();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = 'message';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (handlers[currentEvent]) handlers[currentEvent](data);
            } catch (e) { /* skip malformed data */ }
          }
        }
      }
    }).catch(err => {
      if (handlers['error']) handlers['error'](err);
    });

    // Return an object that allows .on() chaining
    const stream = {
      on(event, handler) {
        handlers[event] = handler;
        return stream;
      }
    };
    resolve(stream);
  });
}

/**
 * Generate a UUID.
 */
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/**
 * Format a date relative to now.
 */
function formatRelativeDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString();
}

/**
 * Show a toast notification.
 */
function showToast(message, type = 'info', duration = 3000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Open/close modals.
 */
function openModal(id) {
  document.getElementById(id)?.classList.add('visible');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('visible');
}

/**
 * Debounce a function.
 */
function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Escape HTML to prevent XSS.
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
