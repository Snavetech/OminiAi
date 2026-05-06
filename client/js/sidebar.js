// ============================================================================
// OmniMind AI — Sidebar Controller
// ============================================================================

const Sidebar = (() => {
  let conversations = [];
  let activeId = null;

  function init() {
    document.getElementById('toggle-sidebar').addEventListener('click', toggle);
    document.getElementById('sidebar-overlay').addEventListener('click', collapse);
    document.getElementById('new-chat-btn').addEventListener('click', () => App.newChat());
    document.getElementById('search-chats').addEventListener('input', debounce(handleSearch, 200));
    loadConversations();
  }

  function toggle() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('collapsed');
    overlay.classList.toggle('visible', !sidebar.classList.contains('collapsed'));
  }

  function collapse() {
    document.getElementById('sidebar').classList.add('collapsed');
    document.getElementById('sidebar-overlay').classList.remove('visible');
  }

  async function loadConversations() {
    try {
      const data = await apiFetch('/conversations');
      conversations = data.conversations || [];
      renderList(conversations);
    } catch (e) {
      console.warn('Could not load conversations:', e.message);
    }
  }

  function renderList(list) {
    const container = document.getElementById('chat-list');
    if (list.length === 0) {
      container.innerHTML = `<p style="text-align:center;color:var(--text-tertiary);padding:24px;font-size:0.85rem">No conversations yet</p>`;
      return;
    }
    container.innerHTML = list.map(conv => `
      <div class="chat-list-item ${conv.id === activeId ? 'active' : ''}" data-id="${conv.id}">
        <span class="chat-icon">💬</span>
        <span class="chat-title">${escapeHtml(conv.title)}</span>
        <span class="chat-date">${formatRelativeDate(conv.updated_at || conv.created_at)}</span>
        <button class="delete-chat-btn" data-delete="${conv.id}" title="Delete">🗑</button>
      </div>
    `).join('');

    // Event listeners
    container.querySelectorAll('.chat-list-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.delete-chat-btn')) return;
        App.loadConversation(el.dataset.id);
      });
    });
    container.querySelectorAll('.delete-chat-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.delete;
        if (confirm('Delete this conversation?')) {
          await apiFetch(`/conversations/${id}`, { method: 'DELETE' });
          if (id === activeId) App.newChat();
          loadConversations();
        }
      });
    });
  }

  function setActive(id) {
    activeId = id;
    document.querySelectorAll('.chat-list-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === id);
    });
  }

  function updateTitle(id, title) {
    const item = document.querySelector(`.chat-list-item[data-id="${id}"] .chat-title`);
    if (item) item.textContent = title;
  }

  function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    const filtered = query ? conversations.filter(c => c.title.toLowerCase().includes(query)) : conversations;
    renderList(filtered);
  }

  return { init, loadConversations, setActive, updateTitle, collapse };
})();
