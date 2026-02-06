# AI Chat Web App

A production-style, ChatGPT-like AI chat application built with **Next.js**, **LangServe**, and **LangChain**.

It supports **streaming responses**, **multi-chat memory**, **RAG with sources**, and **OAuth authentication** (GitHub & Google), backed by **Redis**.

---

## 🚀 Quick Start

### 1) Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn server:app --reload --port 8001
```

### 2) Frontend
```bash
cd chat-ui
npm install
npm run dev
```

Open http://localhost:3000

---

## ✨ Features

- 🔐 OAuth login (GitHub, Google)
- 💬 ChatGPT-style UI with streaming responses
- 🧠 Persistent, multi-chat memory (Redis)
- 🗂️ Chat sidebar: create, rename, delete conversations
- 🔍 Retrieval-Augmented Generation (RAG) with sources
- ⚡ OpenAI & Google Gemini support
- 🧪 LangSmith tracing (optional)
- 🩺 Backend health check with fail-fast UI

---

## 🏗 Architecture

```
Browser (Next.js + Tailwind)
   ↓
Next.js API Routes (auth, proxy, streaming)
   ↓
LangServe (FastAPI)
   ↓
LangChain (RAG + memory)
   ↓
LLM (OpenAI / Gemini)
   ↓
Redis
```

See **ARCHITECTURE.md** for a deeper breakdown.

---

## 📦 Tech Stack

- Frontend: Next.js, Tailwind CSS, Auth.js / NextAuth
- Backend: FastAPI, LangServe, LangChain
- Memory: Redis
- LLMs: OpenAI, Google Gemini
- Observability: LangSmith

---

## 🔐 Security Notes

- API keys are server-side only
- OAuth handled via NextAuth
- Redis never exposed to the browser
- Backend accessed through Next.js API routes

---

## 📜 License

MIT
