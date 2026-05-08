// ============================================================================
// Snave AI — File Handler (Upload + Parse)
// ============================================================================

const FileHandler = (() => {
  let attachedFiles = [];

  function init() {
    const fileInput = document.getElementById('file-input');
    // Attach is now handled from plus menu (menu-attach) in app.js
    // But also support legacy attach-file-btn if present
    const attachBtn = document.getElementById('attach-file-btn');
    if (attachBtn) attachBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      files.forEach(addFile);
      fileInput.value = '';
    });

    // Drag and drop on chat area
    const chatArea = document.getElementById('chat-area');
    chatArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      chatArea.style.border = '2px dashed var(--accent-primary)';
    });
    chatArea.addEventListener('dragleave', () => {
      chatArea.style.border = '';
    });
    chatArea.addEventListener('drop', (e) => {
      e.preventDefault();
      chatArea.style.border = '';
      Array.from(e.dataTransfer.files).forEach(addFile);
    });
  }

  function addFile(file) {
    if (attachedFiles.length >= 5) {
      showToast('Maximum 5 files allowed', 'error');
      return;
    }

    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast(`File too large: ${file.name} (max 20MB)`, 'error');
      return;
    }

    attachedFiles.push(file);
    renderPreviews();
  }

  function removeFile(index) {
    attachedFiles.splice(index, 1);
    renderPreviews();
  }

  function renderPreviews() {
    const area = document.getElementById('file-preview-area');
    area.innerHTML = attachedFiles.map((f, i) => `
      <div class="file-preview-item">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        ${escapeHtml(f.name)} (${formatSize(f.size)})
        <span class="remove-file" onclick="FileHandler.removeFile(${i})">✕</span>
      </div>
    `).join('');
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  }

  function getAttachedFiles() {
    return [...attachedFiles];
  }

  async function analyzeWithMessage(message, files) {
    Chat.addMessage('assistant', 'Analyzing files...');

    try {
      for (const file of files) {
        const ext = file.name.split('.').pop().toLowerCase();

        if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
          // Upload image directly to server
          const formData = new FormData();
          formData.append('file', file);
          formData.append('prompt', message);

          const response = await fetch(`${API_BASE}/files/upload`, {
            method: 'POST',
            body: formData
          });
          const data = await response.json();

          // Remove "analyzing" message
          removeLastAiMessage();

          if (data.success) {
            Chat.addMessage('assistant', data.analysis);
          } else {
            Chat.addMessage('assistant', `Error: ${data.message}`);
          }
        } else if (ext === 'pdf') {
          // Parse PDF client-side with PDF.js
          await parsePDF(file, message);
        } else if (['docx', 'doc'].includes(ext)) {
          // Parse DOCX client-side with Mammoth
          await parseDOCX(file, message);
        } else if (ext === 'txt') {
          const text = await file.text();
          await analyzeText(text, message, file.name);
        }
      }
    } catch (error) {
      removeLastAiMessage();
      Chat.addMessage('assistant', `File analysis failed: ${error.message}`);
    }

    // Clear attached files
    attachedFiles = [];
    renderPreviews();
  }

  async function parsePDF(file, prompt) {
    // Lazy-load PDF.js
    if (!window.pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.min.mjs';
      script.type = 'module';
      document.head.appendChild(script);

      // Use a simple alternative: read PDF as arraybuffer and send to server
      const formData = new FormData();
      formData.append('file', file);
      formData.append('prompt', prompt);

      const response = await fetch(`${API_BASE}/files/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      removeLastAiMessage();
      Chat.addMessage('assistant', data.success ? data.analysis : `Error: ${data.message}`);
      return;
    }
  }

  async function parseDOCX(file, prompt) {
    // Lazy-load Mammoth.js
    if (!window.mammoth) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mammoth@1/mammoth.browser.min.js';
      document.head.appendChild(script);
      await new Promise(r => { script.onload = r; });
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      await analyzeText(result.value, prompt, file.name);
    } catch (e) {
      // Fallback to server
      const formData = new FormData();
      formData.append('file', file);
      formData.append('prompt', prompt);
      const response = await fetch(`${API_BASE}/files/upload`, { method: 'POST', body: formData });
      const data = await response.json();
      removeLastAiMessage();
      Chat.addMessage('assistant', data.success ? data.analysis : `Error: ${data.message}`);
    }
  }

  async function analyzeText(text, prompt, filename) {
    // Send extracted text + prompt to chat endpoint
    const fullMessage = `[File: ${filename}]\n\nContent:\n${text.slice(0, 10000)}\n\nUser question: ${prompt}`;

    removeLastAiMessage();

    // Use the regular chat stream with the document content
    const stream = await streamFetch('/chat', {
      message: fullMessage,
      conversationId: App.getConversationId(),
      personality: 'professional'
    });

    let streamedText = '';
    let streamEl = null;

    stream
      .on('info', (data) => {
        if (!App.getConversationId()) App.setConversationId(data.conversationId);
      })
      .on('chunk', (data) => {
        if (!streamEl) {
          const container = document.getElementById('messages-container');
          streamEl = document.createElement('div');
          streamEl.className = 'message ai-message';
          streamEl.innerHTML = `
            <div class="message-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z"/><circle cx="12" cy="15" r="2"/></svg></div>
            <div class="message-body"><div class="message-content"></div></div>
          `;
          container.appendChild(streamEl);
        }
        streamedText += data.text;
        streamEl.querySelector('.message-content').innerHTML = MarkdownRenderer.render(streamedText);
        Chat.scrollToBottom();
      })
      .on('done', () => { /* complete */ });
  }

  function removeLastAiMessage() {
    const messages = document.querySelectorAll('.message.ai-message');
    const last = messages[messages.length - 1];
    if (last) last.remove();
  }

  // Expose removeFile globally for onclick handlers
  window.FileHandler = { removeFile };

  return { init, getAttachedFiles, analyzeWithMessage, removeFile };
})();
