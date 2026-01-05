from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from pydantic import BaseModel
from langserve import add_routes
from chain import chain
from langchain_community.chat_message_histories import RedisChatMessageHistory
import os

app = FastAPI(title="Chat API")

add_routes(
    app,
    chain,
    path="/chat"
)

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
