// ============================================================================
// OmniMind AI — Code Interpreter (Pyodide Integration)
// ============================================================================

const CodeInterpreter = (() => {
  let pyodide = null;
  let isLoading = false;
  let isRunning = false;

  function init() {
    document.getElementById('run-code-btn').addEventListener('click', runCode);
    document.getElementById('clear-output-btn').addEventListener('click', clearOutput);
    document.getElementById('close-code-panel').addEventListener('click', hide);

    // Tab key in editor
    document.getElementById('code-editor').addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = e.target;
        const start = ta.selectionStart;
        ta.value = ta.value.substring(0, start) + '    ' + ta.value.substring(ta.selectionEnd);
        ta.selectionStart = ta.selectionEnd = start + 4;
      }
      // Ctrl+Enter to run
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        runCode();
      }
    });
  }

  function show() {
    document.getElementById('code-panel').classList.add('active');
    document.getElementById('chat-area').style.display = 'none';
    document.getElementById('input-area').style.display = 'none';
    if (!pyodide && !isLoading) loadPyodide();
  }

  function hide() {
    document.getElementById('code-panel').classList.remove('active');
    document.getElementById('chat-area').style.display = '';
    document.getElementById('input-area').style.display = '';
    // Reset mode toggle
    App.setMode('chat');
  }

  async function loadPyodide() {
    if (pyodide || isLoading) return;
    isLoading = true;
    updateStatus('loading', 'Loading Python runtime...');

    try {
      // Load Pyodide from CDN
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js';
      document.head.appendChild(script);

      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
      });

      pyodide = await loadPyodide({ // global from CDN
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/'
      });

      // Pre-install common packages
      updateStatus('loading', 'Installing packages...');
      await pyodide.loadPackage(['numpy', 'micropip']);

      updateStatus('ready', 'Python ready ✓');
      isLoading = false;
      appendOutput('Python runtime loaded successfully! 🐍', 'success');
      appendOutput('Available: numpy, micropip (for installing more packages)', 'success');
    } catch (error) {
      updateStatus('error', 'Failed to load Python');
      appendOutput(`Error loading Pyodide: ${error.message}`, 'error');
      isLoading = false;
    }
  }

  async function runCode() {
    if (!pyodide) {
      appendOutput('Python runtime not loaded yet. Please wait...', 'error');
      return;
    }
    if (isRunning) return;

    const code = document.getElementById('code-editor').value;
    if (!code.trim()) return;

    isRunning = true;
    document.getElementById('run-code-btn').disabled = true;
    document.getElementById('run-code-btn').textContent = '⏳ Running...';
    clearOutput();
    appendOutput(`>>> Running code...\n`, 'info');

    try {
      // Capture stdout
      pyodide.runPython(`
import sys, io
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
      `);

      // Check if matplotlib is needed
      if (code.includes('matplotlib') || code.includes('plt.')) {
        try {
          await pyodide.loadPackage('matplotlib');
          pyodide.runPython(`
import matplotlib
matplotlib.use('AGG')
          `);
        } catch (e) {
          appendOutput('Note: matplotlib loading...', 'info');
        }
      }

      // Check if pandas is needed
      if (code.includes('pandas') || code.includes('pd.')) {
        try {
          await pyodide.loadPackage('pandas');
        } catch (e) { /* ignore */ }
      }

      // Run user code
      await pyodide.runPythonAsync(code);

      // Get stdout output
      const stdout = pyodide.runPython('sys.stdout.getvalue()');
      const stderr = pyodide.runPython('sys.stderr.getvalue()');

      if (stdout) appendOutput(stdout, 'output');
      if (stderr) appendOutput(stderr, 'error');

      // Check for matplotlib figures
      try {
        const hasPlot = pyodide.runPython(`
import matplotlib.pyplot as plt
len(plt.get_fignums()) > 0
        `);
        if (hasPlot) {
          pyodide.runPython(`
import base64
buf = io.BytesIO()
plt.savefig(buf, format='png', dpi=100, bbox_inches='tight', facecolor='#1a2235')
buf.seek(0)
__plot_data__ = base64.b64encode(buf.read()).decode()
plt.close('all')
          `);
          const plotData = pyodide.globals.get('__plot_data__');
          if (plotData) {
            appendImage(`data:image/png;base64,${plotData}`);
          }
        }
      } catch (e) { /* No matplotlib, ignore */ }

      if (!stdout && !stderr) {
        appendOutput('Code executed successfully (no output)', 'success');
      }
    } catch (error) {
      appendOutput(`Error: ${error.message}`, 'error');
    }

    // Reset stdout
    try {
      pyodide.runPython(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
      `);
    } catch (e) { /* ignore */ }

    isRunning = false;
    document.getElementById('run-code-btn').disabled = false;
    document.getElementById('run-code-btn').textContent = '▶ Run';
  }

  function appendOutput(text, type = 'output') {
    const output = document.getElementById('code-output');
    const line = document.createElement('div');
    line.className = `output-line output-${type}`;
    line.textContent = text;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  }

  function appendImage(src) {
    const output = document.getElementById('code-output');
    const img = document.createElement('img');
    img.src = src;
    img.className = 'output-image';
    output.appendChild(img);
    output.scrollTop = output.scrollHeight;
  }

  function clearOutput() {
    document.getElementById('code-output').innerHTML = '';
  }

  function updateStatus(state, text) {
    const el = document.getElementById('pyodide-status');
    el.className = `pyodide-status ${state}`;
    document.getElementById('pyodide-status-text').textContent = text;
  }

  return { init, show, hide };
})();
