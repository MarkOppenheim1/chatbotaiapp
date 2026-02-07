from dotenv import load_dotenv
load_dotenv()

import os
from pathlib import Path
from typing import Any

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings

from langchain_core.runnables import RunnableWithMessageHistory, RunnableLambda
from langchain_community.chat_message_histories import RedisChatMessageHistory
from langchain_community.vectorstores.upstash import UpstashVectorStore


from config import (
    LLM_PROVIDER,
    LLM_MODEL,
    LLM_TEMPERATURE,
    LLM_MAX_TOKENS,
    LLM_TOP_P,
    EMBEDDING_PROVIDER,
    EMBEDDING_MODEL,
    RETRIEVAL_K,
)


# -------------------------------------------------
# LLMs
# -------------------------------------------------
if LLM_PROVIDER == "google":
    llm = ChatGoogleGenerativeAI(
        model=LLM_MODEL,
        temperature=LLM_TEMPERATURE,
        #max_tokens=LLM_MAX_TOKENS,
        #top_p=LLM_TOP_P, #top_p only works for some models
    )
elif LLM_PROVIDER == "openai":
    llm = ChatOpenAI(
        model=LLM_MODEL,
        temperature=LLM_TEMPERATURE,
        #max_tokens=LLM_MAX_TOKENS,
        #top_p=LLM_TOP_P,
    )

# -------------------------------------------------
# Vector DB (must match ingest.py)
# -------------------------------------------------
COLLECTION = "rag_docs"

if EMBEDDING_PROVIDER == "openai":
    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)
elif EMBEDDING_PROVIDER == "google":
    embeddings = GoogleGenerativeAIEmbeddings(model=EMBEDDING_MODEL)
else:
    raise SystemExit(f"Unsupported EMBEDDING_PROVIDER: {EMBEDDING_PROVIDER}")

UPSTASH_URL = os.getenv("UPSTASH_VECTOR_REST_URL")
UPSTASH_TOKEN = os.getenv("UPSTASH_VECTOR_REST_TOKEN")
if not UPSTASH_URL or not UPSTASH_TOKEN:
    raise SystemExit("Missing UPSTASH_VECTOR_REST_URL / UPSTASH_VECTOR_REST_TOKEN in backend/.env")

vectordb = UpstashVectorStore(
    embedding=embeddings,
    index_url=UPSTASH_URL,
    index_token=UPSTASH_TOKEN,
    # If your installed version supports it, you can optionally use a namespace:
    namespace=COLLECTION,
)

retriever = vectordb.as_retriever(search_kwargs={"k": RETRIEVAL_K})


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

# If your rag_chain returns {"output": "<answer>", "sources": [...]}
answer_only = rag_chain | RunnableLambda(lambda x: x["output"])

chat_chain = RunnableWithMessageHistory(
    answer_only,
    get_history,
    input_messages_key="input",
    history_messages_key="history",
)

# -------------------------------------------------
# Exported chain (LangServe-compatible)
# -------------------------------------------------
# chain = RunnableWithMessageHistory(
#     rag_chain,
#     get_history,
#     input_messages_key="input",
#     history_messages_key="history",
# )

chain = chat_chain


def sources_only(inputs: dict) -> dict:
    query = inputs["input"]
    docs = retriever.invoke(query)

    sources = []
    for d in docs:
        meta = d.metadata or {}
        snippet = d.page_content.strip().replace("\n", " ")
        if len(snippet) > 220:
            snippet = snippet[:220] + "…"
        src = meta.get("source")
        if src:
            try:
                src = str(Path(src).relative_to(Path(__file__).parent / "data"))
            except Exception:
                pass
        sources.append({
            "source": src,
            "page": meta.get("page") + 1 if isinstance(meta.get("page"), int) else None,
            "snippet": snippet,
        })

    # IMPORTANT: output must be a string for LangServe tracer; put sources separately
    return {"output": "", "sources": sources}

# ✅ IMPORTANT: do NOT wrap sources_chain with RunnableWithMessageHistory
sources_chain = RunnableLambda(sources_only)