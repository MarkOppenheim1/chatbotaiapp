# ChatGPT-like AI Web App

A full-stack, production-style AI chat application built with **Next.js**, **LangServe**, and **LangChain**, featuring **streaming responses**, **persistent Redis memory**, and **GitHub authentication**.

This project demonstrates how modern AI applications are architected in real-world systems.

---

## ✨ Features

- 🔐 **GitHub Authentication** (Auth.js / NextAuth)
- 💬 **ChatGPT-style UI** (Next.js + Tailwind CSS)
- ⚡ **Streaming LLM responses**
- 🧠 **Persistent chat memory** (Redis)
- 👤 **Memory scoped per authenticated user**
- 🧹 **Clear Chat** (clears Redis history)
- 🔄 **Provider-agnostic LLM support**
  - OpenAI
  - Google Gemini
- 📊 **LangSmith observability support**
- 🧩 Clean separation of frontend and backend

---

## 🏗 Architecture Overview

Browser (Next.js + Tailwind)
↓
Next.js API Routes
↓
LangServe (FastAPI)
↓
LangChain / LangGraph-ready
↓
LLM (Gemini or OpenAI)
↓
Redis (chat memory)

---

## 📁 Repository Structure
.
├── frontend/ # Next.js app (UI, auth, API proxy)
│ ├── app/
│ ├── components/
│ └── ...
│
├── backend/ # LangServe + LangChain backend
│ ├── server.py
│ ├── chain.py
│ └── ...
│
├── .gitignore
└── README.md

---

## 🚀 Getting Started

### Prerequisites

- Node.js (LTS)
- Python 3.10+
- Redis (local or Upstash)
- GitHub account (for OAuth)
- OpenAI **or** Google Gemini API key

---

## 🔧 Backend Setup (LangServe)

```bash
cd backend
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt

# LLM
OPENAI_API_KEY=...
# or
GOOGLE_API_KEY=...

# Redis
REDIS_URL=rediss://default:password@host:6379

# LangSmith (optional)
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=...
LANGCHAIN_PROJECT=chat-app
Start the backend:

bash
Copy code
uvicorn server:app --reload --port 8001
Open:

arduino
Copy code
http://127.0.0.1:8001/docs
🌐 Frontend Setup (Next.js)
bash
Copy code
cd frontend
npm install
Create .env.local:

env
Copy code
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=some-random-secret

GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GitHub OAuth callback URL must be:

bash
Copy code
http://localhost:3000/api/auth/callback/github
Start the frontend:

bash
Copy code
npm run dev
Open:

arduino
Copy code
http://localhost:3000
🧠 Chat Memory Design
Chat memory is stored in Redis

Memory is keyed by:

makefile
Copy code
user:<github_user_id>
Memory:

persists across refreshes

works across devices

is cleared via Clear Chat

No browser-based session IDs are used

🧹 Clear Chat
The Clear Chat button:

deletes Redis history for the current user

resets the UI state

does not affect other users

🔍 Observability (LangSmith)
LangSmith can be enabled via environment variables only (no code changes required):

env
Copy code
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=...
LANGCHAIN_PROJECT=chat-app
View traces at:
https://smith.langchain.com

🔒 Security Notes
API keys are never exposed to the browser

Authentication handled via OAuth (GitHub)

Redis access is server-side only

.env files are excluded from version control

🧩 Future Extensions
Multiple conversations per user

LangGraph agents & tools

Rate limiting / usage caps

Deployment (Vercel + Fly.io / Render)

Guest mode support

📜 License
MIT (or your preferred license)

🙌 Acknowledgements
Next.js

LangChain & LangServe

Auth.js / NextAuth

Redis / Upstash

OpenAI & Google Gemini
