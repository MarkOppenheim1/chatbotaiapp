from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from langserve import add_routes
from chain import chain, sources_chain
from langchain_community.chat_message_histories import RedisChatMessageHistory
import os
import json
import time
import uuid
import redis
from fastapi.responses import FileResponse
from pathlib import Path

app = FastAPI(title="Chat API")

add_routes(
    app,
    chain,
    path="/chat"
)

add_routes(app, sources_chain, path="/sources")

# -----------------------------
# Clear chat memory endpoint
# -----------------------------
class ClearChatRequest(BaseModel):
    session_id: str

class CreateChatRequest(BaseModel):
    user_id: str
    title: str | None = None

class DeleteChatRequest(BaseModel):
    user_id: str
    chat_id: str

class RenameChatRequest(BaseModel):
    user_id: str
    chat_id: str
    title: str


REDIS_URL = os.environ.get("REDIS_URL")
r = redis.Redis.from_url(REDIS_URL, decode_responses=True)

def user_chats_key(user_id: str) -> str:
    return f"user:{user_id}:chats"  # sorted set: chat_id -> updated_at

def chat_meta_key(user_id: str, chat_id: str) -> str:
    return f"user:{user_id}:chat:{chat_id}:meta"

def chat_session_id(user_id: str, chat_id: str) -> str:
    # this is what LangChain history uses
    return f"user:{user_id}:chat:{chat_id}"


@app.post("/chat/clear")
def clear_chat(req: ClearChatRequest):
    history = RedisChatMessageHistory(
        session_id=req.session_id,
        url=REDIS_URL,
    )
    history.clear()
    return {"status": "cleared"}




DATA_DIR = Path(__file__).parent / "data"

@app.get("/files")
def get_file(path: str):
    """
    Serve files from backend/data safely.
    Example: /files?path=braveheart.txt
    """
    file_path = (DATA_DIR / path).resolve()

    # Prevent path traversal
    if not str(file_path).startswith(str(DATA_DIR.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(file_path)

@app.post("/chats")
def create_chat(req: CreateChatRequest):
    chat_id = uuid.uuid4().hex
    now = int(time.time())
    title = req.title or "New chat"

    meta = {"chat_id": chat_id, "title": title, "created_at": now, "updated_at": now}
    r.set(chat_meta_key(req.user_id, chat_id), json.dumps(meta))
    r.zadd(user_chats_key(req.user_id), {chat_id: now})

    return {"chat_id": chat_id, "title": title}

@app.get("/chats")
def list_chats(user_id: str):
    chat_ids = r.zrevrange(user_chats_key(user_id), 0, 100)  # newest first
    chats = []
    for cid in chat_ids:
        raw = r.get(chat_meta_key(user_id, cid))
        if raw:
            chats.append(json.loads(raw))
    return {"chats": chats}

@app.get("/chats/messages")
def get_chat_messages(user_id: str, chat_id: str):
    session_id = chat_session_id(user_id, chat_id)
    history = RedisChatMessageHistory(session_id=session_id, url=REDIS_URL)

    out = []
    for m in history.messages:
        out.append({"role": m.type, "content": m.content})

    return {"messages": out}

@app.delete("/chats")
def delete_chat(user_id: str, chat_id: str):
    # delete metadata + index
    r.delete(chat_meta_key(user_id, chat_id))
    r.zrem(user_chats_key(user_id), chat_id)

    # clear messages
    session_id = chat_session_id(user_id, chat_id)
    history = RedisChatMessageHistory(session_id=session_id, url=REDIS_URL)
    history.clear()

    return {"status": "deleted"}

@app.post("/chats/rename")
def rename_chat(req: RenameChatRequest):
    raw = r.get(chat_meta_key(req.user_id, req.chat_id))
    if not raw:
        raise HTTPException(status_code=404, detail="Chat not found")

    meta = json.loads(raw)
    meta["title"] = (req.title or "").strip()[:80] or "Untitled chat"
    meta["updated_at"] = int(time.time())

    r.set(chat_meta_key(req.user_id, req.chat_id), json.dumps(meta))
    # bump ordering
    r.zadd(user_chats_key(req.user_id), {req.chat_id: meta["updated_at"]})

    return {"chat_id": req.chat_id, "title": meta["title"]}