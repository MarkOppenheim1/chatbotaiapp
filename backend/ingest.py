from dotenv import load_dotenv
load_dotenv()

from pathlib import Path

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

from langchain_openai import OpenAIEmbeddings
from langchain_google_genai import GoogleGenerativeAIEmbeddings
# If you want Google embeddings instead, swap to:
# from langchain_google_genai import GoogleGenerativeAIEmbeddings

from langchain_chroma import Chroma
from langchain_community.document_loaders import PyPDFLoader

from config import (
    EMBEDDING_PROVIDER,
    EMBEDDING_MODEL,
)

DATA_DIR = Path(__file__).parent / "data"
CHROMA_DIR = Path(__file__).parent / "chroma_db"
COLLECTION = "rag_docs"

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
        # Ensure source path is present (PyPDFLoader usually sets 'source' already, but we normalize)
        for d in pdf_docs:
            d.metadata["source"] = str(p)
        docs.extend(pdf_docs)
    return docs

def main():
    if not DATA_DIR.exists():
        raise SystemExit(f"Create {DATA_DIR} and add files first (md/txt/pdf).")

    raw_docs = []
    raw_docs.extend(load_text_docs(DATA_DIR))
    raw_docs.extend(load_pdf_docs(DATA_DIR))

    if not raw_docs:
        raise SystemExit(f"No .md/.txt/.pdf files found in {DATA_DIR}")

    splitter = RecursiveCharacterTextSplitter(chunk_size=900, chunk_overlap=150)
    chunks = splitter.split_documents(raw_docs)

    if EMBEDDING_PROVIDER == 'openai':
        embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)
    elif EMBEDDING_PROVIDER == 'google':
        embeddings = GoogleGenerativeAIEmbeddings(model=EMBEDDING_MODEL)

    # Rebuild the collection cleanly each run
    vectordb = Chroma(
        persist_directory=str(CHROMA_DIR),
        collection_name=COLLECTION,
        embedding_function=embeddings,
    )
    vectordb.delete_collection()  # wipe old embeddings
    vectordb = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=str(CHROMA_DIR),
        collection_name=COLLECTION,
    )

    print(f"✅ Ingested {len(chunks)} chunks into {CHROMA_DIR} (collection={COLLECTION})")

if __name__ == "__main__":
    main()
