from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from pydantic import BaseModel
from langserve import add_routes
from chain import chain, sources_chain
from langchain_community.chat_message_histories import RedisChatMessageHistory
import os

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

REDIS_URL = os.environ.get("REDIS_URL")

@app.post("/chat/clear")
def clear_chat(req: ClearChatRequest):
    history = RedisChatMessageHistory(
        session_id=req.session_id,
        url=REDIS_URL,
    )
    history.clear()
    return {"status": "cleared"}

from fastapi import HTTPException
from fastapi.responses import FileResponse
from pathlib import Path

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