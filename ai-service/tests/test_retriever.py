"""ChromaRetriever against a real in-process Chroma, with a deterministic embedder."""

import hashlib
import math

import chromadb
import pytest

from app.rag.chunking import chunk_pages
from app.rag.retriever import ChromaRetriever, NotPublished, Passage

DIMS = 96


class BagOfWordsEmbedder:
    """Deterministic and offline. Term overlap drives similarity, which is enough
    to test filtering, deletion and ordering without a model."""

    def _vector(self, text: str) -> list[float]:
        vec = [0.0] * DIMS
        for word in text.lower().split():
            slot = int(hashlib.md5(word.encode()).hexdigest(), 16) % DIMS
            vec[slot] += 1.0
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]

    def embed_documents(self, texts): return [self._vector(t) for t in texts]
    def embed_query(self, text): return self._vector(text)


def pages(*texts):
    return [{"page": i + 1, "text": t} for i, t in enumerate(texts)]


def chunks_for(scheme_id, version, state, *texts, doc_id="doc"):
    return chunk_pages(pages(*texts), scheme_id=scheme_id, version=version, state=state,
                       doc_id=doc_id, source_url=f"https://example.gov.in/{scheme_id}.pdf",
                       target_tokens=10_000, overlap_tokens=0)


@pytest.fixture
def retriever():
    client = chromadb.EphemeralClient()
    return ChromaRetriever(client, BagOfWordsEmbedder(), collection_name=f"t{id(client)}")


def test_refuses_to_index_an_unpublished_version(retriever):
    with pytest.raises(NotPublished):
        retriever.index(chunks_for("ignwps", 1, "ALL", "draft text"), published=False)
    assert retriever.search("draft") == []


def test_indexes_a_published_version_and_returns_citation_fields(retriever):
    result = retriever.index(
        chunks_for("ignwps", 1, "ALL", "Submit Form A at the block office to apply."),
        published=True)
    assert result.chunk_count == 1 and result.scheme_id == "ignwps"

    found = retriever.search("how do I apply Form A", top_k=5)
    assert len(found) == 1
    p = found[0]
    assert isinstance(p, Passage)
    assert p.scheme_id == "ignwps" and p.version == 1 and p.page == 1
    assert p.source_url == "https://example.gov.in/ignwps.pdf"
    assert "Form A" in p.text


def test_publishing_a_new_version_removes_the_previous_one(retriever):
    retriever.index(chunks_for("ignwps", 1, "ALL",
                               "Applications close on 31 March each year."), published=True)
    assert any("31 March" in p.text for p in retriever.search("closing date", top_k=5))

    out = retriever.index(chunks_for("ignwps", 2, "ALL",
                                     "Applications close on 30 June each year."), published=True)
    assert out.deleted_previous == 1

    found = retriever.search("closing date", top_k=5)
    assert all(p.version == 2 for p in found), "a superseded version is still searchable"
    assert not any("31 March" in p.text for p in found)


def test_delete_version_removes_only_that_version(retriever):
    retriever.index(chunks_for("ignwps", 1, "ALL", "widow pension rules"), published=True)
    retriever.index(chunks_for("pm-kisan", 1, "ALL", "farmer income support rules"), published=True)
    assert retriever.delete_version("ignwps", 1) == 1
    remaining = retriever.search("rules", top_k=10)
    assert {p.scheme_id for p in remaining} == {"pm-kisan"}


def test_search_filters_to_one_scheme(retriever):
    retriever.index(chunks_for("ignwps", 1, "ALL", "documents needed: death certificate"), published=True)
    retriever.index(chunks_for("pm-kisan", 1, "ALL", "documents needed: land records"), published=True)
    found = retriever.search("documents needed", scheme_id="pm-kisan", top_k=5)
    assert {p.scheme_id for p in found} == {"pm-kisan"}


def test_state_filter_keeps_central_schemes_in_scope(retriever):
    retriever.index(chunks_for("ignwps", 1, "ALL", "central scheme benefits"), published=True)
    retriever.index(chunks_for("bihar-mvpy", 1, "BIHAR", "bihar scheme benefits"), published=True)
    retriever.index(chunks_for("other-state", 1, "KERALA", "kerala scheme benefits"), published=True)

    found = retriever.search("benefits", state="BIHAR", top_k=10)
    assert {p.scheme_id for p in found} == {"ignwps", "bihar-mvpy"}, \
        "a central scheme must stay in scope, another state's must not"


def test_reindexing_the_same_version_does_not_duplicate(retriever):
    c = chunks_for("ignwps", 1, "ALL", "Submit Form A at the block office.")
    retriever.index(c, published=True)
    retriever.index(c, published=True)   # same ids, add() upserts by id
    assert len(retriever.search("Form A", top_k=10)) == 1


def test_mixed_versions_in_one_index_call_are_refused(retriever):
    mixed = chunks_for("ignwps", 1, "ALL", "a") + chunks_for("ignwps", 2, "ALL", "b")
    with pytest.raises(ValueError):
        retriever.index(mixed, published=True)
