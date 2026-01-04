from dotenv import load_dotenv
load_dotenv()

from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain_core.runnables import RunnableWithMessageHistory
from langchain_community.chat_message_histories import RedisChatMessageHistory
import os

llmOpenAI = ChatOpenAI(
    model="gpt-5-nano",
    temperature=0.7
)

llmGemini = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",#"gemini-2.5-flash-lite","gemini-2.5-flash"
    temperature=0.7
)

llm = llmOpenAI  # Switch between llmOpenAI and llmGemini here


prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a nice person to chat to."),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{input}")
])

# -----------------------------
# Redis-backed history
# -----------------------------
REDIS_URL = os.environ.get("REDIS_URL")
print("Using REDIS_URL:", REDIS_URL)

def get_history(session_id: str):
    return RedisChatMessageHistory(
        session_id=session_id,
        url=REDIS_URL,
        ttl=60 * 60 * 24,  # 24 hours (optional)
    )

# Chain with memory
chain = RunnableWithMessageHistory(
    prompt | llm,
    get_history,
    input_messages_key="input",
    history_messages_key="history",
)
