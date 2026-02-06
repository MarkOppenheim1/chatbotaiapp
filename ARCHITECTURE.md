# Architecture Overview

This document explains how the AI Chat Web App is structured and why.

---

## High-Level Flow

```
User Browser
  → Next.js UI
  → Next.js API Routes
  → LangServe (FastAPI)
  → LangChain
  → LLM (OpenAI / Gemini)
  → Redis
```

---

## Frontend (Next.js)

Responsibilities:
- Authentication (GitHub / Google)
- Chat UI (streaming, markdown, sources)
- Chat sidebar (multi-conversation UX)
- API proxying (chat, sources, files, health)

Key concepts:
- The browser never talks to the backend directly
- All backend access goes through Next.js API routes
- This avoids CORS issues and keeps the backend private

---

## Backend (LangServe + LangChain)

Responsibilities:
- Orchestrate LLM calls
- Perform retrieval (RAG)
- Manage chat memory
- Expose clean HTTP endpoints

Important endpoints:
- `/chat` – streaming chat responses
- `/sources` – retrieve RAG sources (no memory writes)
- `/files` – serve source documents
- `/health` – backend liveness check

---

## Chat Memory Model

- Stored in Redis
- Scoped by:
  ```
  user:<user_id>:chat:<chat_id>
  ```
- Enables:
  - Multiple chats per user
  - Switching conversations
  - Persistent history across sessions

---

## Retrieval-Augmented Generation (RAG)

- User query triggers document retrieval
- Retrieved chunks are passed to the LLM
- Responses include source references
- Sources are displayed and linked in the UI

---

## Streaming

- Backend streams tokens via SSE
- Next.js API route parses and forwards text chunks
- UI updates incrementally (ChatGPT-style)

---

## Health Checks

- Backend exposes `/health`
- Frontend checks via `/api/health`
- If backend is down:
  - UI shows a clear error
  - User can retry when backend recovers

---

## Why This Architecture

- Scales well from local dev to production
- Clear separation of concerns
- Easy to swap LLM providers
- Secure by default
- Matches real-world AI system design
