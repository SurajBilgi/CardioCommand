import os
from pathlib import Path

from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter


def build_index() -> FAISS:
    docs_path = Path(__file__).parent / "documents"
    texts = []
    metadatas = []

    for f in sorted(docs_path.glob("*.txt")):
        content = f.read_text()
        texts.append(content)
        metadatas.append({"source": f.name})

    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    chunks = splitter.create_documents(texts, metadatas=metadatas)

    embeddings = OpenAIEmbeddings()
    vectorstore = FAISS.from_documents(chunks, embeddings)

    index_path = Path(__file__).parent / "faiss_index"
    vectorstore.save_local(str(index_path))
    print(f"RAG index built: {len(chunks)} chunks from {len(texts)} documents")
    return vectorstore


def load_or_build() -> FAISS:
    index_path = Path(__file__).parent / "faiss_index"
    embeddings = OpenAIEmbeddings()

    if index_path.exists():
        try:
            return FAISS.load_local(
                str(index_path),
                embeddings,
                allow_dangerous_deserialization=True,
            )
        except Exception as e:
            print(f"Failed to load existing index ({e}), rebuilding...")

    return build_index()
