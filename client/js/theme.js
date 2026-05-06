// ============================================================================
// OmniMind AI — Theme Manager
// ============================================================================

const ThemeManager = (() => {
  let currentTheme = localStorage.getItem('omnimind-theme') || 'dark';

  function init() {
    apply(currentTheme);
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        apply(currentTheme);
      });
    }
  }

  function apply(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('omnimind-theme', theme);
    
    const toggle = document.getElementById('theme-toggle');
    if (toggle) toggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  return { init, apply, get: () => currentTheme };
})();
