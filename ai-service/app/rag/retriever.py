"""
Retrieval over published scheme documents.

PROJECT_BRIEF.md rule 3: citizens only see published content, and draft
documents are never indexed or searchable. The caller enforces that by indexing
only on publish; this module enforces it a second time by refusing to index a
chunk whose version is not marked published. Two independent checks, because a
draft leaking into search is a rule violation a citizen would never detect.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable

from app.rag.chunking import Chunk


@dataclass
class Passage:
    """A retrieved passage. Citations are fields, never prose the model composes."""
    text: str
    scheme_id: str
    version: int
    page: int
    page_end: int
    doc_id: str
    source_url: str | None
    score: float
    headings: str = ""


@dataclass
class IndexResult:
    scheme_id: str
    version: int
    chunk_count: int
    deleted_previous: int


class NotPublished(RuntimeError):
    """Raised when something tries to index a version that is not published."""


@runtime_checkable
class Retriever(Protocol):
    """Chroma locally, Bedrock Knowledge Bases on AWS. One seam, two sides.

    BedrockKBRetriever in Phase 8 implements exactly this. Its search maps onto
    bedrock-agent-runtime retrieve(knowledgeBaseId=..., retrievalQuery={'text':...},
    retrievalConfiguration={'vectorSearchConfiguration': {'numberOfResults': k,
    'filter': {...}}}), whose retrievalResults carry content.text, location,
    score and a free-form metadata dict. The page number must be written into
    that metadata at ingestion, exactly as metadata() does here, or citations
    cannot name a page on AWS.
    """

    def index(self, chunks: list[Chunk], *, published: bool) -> IndexResult: ...
    def delete_version(self, scheme_id: str, version: int) -> int: ...
    def search(self, query: str, *, scheme_id: str | None = None,
               state: str | None = None, top_k: int = 5) -> list[Passage]: ...


class Embedder(Protocol):
    def embed_documents(self, texts: list[str]) -> list[list[float]]: ...
    def embed_query(self, text: str) -> list[float]: ...


class ChromaRetriever:
    """Chroma implementation. Embeddings are computed by us, not by Chroma, so
    the provider switch lives in providers/embeddings.py and the same vectors
    are produced wherever this runs."""

    COLLECTION = "scheme_docs"

    def __init__(self, client, embedder: Embedder, collection_name: str = COLLECTION):
        self._embedder = embedder
        # No embedding_function: we always pass embeddings explicitly.
        self._collection = client.get_or_create_collection(
            name=collection_name, embedding_function=None
        )

    def index(self, chunks: list[Chunk], *, published: bool) -> IndexResult:
        if not published:
            raise NotPublished(
                "Refusing to index an unpublished scheme version. Only published "
                "content is retrievable; indexing is triggered by publish, not by save."
            )
        if not chunks:
            return IndexResult("", 0, 0, 0)

        scheme_id = chunks[0].scheme_id
        version = chunks[0].version
        if any(c.scheme_id != scheme_id or c.version != version for c in chunks):
            raise ValueError("index() takes the chunks of one scheme version at a time.")

        # The previous version's chunks go first, so a search can never return a
        # passage from a version that is no longer live.
        deleted = self.delete_version_range(scheme_id, before_version=version)

        self._collection.add(
            ids=[c.chunk_id for c in chunks],
            documents=[c.text for c in chunks],
            metadatas=[c.metadata() for c in chunks],
            embeddings=self._embedder.embed_documents([c.text for c in chunks]),
        )
        return IndexResult(scheme_id, version, len(chunks), deleted)

    def _count_where(self, where: dict) -> int:
        return len(self._collection.get(where=where, include=[])["ids"])

    def delete_version(self, scheme_id: str, version: int) -> int:
        where = {"$and": [{"schemeId": {"$eq": scheme_id}}, {"version": {"$eq": version}}]}
        count = self._count_where(where)
        if count:
            self._collection.delete(where=where)
        return count

    def delete_version_range(self, scheme_id: str, *, before_version: int) -> int:
        """Every chunk of this scheme older than the version being indexed."""
        where = {"$and": [{"schemeId": {"$eq": scheme_id}},
                          {"version": {"$lt": before_version}}]}
        count = self._count_where(where)
        if count:
            self._collection.delete(where=where)
        return count

    def search(self, query: str, *, scheme_id: str | None = None,
               state: str | None = None, top_k: int = 5) -> list[Passage]:
        clauses: list[dict] = []
        if scheme_id:
            clauses.append({"schemeId": {"$eq": scheme_id}})
        if state:
            # A central scheme applies everywhere, so it is always in scope.
            clauses.append({"state": {"$in": [state, "ALL"]}})
        where = None
        if len(clauses) == 1:
            where = clauses[0]
        elif clauses:
            where = {"$and": clauses}

        result = self._collection.query(
            query_embeddings=[self._embedder.embed_query(query)],
            n_results=top_k,
            where=where,
            include=["documents", "metadatas", "distances"],
        )
        passages: list[Passage] = []
        for text, meta, distance in zip(
            result["documents"][0], result["metadatas"][0], result["distances"][0]
        ):
            passages.append(
                Passage(
                    text=text,
                    scheme_id=str(meta.get("schemeId", "")),
                    version=int(meta.get("version", 0)),
                    page=int(meta.get("page", 0)),
                    page_end=int(meta.get("pageEnd", meta.get("page", 0))),
                    doc_id=str(meta.get("docId", "")),
                    source_url=str(meta.get("sourceUrl") or "") or None,
                    score=round(1.0 - float(distance), 6),
                    headings=str(meta.get("headings", "")),
                )
            )
        return passages
