// ============================================================================
// Snave AI — Markdown Renderer
// ============================================================================

const MarkdownRenderer = (() => {
  let initialized = false;

  function init() {
    if (initialized || typeof marked === 'undefined') return;
    
    marked.setOptions({
      breaks: true,
      gfm: true,
      headerIds: false,
      mangle: false
    });
    initialized = true;
  }

  /**
   * Render markdown to HTML with code highlighting and copy buttons.
   */
  function render(text) {
    init();
    if (!text) return '';

    let html;
    try {
      html = marked.parse(text);
    } catch {
      html = escapeHtml(text);
    }

    // Add copy buttons to code blocks
    html = html.replace(/<pre><code(?: class="language-(\w+)")?>([\s\S]*?)<\/code><\/pre>/g, 
      (match, lang, code) => {
        const language = lang || 'text';
        const decoded = code
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"');
        
        let highlighted;
        try {
          if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
            highlighted = hljs.highlight(decoded, { language: lang }).value;
          } else {
            highlighted = code;
          }
        } catch {
          highlighted = code;
        }

        return `<div class="code-block-header"><span>${language}</span><button class="copy-code-btn" onclick="copyCode(this)">📋 Copy</button></div><pre><code class="language-${language}">${highlighted}</code></pre>`;
      }
    );

    return html;
  }

  return { init, render };
})();

/**
 * Copy code block content to clipboard.
 */
function copyCode(btn) {
  const codeBlock = btn.closest('.code-block-header')?.nextElementSibling?.querySelector('code');
  if (!codeBlock) return;
  
  const text = codeBlock.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = '✅ Copied!';
    setTimeout(() => btn.textContent = original, 2000);
  });
}
