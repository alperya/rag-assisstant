import os
import chromadb
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
from langchain_chroma import Chroma
from langchain_core.documents import Document

from app.config import get_settings


class ChromaDefaultEmbeddings:
    """Wrapper to use ChromaDB's built-in embedding (all-MiniLM-L6-v2 via onnxruntime).
    Much lighter than sentence-transformers+PyTorch (~80MB vs ~2GB)."""

    def __init__(self):
        self._ef = DefaultEmbeddingFunction()

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._ef(texts)

    def embed_query(self, text: str) -> list[float]:
        return self._ef([text])[0]


class VectorStoreManager:
    """Manages ChromaDB vector store operations."""

    def __init__(self):
        settings = get_settings()
        self.persist_dir = settings.chroma_persist_dir
        os.makedirs(self.persist_dir, exist_ok=True)

        self.embeddings = ChromaDefaultEmbeddings()

        self.client = chromadb.PersistentClient(path=self.persist_dir)

        self.vectorstore = Chroma(
            client=self.client,
            collection_name="documents",
            embedding_function=self.embeddings,
        )

    def add_documents(self, documents: list[Document]) -> int:
        """Add document chunks to the vector store."""
        if not documents:
            return 0

        self.vectorstore.add_documents(documents)
        return len(documents)

    def similarity_search(
        self,
        query: str,
        k: int = 10,
        doc_ids: list[str] | None = None,
    ) -> list[Document]:
        """Hybrid search: semantic similarity + keyword fallback."""
        search_kwargs = {"k": k}

        if doc_ids:
            search_kwargs["filter"] = {"doc_id": {"$in": doc_ids}}

        # 1. Semantic search
        semantic_docs = self.vectorstore.similarity_search(query, **search_kwargs)

        # 2. Keyword fallback: search for exact terms in documents
        keyword_docs = self._keyword_search(query, k=k, doc_ids=doc_ids)

        # 3. Merge results: semantic first, then keyword matches not already found
        seen_contents = {doc.page_content[:200] for doc in semantic_docs}
        merged = list(semantic_docs)
        for doc in keyword_docs:
            if doc.page_content[:200] not in seen_contents:
                merged.append(doc)
                seen_contents.add(doc.page_content[:200])

        return merged[:k]

    def _keyword_search(
        self,
        query: str,
        k: int = 10,
        doc_ids: list[str] | None = None,
    ) -> list[Document]:
        """Search for documents containing query keywords using ChromaDB where_document."""
        try:
            collection = self.client.get_collection("documents")

            # Extract meaningful keywords (words with 3+ chars)
            keywords = [w for w in query.split() if len(w) >= 3]
            if not keywords:
                return []

            # Build where_document filter for keyword matching
            if len(keywords) == 1:
                where_doc = {"$contains": keywords[0]}
            else:
                where_doc = {"$or": [{"$contains": kw} for kw in keywords]}

            # Build metadata filter
            where_meta = None
            if doc_ids:
                where_meta = {"doc_id": {"$in": doc_ids}}

            results = collection.get(
                where_document=where_doc,
                where=where_meta,
                limit=k,
                include=["documents", "metadatas"],
            )

            docs = []
            for i, content in enumerate(results["documents"] or []):
                meta = results["metadatas"][i] if results["metadatas"] else {}
                docs.append(Document(page_content=content, metadata=meta))

            return docs
        except Exception:
            return []

    def delete_document(self, doc_id: str) -> bool:
        """Delete all chunks belonging to a document."""
        try:
            collection = self.client.get_collection("documents")
            # Get all IDs with matching doc_id
            results = collection.get(where={"doc_id": doc_id})
            if results["ids"]:
                collection.delete(ids=results["ids"])
            return True
        except Exception:
            return False

    def get_collection_count(self) -> int:
        """Get total number of chunks in the store."""
        try:
            collection = self.client.get_collection("documents")
            return collection.count()
        except Exception:
            return 0
