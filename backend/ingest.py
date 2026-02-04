from dotenv import load_dotenv
load_dotenv()

from pathlib import Path
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from langchain_openai import OpenAIEmbeddings
# If you want Google embeddings instead, swap to:
# from langchain_google_genai import GoogleGenerativeAIEmbeddings

from langchain_chroma import Chroma

DATA_DIR = Path(__file__).parent / "data"
CHROMA_DIR = Path(__file__).parent / "chroma_db"
COLLECTION = "rag_docs"

def load_files() -> list[Document]:
    docs = []
    for p in DATA_DIR.rglob("*"):
        if p.is_file() and p.suffix.lower() in [".txt", ".md"]:
            docs.append(Document(page_content=p.read_text(encoding="utf-8"), metadata={"source": str(p)}))
    return docs

def main():
    if not DATA_DIR.exists():
        raise SystemExit(f"Create {DATA_DIR} and add .txt/.md files first.")

    raw_docs = load_files()
    if not raw_docs:
        raise SystemExit(f"No .txt/.md files found in {DATA_DIR}")

    splitter = RecursiveCharacterTextSplitter(chunk_size=900, chunk_overlap=150)
    chunks = splitter.split_documents(raw_docs)

    embeddings = OpenAIEmbeddings()
    # embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")

    Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=str(CHROMA_DIR),
        collection_name=COLLECTION,
    )

    print(f"✅ Ingested {len(chunks)} chunks into {CHROMA_DIR} (collection={COLLECTION})")

if __name__ == "__main__":
    main()
