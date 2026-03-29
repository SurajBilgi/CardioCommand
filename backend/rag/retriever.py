from __future__ import annotations
import os
from typing import List

_vectorstore = None


def _get_vectorstore():
    global _vectorstore
    if _vectorstore is None:
        # Lazy import to avoid circular deps
        from .indexer import load_or_build
        _vectorstore = load_or_build()
    return _vectorstore


class Retriever:
    def get_relevant_documents(self, query: str, k: int = 3) -> List:
        vs = _get_vectorstore()
        return vs.similarity_search(query, k=k)

    def get_relevant_text(self, query: str, k: int = 3) -> str:
        docs = self.get_relevant_documents(query, k=k)
        return "\n\n---\n\n".join([d.page_content for d in docs])


retriever = Retriever()
