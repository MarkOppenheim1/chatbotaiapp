from dotenv import load_dotenv
load_dotenv()

import os
import hashlib
from pathlib import Path

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

from langchain_openai import OpenAIEmbeddings
from langchain_google_genai import GoogleGenerativeAIEmbeddings

from langchain_community.vectorstores.upstash import UpstashVectorStore
from langchain_community.document_loaders import PyPDFLoader

from config import (
    EMBEDDING_PROVIDER,
    EMBEDDING_MODEL,
)

DATA_DIR = Path(__file__).parent / "data"
COLLECTION = "rag_docs"  # used as Upstash "namespace" conceptually; kept for consistency


def load_text_docs(data_dir: Path) -> list[Document]:
    docs: list[Document] = []
    for p in data_dir.rglob("*"):
        if not p.is_file():
            continue
        if p.suffix.lower() in [".txt", ".md"]:
            docs.append(
                Document(
                    page_content=p.read_text(encoding="utf-8", errors="ignore"),
                    metadata={"source": str(p)}
                )
            )
    return docs


def load_pdf_docs(data_dir: Path) -> list[Document]:
    docs: list[Document] = []
    for p in data_dir.rglob("*.pdf"):
        loader = PyPDFLoader(str(p))
        pdf_docs = loader.load()  # one Document per page, includes metadata like 'page'
        for d in pdf_docs:
            d.metadata["source"] = str(p)
        docs.extend(pdf_docs)
    return docs


def _stable_chunk_id(doc: Document, idx: int) -> str:
    """
    Deterministic ID so re-running ingest updates instead of duplicating.
    Includes source + page (if any) + index + content hash.
    """
    src = str(doc.metadata.get("source", ""))
    page = str(doc.metadata.get("page", ""))
    content = doc.page_content or ""
    digest = hashlib.sha1(content.encode("utf-8")).hexdigest()
    return f"{src}|p={page}|i={idx}|h={digest}"


def main():
    if not DATA_DIR.exists():
        raise SystemExit(f"Create {DATA_DIR} and add files first (md/txt/pdf).")

    # Fail fast if Upstash env vars not configured
    url = os.getenv("UPSTASH_VECTOR_REST_URL")
    token = os.getenv("UPSTASH_VECTOR_REST_TOKEN")
    if not url or not token:
        raise SystemExit(
            "Missing UPSTASH_VECTOR_REST_URL / UPSTASH_VECTOR_REST_TOKEN in backend/.env"
        )

    raw_docs: list[Document] = []
    raw_docs.extend(load_text_docs(DATA_DIR))
    raw_docs.extend(load_pdf_docs(DATA_DIR))

    if not raw_docs:
        raise SystemExit(f"No .md/.txt/.pdf files found in {DATA_DIR}")

    splitter = RecursiveCharacterTextSplitter(chunk_size=900, chunk_overlap=150)
    chunks = splitter.split_documents(raw_docs)

    if EMBEDDING_PROVIDER == "openai":
        embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)
    elif EMBEDDING_PROVIDER == "google":
        embeddings = GoogleGenerativeAIEmbeddings(model=EMBEDDING_MODEL)
    else:
        raise SystemExit(f"Unsupported EMBEDDING_PROVIDER: {EMBEDDING_PROVIDER}")

    # Upstash Vector store (serverless)
    vectordb = UpstashVectorStore(
        embedding=embeddings,
        index_url=url,
        index_token=token,
        # Some versions of the integration support namespace; if yours does, you can set it.
        namespace=COLLECTION,
    )

    ids = [_stable_chunk_id(d, i) for i, d in enumerate(chunks)]

    # Upsert
    vectordb.add_documents(chunks, ids=ids)

    print(f"✅ Ingested {len(chunks)} chunks into Upstash Vector (logical collection={COLLECTION})")


if __name__ == "__main__":
    main()
