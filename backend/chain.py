from dotenv import load_dotenv
load_dotenv()

import os
from pathlib import Path
from typing import Any

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI

from langchain_core.runnables import RunnableWithMessageHistory, RunnableLambda
from langchain_community.chat_message_histories import RedisChatMessageHistory
from langchain_chroma import Chroma

# -------------------------------------------------
# LLMs
# -------------------------------------------------
llmOpenAI = ChatOpenAI(
    model="gpt-5-nano",
    temperature=0.7,
)

llmGemini = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    temperature=0.7,
)

llm = llmOpenAI  # switch if needed

# -------------------------------------------------
# Vector DB (must match ingest.py)
# -------------------------------------------------
CHROMA_DIR = Path(__file__).parent / "chroma_db"
COLLECTION = "rag_docs"

embeddings = OpenAIEmbeddings()

vectordb = Chroma(
    persist_directory=str(CHROMA_DIR),
    collection_name=COLLECTION,
    embedding_function=embeddings,
)

retriever = vectordb.as_retriever(search_kwargs={"k": 4})

# -------------------------------------------------
# Helpers
# -------------------------------------------------
def fetch_docs(inputs: dict) -> dict:
    query = inputs["input"]
    docs = retriever.invoke(query)

    sources = []
    context_chunks = []

    for d in docs:
        context_chunks.append(d.page_content)

        meta = d.metadata or {}
        snippet = d.page_content.strip().replace("\n", " ")
        if len(snippet) > 220:
            snippet = snippet[:220] + "…"

        sources.append({
            "source": meta.get("source"),
            "page": meta.get("page") + 1 if isinstance(meta.get("page"), int) else None,
            "snippet": snippet,
        })

    return {
        "input": query,
        "history": inputs.get("history", []),
        "context": "\n\n".join(context_chunks),
        "sources": sources,
    }

def build_prompt(bundle: dict) -> dict:
    history_text = ""
    for m in bundle.get("history", []):
        try:
            history_text += f"{m.type}: {m.content}\n"
        except Exception:
            history_text += str(m) + "\n"

    prompt = f"""
    You are a nice person to chat to.

    Use the CONTEXT below to answer the user's question.
    If the answer is not in the context, say you don't know.

    CONTEXT:
    {bundle['context']}

    CHAT HISTORY:
    {history_text}

    USER:
    {bundle['input']}
    """.strip()

    #print(prompt)

    return {
        "prompt": prompt,
        "sources": bundle["sources"],
    }

def run_llm_with_bundle(bundle: dict) -> dict:
    """
    Called with bundle = {"prompt": str, "sources": [...]}
    Return a dict containing both the plain answer string and the bundle,
    so the next step can package everything.
    """
    prompt_text = bundle.get("prompt", "")
    response = llm.invoke(prompt_text)
    answer = getattr(response, "content", str(response))
  
    return {"answer_str": answer, "bundle": bundle}

def package_from_run_result(run_result: dict) -> dict:
    """
    run_result = {"answer_str": str, "bundle": {"prompt":..., "sources":[...]}}
    Return final shape where:
      - "output" is the plain string answer (tracer / history expects this)
      - "sources" is a separate top-level key that the frontend can read
    """
    answer = run_result.get("answer_str", "")
    sources = []
    try:
        sources = run_result.get("bundle", {}).get("sources", [])
    except Exception:
        sources = []

    return {
        "output": answer,
        "sources": sources,
    }

# robust rag_chain (fetch -> build prompt -> run model with bundle -> package)
rag_chain = (
    RunnableLambda(fetch_docs)            # -> {input,history,context,sources}
    | RunnableLambda(build_prompt)        # -> {"prompt":str, "sources":[...]}
    | RunnableLambda(run_llm_with_bundle) # -> {"answer_str": str, "bundle": {...}}
    | RunnableLambda(package_from_run_result)  # -> {"output": "<string>", "sources":[...] }
)

# -------------------------------------------------
# Redis-backed history
# -------------------------------------------------
REDIS_URL = os.environ.get("REDIS_URL")

def get_history(session_id: str):
    return RedisChatMessageHistory(
        session_id=session_id,
        url=REDIS_URL,
        ttl=60 * 60 * 24,
    )

# -------------------------------------------------
# Exported chain (LangServe-compatible)
# -------------------------------------------------
chain = RunnableWithMessageHistory(
    rag_chain,
    get_history,
    input_messages_key="input",
    history_messages_key="history",
)

def sources_only(inputs: dict) -> dict:
    query = inputs["input"]
    docs = retriever.invoke(query)

    sources = []
    for d in docs:
        meta = d.metadata or {}
        snippet = d.page_content.strip().replace("\n", " ")
        if len(snippet) > 220:
            snippet = snippet[:220] + "…"
        sources.append({
            "source": meta.get("source"),
            "page": meta.get("page") + 1 if isinstance(meta.get("page"), int) else None,
            "snippet": snippet,
        })

    # IMPORTANT: output must be a string for LangServe tracer; put sources separately
    return {"output": "", "sources": sources}

sources_chain = RunnableWithMessageHistory(
    RunnableLambda(sources_only),
    get_history,
    input_messages_key="input",
    history_messages_key="history",
)