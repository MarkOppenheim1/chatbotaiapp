from dotenv import load_dotenv
load_dotenv()

import os
from pathlib import Path
from operator import itemgetter

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnableWithMessageHistory, RunnableLambda, RunnablePassthrough
from langchain_community.chat_message_histories import RedisChatMessageHistory

from langchain_chroma import Chroma

# -----------------------------
# LLMs
# -----------------------------
llmOpenAI = ChatOpenAI(
    model="gpt-5-nano",
    temperature=0.7
)

llmGemini = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    temperature=0.7
)

llm = llmOpenAI  # switch here

# -----------------------------
# Vector DB (Chroma) + Retriever
# -----------------------------
CHROMA_DIR = Path(__file__).parent / "chroma_db"
COLLECTION = "rag_docs"

# IMPORTANT: Use the SAME embeddings here as in ingest.py
embeddings = OpenAIEmbeddings()
# If you used Google embeddings in ingest.py, swap accordingly.

vectordb = Chroma(
    persist_directory=str(CHROMA_DIR),
    embedding_function=embeddings,
    collection_name=COLLECTION,
)

retriever = vectordb.as_retriever(search_kwargs={"k": 4})

def format_docs(docs):
    # keep it simple; you can add metadata/source formatting later
    return "\n\n".join(d.page_content for d in docs)

# -----------------------------
# Prompt with context + history
# -----------------------------
rag_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are a nice person to chat to.\n\n"
     "Use the CONTEXT below to answer when it is relevant. "
     "If the answer is not in the context, say you don't know.\n\n"
     "CONTEXT:\n{context}"),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{input}")
])

# -----------------------------
# RAG chain (retrieve -> prompt -> LLM)
# -----------------------------
rag_chain = (
    {
        "input": itemgetter("input"),
        "history": itemgetter("history"),
        "context": itemgetter("input") | retriever | RunnableLambda(format_docs),
    }
    | rag_prompt
    | llm
)

# -----------------------------
# Redis-backed history
# -----------------------------
REDIS_URL = os.environ.get("REDIS_URL")
print("Using REDIS_URL:", REDIS_URL)

def get_history(session_id: str):
    return RedisChatMessageHistory(
        session_id=session_id,
        url=REDIS_URL,
        ttl=60 * 60 * 24,  # 24 hours
    )

# Expose: `chain` (same name as before)
chain = RunnableWithMessageHistory(
    rag_chain,
    get_history,
    input_messages_key="input",
    history_messages_key="history",
)