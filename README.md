# 🧠 Snave AI

**A powerful, all-in-one AI assistant platform** with chat, deep research, code execution, image generation, and document analysis — powered entirely by free APIs and open-source tools.

![Snave AI](https://img.shields.io/badge/Snave-AI-38bdf8?style=for-the-badge&logo=brain&logoColor=white)

---

## ✨ Features

| Feature | Description |
|---------|------------|
| 💬 **Chat** | Natural conversational AI with 5 personality modes |
| 🔬 **Deep Research** | Real-time web search, multi-source analysis, citations |
| 💻 **Code Interpreter** | In-browser Python execution (NumPy, Pandas, Matplotlib) |
| 🎨 **Image Generation** | AI-powered image creation with FLUX.1 model |
| 📄 **File Analysis** | Upload PDF, DOCX, images for AI analysis |
| 🧠 **Memory** | Persistent memory across conversations |
| 🤖 **Agent Mode** | AI auto-detects which tools to use |
| 🌙 **Dark/Light Mode** | Premium UI with smooth theme switching |

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v18+ installed
- A free [Google Gemini API key](https://aistudio.google.com/apikey)
- A free [HuggingFace token](https://huggingface.co/settings/tokens) (for image generation)

### Setup

1. **Clone the project** and navigate to the server directory:
   ```bash
   cd server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure API keys:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your API keys:
   ```
   GEMINI_API_KEY=your_gemini_key
   HF_API_TOKEN=your_huggingface_token
   ```

4. **Start the server:**
   ```bash
   npm run dev
   ```

5. **Open in browser:**
   ```
   http://localhost:3000
   ```

---

## 🏗️ Architecture

```
Snave AI
├── server/              # Node.js + Express backend
│   ├── services/        # AI service integrations
│   │   ├── gemini.js    # Google Gemini API
│   │   ├── huggingface.js  # HuggingFace Inference
│   │   ├── orchestrator.js # AI task routing
│   │   ├── search.js    # Web search (DuckDuckGo)
│   │   ├── imageGen.js  # Image generation
│   │   └── memory.js    # Memory management
│   ├── routes/          # API endpoints
│   ├── db/              # SQLite database
│   └── utils/           # Helpers & prompts
│
└── client/              # Vanilla HTML/CSS/JS frontend
    ├── css/             # Design system & component styles
    └── js/              # Modular JavaScript controllers
```

---

## 🔌 Tech Stack (All Free)

| Component | Technology |
|-----------|-----------|
| Backend | Node.js + Express |
| AI (Primary) | Google Gemini 2.5 Flash |
| AI (Fallback) | HuggingFace Inference API |
| Image Gen | FLUX.1-schnell via HuggingFace |
| Code Execution | Pyodide (Python in WebAssembly) |
| Web Search | DuckDuckGo (no API key needed) |
| Database | SQLite |
| Streaming | Server-Sent Events (SSE) |

---

## 🌐 Deployment

### Render (Backend)
1. Push to GitHub
2. Create a new Web Service on [render.com](https://render.com)
3. Set build command: `cd server && npm install`
4. Set start command: `cd server && node index.js`
5. Add environment variables (GEMINI_API_KEY, HF_API_TOKEN)

### Vercel (Static Frontend)
1. Deploy the `client/` folder to Vercel
2. Update API_BASE in `client/js/utils.js` to your Render URL

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line |
| `Ctrl+N` | New chat |
| `Ctrl+Enter` | Run code (in Code Interpreter) |

---

## 📝 License

MIT License — Free to use, modify, and distribute.
