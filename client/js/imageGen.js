// ============================================================================
// OmniMind AI — Image Generation (Client-Side)
// ============================================================================

const ImageGen = (() => {
  function init() {
    // Image generation is triggered from chat when mode is "image"
  }

  async function generate(prompt) {
    Chat.addMessage('assistant', '🎨 Generating image... This may take a moment.');

    try {
      const data = await apiFetch('/images/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt, enhance: true })
      });

      if (data.success && data.image) {
        // Remove the "generating" message
        const messages = document.querySelectorAll('.message.ai-message');
        const lastMsg = messages[messages.length - 1];
        if (lastMsg) lastMsg.remove();

        // Show the generated image
        const container = document.getElementById('messages-container');
        const msgEl = document.createElement('div');
        msgEl.className = 'message ai-message';
        msgEl.innerHTML = `
          <div class="message-avatar">🧠</div>
          <div class="message-body">
            <div class="message-content">
              <p>Here's your generated image:</p>
              <img src="${data.image}" class="message-image" alt="Generated image" onclick="window.open(this.src)">
              ${data.enhancedPrompt !== prompt ? `<p style="font-size:0.8rem;color:var(--text-tertiary);margin-top:8px"><strong>Enhanced prompt:</strong> ${escapeHtml(data.enhancedPrompt)}</p>` : ''}
              <div style="margin-top:12px">
                <a href="${data.image}" download="omnimind-generated.png" class="btn btn-primary" style="text-decoration:none;font-size:0.8rem">⬇️ Download Image</a>
              </div>
            </div>
          </div>
        `;
        container.appendChild(msgEl);
        Chat.scrollToBottom();
      } else {
        throw new Error('No image returned');
      }
    } catch (error) {
      // Remove the "generating" message
      const messages = document.querySelectorAll('.message.ai-message');
      const lastMsg = messages[messages.length - 1];
      if (lastMsg) lastMsg.remove();

      Chat.addMessage('assistant', `⚠️ Image generation failed: ${error.message}\n\nMake sure your HuggingFace token is configured in Settings.`);
    }
  }

  return { init, generate };
})();
