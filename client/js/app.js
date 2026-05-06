// ============================================================================
// OmniMind AI — Main Application Controller
// ============================================================================

const App = (() => {
  let currentConversationId = null;
  let currentMode = 'chat';

  function init() {
    // Initialize all modules
    ThemeManager.init();
    MarkdownRenderer.init();
    Sidebar.init();
    Chat.init();
    Research.init();
    CodeInterpreter.init();
    ImageGen.init();
    FileHandler.init();
    Memory.init();

    // Mode toggles
    document.querySelectorAll('.mode-toggle').forEach(btn => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    // Agent mode toggle
    document.getElementById('agent-toggle').addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const isActive = e.target.classList.contains('active');
      e.target.style.background = isActive ? 'var(--accent-primary)' : '';
      e.target.style.color = isActive ? 'white' : '';
      showToast(isActive ? 'Agent Mode ON — AI will auto-detect tools' : 'Agent Mode OFF', 'info');
    });

    // Settings
    document.getElementById('settings-btn').addEventListener('click', () => openModal('settings-modal'));
    document.getElementById('save-settings-btn').addEventListener('click', saveSettings);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'n') { e.preventDefault(); newChat(); }
        if (e.key === 'b') { e.preventDefault(); Sidebar.init(); document.getElementById('toggle-sidebar').click(); }
      }
    });

    updateModeIndicator();
    console.log('🧠 OmniMind AI initialized');
  }

  function setMode(mode) {
    currentMode = mode;

    // Update toggle buttons
    document.querySelectorAll('.mode-toggle').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Show/hide code panel
    if (mode === 'code') {
      CodeInterpreter.show();
    } else {
      CodeInterpreter.hide();
    }

    updateModeIndicator();
  }

  function updateModeIndicator() {
    const indicators = {
      chat: '💬 Chat Mode',
      research: '🔬 Deep Research Mode',
      code: '💻 Code Interpreter',
      image: '🎨 Image Generation'
    };
    const el = document.getElementById('mode-indicator');
    if (el) el.textContent = indicators[currentMode] || 'Chat Mode';
  }

  function getMode() { return currentMode; }

  function getConversationId() { return currentConversationId; }

  function setConversationId(id) {
    currentConversationId = id;
    Sidebar.setActive(id);
  }

  function newChat() {
    currentConversationId = null;
    Chat.clearMessages();
    Sidebar.setActive(null);
    setMode('chat');
    Sidebar.collapse();
    document.getElementById('chat-input').focus();
  }

  async function loadConversation(id) {
    currentConversationId = id;
    Sidebar.setActive(id);
    Sidebar.collapse();
    setMode('chat');
    await Chat.loadMessages(id);
  }

  function saveSettings() {
    // In a real app, these would update the server .env
    // For MVP, we show a toast explaining the setup
    showToast('API keys must be set in server/.env file. See README for setup instructions.', 'info', 5000);
    closeModal('settings-modal');
  }

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', init);

  return { init, setMode, getMode, getConversationId, setConversationId, newChat, loadConversation };
})();
