// ============================================================================
// Snave AI — Main Application Controller
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

    // Plus menu toggle
    const plusBtn = document.getElementById('plus-menu-btn');
    const plusMenu = document.getElementById('plus-menu');

    if (plusBtn && plusMenu) {
      plusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = plusMenu.classList.contains('visible');
        togglePlusMenu(!isOpen);
      });

      // Close menu when clicking outside
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.plus-menu-wrapper')) {
          togglePlusMenu(false);
        }
      });

      // Menu item: Add photos & files
      document.getElementById('menu-attach')?.addEventListener('click', () => {
        document.getElementById('file-input').click();
        togglePlusMenu(false);
      });

      // Menu items: mode switches
      document.querySelectorAll('.plus-menu-item[data-mode]').forEach(item => {
        item.addEventListener('click', () => {
          const mode = item.dataset.mode;
          if (currentMode === mode) {
            // Toggle off — go back to chat
            setMode('chat');
          } else {
            setMode(mode);
          }
          togglePlusMenu(false);
        });
      });
    }

    // Quick action chips
    document.querySelectorAll('.input-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.dataset.prompt;
        if (prompt) {
          document.getElementById('chat-input').value = prompt;
          Chat.sendMessage();
        }
      });
    });

    // Agent mode toggle
    document.getElementById('agent-toggle').addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-icon') || e.target;
      btn.classList.toggle('active');
      const isActive = btn.classList.contains('active');
      btn.style.background = isActive ? 'var(--accent-primary)' : '';
      btn.style.color = isActive ? 'white' : '';
      showToast(isActive ? 'Agent Mode ON — AI will auto-detect tools' : 'Agent Mode OFF', 'info');
    });

    // Settings
    document.getElementById('settings-btn').addEventListener('click', () => openModal('settings-modal'));
    document.getElementById('save-settings-btn').addEventListener('click', saveSettings);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'n') { e.preventDefault(); newChat(); }
        if (e.key === 'b') { e.preventDefault(); document.getElementById('toggle-sidebar').click(); }
      }
      // Escape to close plus menu
      if (e.key === 'Escape') togglePlusMenu(false);
    });

    updateModeIndicator();
    console.log('Snave AI initialized');
  }

  function togglePlusMenu(show) {
    const plusBtn = document.getElementById('plus-menu-btn');
    const plusMenu = document.getElementById('plus-menu');
    if (!plusBtn || !plusMenu) return;

    if (show) {
      plusMenu.classList.add('visible');
      plusBtn.classList.add('active');
      // Highlight active mode in menu
      plusMenu.querySelectorAll('.plus-menu-item[data-mode]').forEach(item => {
        item.classList.toggle('mode-active', item.dataset.mode === currentMode && currentMode !== 'chat');
      });
    } else {
      plusMenu.classList.remove('visible');
      plusBtn.classList.remove('active');
    }
  }

  function setMode(mode) {
    currentMode = mode;

    // Show/hide code panel
    if (mode === 'code') {
      CodeInterpreter.show();
    } else {
      CodeInterpreter.hide();
    }

    // Show/hide mode badge in input area
    updateModeBadge();
    updateModeIndicator();

    // Hide chips when not in welcome state
    const chips = document.getElementById('input-chips');
    if (chips && mode !== 'chat') {
      chips.style.display = 'none';
    }
  }

  function updateModeBadge() {
    // Remove existing badge
    const existing = document.querySelector('.active-mode-badge');
    if (existing) existing.remove();

    if (currentMode === 'chat') return;

    const labels = {
      research: 'Deep Research',
      code: 'Code Interpreter',
      image: 'Create Image'
    };
    const label = labels[currentMode];
    if (!label) return;

    const badge = document.createElement('div');
    badge.className = 'active-mode-badge';
    badge.innerHTML = `
      <span>${label}</span>
      <span class="badge-close" title="Switch back to Chat">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </span>
    `;
    badge.querySelector('.badge-close').addEventListener('click', () => setMode('chat'));

    // Insert badge before the input container
    const wrapper = document.querySelector('.input-wrapper');
    const container = document.querySelector('.input-container');
    if (wrapper && container) {
      wrapper.insertBefore(badge, container);
    }
  }

  function updateModeIndicator() {
    const indicators = {
      chat: 'Chat Mode',
      research: 'Deep Research Mode',
      code: 'Code Interpreter',
      image: 'Image Generation'
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

    // Show chips again
    const chips = document.getElementById('input-chips');
    if (chips) chips.style.display = '';
  }

  async function loadConversation(id) {
    currentConversationId = id;
    Sidebar.setActive(id);
    Sidebar.collapse();
    setMode('chat');
    await Chat.loadMessages(id);

    // Hide chips when loading conversation
    const chips = document.getElementById('input-chips');
    if (chips) chips.style.display = 'none';
  }

  function saveSettings() {
    showToast('API keys must be set in server/.env file. See README for setup instructions.', 'info', 5000);
    closeModal('settings-modal');
  }

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', init);

  return { init, setMode, getMode, getConversationId, setConversationId, newChat, loadConversation };
})();
