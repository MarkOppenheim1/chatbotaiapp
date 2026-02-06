# AI Chat Web App

I developed this Application to teach myself about modern ways to build AI Applications.

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

## ⚙️ Configuration

This project uses **two environment configuration files**:

- `.env` → backend (FastAPI / LangServe)
- `.env.local` → frontend (Next.js)

These files are **not committed to GitHub** and must be created locally.

---

### Backend Configuration (`backend/.env`)

```env
# === LLM Provider (choose one) ===
OPENAI_API_KEY=sk-...
# OR
GOOGLE_API_KEY=...

# === Redis (required) ===
REDIS_URL=rediss://default:password@host:6379

# === LangSmith (optional, for tracing) ===
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=lsv2_...
LANGCHAIN_PROJECT=chat-app
```

Notes:
- Only **one** LLM provider key is required.
- Redis is mandatory for chat memory and multi-chat support.
- LangSmith is optional and can be enabled without code changes.

---

### Frontend Configuration (`chat-ui/.env.local`)

```env
# === NextAuth ===
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=some-long-random-string

# === Backend API ===
NEXT_PUBLIC_BACKEND_URL=http://localhost:8001

# === OAuth Providers ===
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Notes:
- Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser.
- OAuth callback URLs must be configured in each provider:
  ```
  http://localhost:3000/api/auth/callback/github
  http://localhost:3000/api/auth/callback/google
  ```

---

## 📥 Data Ingestion & RAG Pipeline

The application uses a **Retrieval-Augmented Generation (RAG)** pipeline.
Before the chat can retrieve knowledge, documents must be **ingested and embedded**.

---

### Data Directory

All source documents live in:

```
backend/data/
```

Supported formats:
- `.txt`
- `.md`
- `.pdf`

You can organize files into subfolders if desired.

Example:
```
backend/data/
├── braveheart.txt
├── docs/
│   ├── notes.md
│   └── reference.pdf
```

---

### Ingestion Process

The ingestion step:
1. Loads all files from `backend/data/`
2. Splits documents into chunks
3. Generates embeddings
4. Stores vectors in a **local Chroma database**

This is a **one-time (or occasional) batch process**, not run on every request.

---

### Running Ingestion

From the backend directory:

```bash
cd backend
python ingest.py
```

On success you should see output like:
```
Ingested 123 chunks into chroma_db/
```

This creates / updates:
```
backend/chroma_db/
```

---

### Important Notes

- The same **embedding provider** must be used in:
  - `ingest.py`
  - `chain.py`
- If you change:
  - documents
  - chunk size
  - embedding model
  - embedding provider  
  you must **re-run ingestion**.
- The vector database is stored locally on disk and reused by the backend.

---

### How Retrieval Works at Runtime

At chat time:
1. User sends a message
2. The backend queries Chroma for the top `k` relevant chunks
3. Retrieved text is injected into the LLM prompt
4. The LLM generates a response grounded in the retrieved context
5. Source references are returned alongside the answer

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

## 🔐 Security Notes

- API keys are server-side only
- OAuth handled by NextAuth
- Redis never exposed to the browser
- Backend accessed through Next.js API routes
- File serving is authenticated
- `.env` files are excluded from version control
