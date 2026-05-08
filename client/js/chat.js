// ============================================================================
// OmniMind AI — Chat Controller
// ============================================================================

const Chat = (() => {
  let isStreaming = false;
  let currentStreamEl = null;
  let streamedText = '';

  function init() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');

    // Auto-resize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 200) + 'px';
      sendBtn.disabled = !input.value.trim() || isStreaming;
    });

    // Send on Enter (Shift+Enter for newline)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!isStreaming && input.value.trim()) sendMessage();
      }
    });

    sendBtn.addEventListener('click', () => {
      if (!isStreaming && input.value.trim()) sendMessage();
    });

    // Welcome card clicks
    document.querySelectorAll('.welcome-card').forEach(card => {
      card.addEventListener('click', () => {
        const prompt = card.dataset.prompt;
        if (prompt) {
          document.getElementById('chat-input').value = prompt;
          sendMessage();
        }
      });
    });
  }

  async function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    // Hide welcome screen
    const welcome = document.getElementById('welcome-screen');
    if (welcome) welcome.style.display = 'none';

    // Get current mode
    const mode = App.getMode();
    const personality = document.getElementById('personality-selector').value;
    const agentMode = document.getElementById('agent-toggle').classList.contains('active');

    // Check if files are attached
    const attachedFiles = FileHandler.getAttachedFiles();

    // Clear input
    input.value = '';
    input.style.height = 'auto';
    document.getElementById('send-btn').disabled = true;

    // Render user message
    addMessage('user', message, attachedFiles.length > 0 ? { files: attachedFiles.map(f => f.name) } : null);

    // Handle based on mode
    if (mode === 'image') {
      await ImageGen.generate(message);
    } else if (mode === 'research') {
      await streamResearch(message);
    } else if (attachedFiles.length > 0) {
      await FileHandler.analyzeWithMessage(message, attachedFiles);
    } else {
      await streamChat(message, personality, agentMode);
    }
  }

  async function streamChat(message, personality, agentMode) {
    isStreaming = true;
    addTypingIndicator();

    try {
      const stream = await streamFetch('/chat', {
        message,
        conversationId: App.getConversationId(),
        personality,
        agentMode
      });

      stream
        .on('info', (data) => {
          if (!App.getConversationId()) {
            App.setConversationId(data.conversationId);
          }
          if (data.task && data.task.tool !== 'chat') {
            showToolBadge(data.task);
          }
        })
        .on('progress', (data) => {
          removeTypingIndicator();
          showResearchProgress(data);
        })
        .on('chunk', (data) => {
          hideResearchProgress();
          removeTypingIndicator();
          appendToStream(data.text);
        })
        .on('title', (data) => {
          Sidebar.updateTitle(App.getConversationId(), data.title);
          Sidebar.loadConversations();
        })
        .on('done', () => {
          finalizeStream();
          isStreaming = false;
        })
        .on('error', (data) => {
          removeTypingIndicator();
          if (data && data.message) {
            addMessage('assistant', `⚠️ Error: ${data.message}`);
          }
          isStreaming = false;
        })
        .on('end', () => {
          if (isStreaming) {
            finalizeStream();
            isStreaming = false;
          }
        });
    } catch (error) {
      removeTypingIndicator();
      addMessage('assistant', `⚠️ Connection error: ${error.message}`);
      isStreaming = false;
    }
  }

  async function streamResearch(query) {
    isStreaming = true;
    addTypingIndicator();

    try {
      const stream = await streamFetch('/research/research', {
        query,
        conversationId: App.getConversationId()
      });

      stream
        .on('info', (data) => {
          if (!App.getConversationId()) {
            App.setConversationId(data.conversationId);
          }
        })
        .on('progress', (data) => {
          removeTypingIndicator();
          showResearchProgress(data);
        })
        .on('chunk', (data) => {
          hideResearchProgress();
          appendToStream(data.text);
        })
        .on('title', (data) => {
          Sidebar.updateTitle(App.getConversationId(), data.title);
          Sidebar.loadConversations();
        })
        .on('done', () => {
          finalizeStream();
          isStreaming = false;
        })
        .on('error', (data) => {
          hideResearchProgress();
          removeTypingIndicator();
          addMessage('assistant', `⚠️ Research error: ${data?.message || 'Unknown error'}`);
          isStreaming = false;
        })
        .on('end', () => {
          if (isStreaming) {
            finalizeStream();
            isStreaming = false;
          }
        });
    } catch (error) {
      removeTypingIndicator();
      addMessage('assistant', `⚠️ Connection error: ${error.message}`);
      isStreaming = false;
    }
  }

  // ─── Message Rendering ──────────────────────────────────────────────

  function addMessage(role, content, metadata = null) {
    const container = document.getElementById('messages-container');
    const isUser = role === 'user';

    const msgEl = document.createElement('div');
    msgEl.className = `message ${isUser ? 'user-message' : 'ai-message'}`;

    let filesHtml = '';
    if (metadata?.files) {
      filesHtml = metadata.files.map(f => `<div class="file-badge">📄 ${escapeHtml(f)}</div>`).join('');
    }

    let contentHtml;
    if (isUser) {
      contentHtml = `<p>${escapeHtml(content)}</p>${filesHtml}`;
    } else {
      contentHtml = MarkdownRenderer.render(content);
    }

    msgEl.innerHTML = `
      <div class="message-avatar">${isUser ? '👤' : '🧠'}</div>
      <div class="message-body">
        <div class="message-content">${contentHtml}</div>
      </div>
    `;

    container.appendChild(msgEl);
    scrollToBottom();
  }

  function addTypingIndicator() {
    const container = document.getElementById('messages-container');
    const el = document.createElement('div');
    el.className = 'message ai-message';
    el.id = 'typing-indicator';
    el.innerHTML = `
      <div class="message-avatar">🧠</div>
      <div class="message-body">
        <div class="typing-dots"><span></span><span></span><span></span></div>
      </div>
    `;
    container.appendChild(el);
    scrollToBottom();
  }

  function removeTypingIndicator() {
    document.getElementById('typing-indicator')?.remove();
  }

  function appendToStream(text) {
    if (!currentStreamEl) {
      const container = document.getElementById('messages-container');
      currentStreamEl = document.createElement('div');
      currentStreamEl.className = 'message ai-message';
      currentStreamEl.innerHTML = `
        <div class="message-avatar">🧠</div>
        <div class="message-body">
          <div class="message-content" id="stream-content"></div>
        </div>
      `;
      container.appendChild(currentStreamEl);
      streamedText = '';
    }

    streamedText += text;
    const contentEl = currentStreamEl.querySelector('#stream-content');
    if (contentEl) {
      contentEl.innerHTML = MarkdownRenderer.render(streamedText);
    }
    scrollToBottom();
  }

  function finalizeStream() {
    if (currentStreamEl) {
      const contentEl = currentStreamEl.querySelector('#stream-content');
      if (contentEl) {
        contentEl.removeAttribute('id');
        contentEl.innerHTML = MarkdownRenderer.render(streamedText);
      }
    }
    currentStreamEl = null;
    streamedText = '';
    document.getElementById('send-btn').disabled = false;
  }

  function showToolBadge(task) {
    const icons = { research: '🔬', code: '💻', image: '🎨' };
    const container = document.getElementById('messages-container');
    const badge = document.createElement('div');
    badge.className = 'research-progress';
    badge.innerHTML = `${icons[task.tool] || '🤖'} Agent decided: ${task.reasoning}`;
    container.appendChild(badge);
    setTimeout(() => badge.remove(), 5000);
  }

  function showResearchProgress(data) {
    let el = document.getElementById('research-progress-indicator');
    if (!el) {
      const container = document.getElementById('messages-container');
      el = document.createElement('div');
      el.id = 'research-progress-indicator';
      el.className = 'research-progress';
      container.appendChild(el);
    }
    const stageIcons = { searching: '🔍', reading: '📖', analyzing: '🧠', writing: '✍️' };
    el.innerHTML = `<div class="spinner"></div> ${stageIcons[data.stage] || '⏳'} ${data.message}`;
    scrollToBottom();
  }

  function hideResearchProgress() {
    document.getElementById('research-progress-indicator')?.remove();
  }

  function clearMessages() {
    const container = document.getElementById('messages-container');
    container.innerHTML = '';
    const welcome = document.getElementById('welcome-screen');
    if (!welcome) {
      container.innerHTML = `
        <div class="welcome-screen" id="welcome-screen">
          <div class="welcome-logo">🧠</div>
          <h1 class="welcome-title">OmniMind AI</h1>
          <p class="welcome-subtitle">Your all-in-one AI assistant. Chat, research, code, create — all in one place.</p>
          <div class="welcome-cards">
            <div class="welcome-card" data-prompt="Explain quantum computing in simple terms">
              <div class="card-icon">💡</div>
              <div class="card-text">Explain a complex topic simply</div>
            </div>
            <div class="welcome-card" data-prompt="Research the latest breakthroughs in AI for 2026">
              <div class="card-icon">🔬</div>
              <div class="card-text">Deep research on any topic</div>
            </div>
            <div class="welcome-card" data-prompt="Write a Python script to analyze CSV data and create visualizations">
              <div class="card-icon">💻</div>
              <div class="card-text">Write & run code instantly</div>
            </div>
            <div class="welcome-card" data-prompt="Generate an image of a futuristic city at sunset with flying cars">
              <div class="card-icon">🎨</div>
              <div class="card-text">Generate stunning images</div>
            </div>
          </div>
        </div>
      `;
      // Re-attach click handlers
      container.querySelectorAll('.welcome-card').forEach(card => {
        card.addEventListener('click', () => {
          const prompt = card.dataset.prompt;
          if (prompt) {
            document.getElementById('chat-input').value = prompt;
            sendMessage();
          }
        });
      });
    }
    currentStreamEl = null;
    streamedText = '';
  }

  async function loadMessages(conversationId) {
    try {
      const data = await apiFetch(`/conversations/${conversationId}`);
      const container = document.getElementById('messages-container');
      container.innerHTML = '';

      const welcome = document.getElementById('welcome-screen');
      if (welcome) welcome.style.display = 'none';

      if (data.messages) {
        data.messages.forEach(msg => {
          addMessage(msg.role, msg.content);
        });
      }
    } catch (error) {
      showToast('Failed to load conversation', 'error');
    }
  }

  function scrollToBottom() {
    const area = document.getElementById('chat-area');
    requestAnimationFrame(() => {
      area.scrollTop = area.scrollHeight;
    });
  }

  return { init, sendMessage, addMessage, clearMessages, loadMessages, scrollToBottom };
})();
