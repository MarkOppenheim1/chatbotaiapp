from dotenv import load_dotenv
load_dotenv()

import os
import tempfile
import hashlib
from pathlib import Path

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

from langchain_openai import OpenAIEmbeddings
from langchain_google_genai import GoogleGenerativeAIEmbeddings

from langchain_community.vectorstores.upstash import UpstashVectorStore
from langchain_community.document_loaders import PyPDFLoader

from r2_utils import get_r2_client, list_keys

from config import (
    EMBEDDING_PROVIDER,
    EMBEDDING_MODEL,
)

COLLECTION = "rag_docs"

TEXT_EXTS = {".txt", ".md"}
PDF_EXTS = {".pdf"}


def load_r2_docs() -> list[Document]:
    bucket = os.environ["R2_BUCKET_NAME"]
    prefix = os.environ.get("R2_PREFIX", "")
    print(prefix)
    s3 = get_r2_client()

    keys = list_keys(bucket=bucket, prefix=prefix)

    docs: list[Document] = []
    for key in keys:
        suffix = Path(key).suffix.lower()
        if suffix not in TEXT_EXTS and suffix not in PDF_EXTS:
            continue

        obj = s3.get_object(Bucket=bucket, Key=key)
        body: bytes = obj["Body"].read()

        if suffix in TEXT_EXTS:
            text = body.decode("utf-8", errors="ignore")
            docs.append(
                Document(
                    page_content=text,
                    metadata={
                        "source": f"r2://{bucket}/{key}",
                        "r2_bucket": bucket,
                        "r2_key": key,
                    },
                )
            )
        else:
            tmp_path = None
            try:
                fd, tmp_path = tempfile.mkstemp(suffix=".pdf")
                with os.fdopen(fd, "wb") as f:
                    f.write(body)

                loader = PyPDFLoader(tmp_path)
                pdf_docs = loader.load()

                for d in pdf_docs:
                    d.metadata["source"] = f"r2://{bucket}/{key}"
                    d.metadata["r2_bucket"] = bucket
                    d.metadata["r2_key"] = key

                docs.extend(pdf_docs)

            finally:
                if tmp_path and os.path.exists(tmp_path):
                    try:
                        os.remove(tmp_path)
                    except Exception:
                        pass


    return docs


def _stable_chunk_id(doc: Document, idx: int) -> str:
    """
    Deterministic ID so re-running ingest updates instead of duplicating.
    Uses: r2 key + page (if any) + idx + content hash
    """
    key = str(doc.metadata.get("r2_key", doc.metadata.get("source", "")))
    page = str(doc.metadata.get("page", ""))
    content = doc.page_content or ""
    digest = hashlib.sha1(content.encode("utf-8")).hexdigest()
    return f"{key}|p={page}|i={idx}|h={digest}"


def main():
    # Required env
    for v in [
        "R2_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET_NAME",
        "UPSTASH_VECTOR_REST_URL",
        "UPSTASH_VECTOR_REST_TOKEN",
    ]:
        if not os.getenv(v):
            raise SystemExit(f"Missing {v} in backend/.env")

    raw_docs = load_r2_docs()
    if not raw_docs:
        raise SystemExit("No ingestible .md/.txt/.pdf objects found in R2 (check bucket/prefix).")

    splitter = RecursiveCharacterTextSplitter(chunk_size=900, chunk_overlap=150)
    chunks = splitter.split_documents(raw_docs)

    if EMBEDDING_PROVIDER == "openai":
        embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)
    elif EMBEDDING_PROVIDER == "google":
        embeddings = GoogleGenerativeAIEmbeddings(model=EMBEDDING_MODEL)
    else:
        raise SystemExit(f"Unsupported EMBEDDING_PROVIDER: {EMBEDDING_PROVIDER}")

    vectordb = UpstashVectorStore(
        embedding=embeddings,
        index_url=os.environ["UPSTASH_VECTOR_REST_URL"],
        index_token=os.environ["UPSTASH_VECTOR_REST_TOKEN"],
        # If your version supports it, you can use namespace:
        namespace=COLLECTION,
    )

    ids = [_stable_chunk_id(d, i) for i, d in enumerate(chunks)]
    vectordb.add_documents(chunks, ids=ids)

    print(f"✅ Ingested {len(chunks)} chunks into Upstash Vector (logical collection={COLLECTION})")


if __name__ == "__main__":
    main()
