// ============================================================================
// OmniMind AI — Memory Manager (Client-Side)
// ============================================================================

const Memory = (() => {
  function init() {
    document.getElementById('memory-btn').addEventListener('click', () => {
      openModal('memory-modal');
      loadMemories();
    });

    document.getElementById('add-memory-btn').addEventListener('click', addMemory);
    document.getElementById('memory-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addMemory();
    });
  }

  async function loadMemories() {
    try {
      const data = await apiFetch('/memory');
      renderMemories(data.memories || []);
    } catch (e) {
      console.warn('Could not load memories:', e.message);
    }
  }

  function renderMemories(memories) {
    const list = document.getElementById('memory-list');
    if (memories.length === 0) {
      list.innerHTML = '<p style="color:var(--text-tertiary);text-align:center;padding:24px">No memories saved yet. Memories are automatically extracted from conversations or you can add them manually.</p>';
      return;
    }

    list.innerHTML = memories.map(m => `
      <div class="memory-item">
        <span class="memory-category">${escapeHtml(m.category)}</span>
        <span class="memory-content">${escapeHtml(m.content)}</span>
        <span class="memory-delete" onclick="Memory.deleteMemory(${m.id})" title="Delete">🗑</span>
      </div>
    `).join('');
  }

  async function addMemory() {
    const input = document.getElementById('memory-input');
    const content = input.value.trim();
    if (!content) return;

    try {
      await apiFetch('/memory', {
        method: 'POST',
        body: JSON.stringify({ content, category: 'general' })
      });
      input.value = '';
      loadMemories();
      showToast('Memory saved!', 'success');
    } catch (e) {
      showToast('Failed to save memory', 'error');
    }
  }

  async function deleteMemory(id) {
    try {
      await apiFetch(`/memory/${id}`, { method: 'DELETE' });
      loadMemories();
    } catch (e) {
      showToast('Failed to delete memory', 'error');
    }
  }

  // Expose deleteMemory for onclick
  window.Memory = { deleteMemory };

  return { init, loadMemories, deleteMemory };
})();
