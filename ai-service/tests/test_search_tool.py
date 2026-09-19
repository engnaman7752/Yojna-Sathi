import pytest
from app.agent import search_tool as st
from app.rag.retriever import Passage
from app import context


class StubRetriever:
    def __init__(self, passages): self.passages, self.calls = passages, []
    def search(self, query, *, scheme_id=None, state=None, top_k=5):
        self.calls.append({"query": query, "scheme_id": scheme_id, "state": state, "top_k": top_k})
        return self.passages


P = Passage(text="Submit Form A at the block office.", scheme_id="ignwps", version=1,
            page=12, page_end=12, doc_id="nsap-guidelines",
            source_url="https://example.gov.in/nsap.pdf", score=0.81, headings="2. How to apply")


async def test_returns_citations_as_fields_not_prose():
    st.set_retriever(StubRetriever([P]))
    context.call_trace.set([])
    out = await st.search_scheme_docs(query="how do I apply", schemeId="ignwps", state="BIHAR")
    passage = out["content"][0]["json"]["passages"][0]
    assert passage["schemeId"] == "ignwps"
    assert passage["page"] == 12
    assert passage["sourceUrl"] == "https://example.gov.in/nsap.pdf"
    assert set(passage) >= {"text", "schemeId", "version", "page", "docId", "sourceUrl"}


async def test_passes_the_scheme_and_state_filters_through():
    stub = StubRetriever([P]); st.set_retriever(stub)
    context.call_trace.set([])
    await st.search_scheme_docs(query="deadline", schemeId="ignwps", state="BIHAR")
    assert stub.calls[0] == {"query": "deadline", "scheme_id": "ignwps", "state": "BIHAR", "top_k": 5}


async def test_no_results_is_a_success_with_an_explicit_note():
    st.set_retriever(StubRetriever([]))
    context.call_trace.set([])
    out = await st.search_scheme_docs(query="something not in any document")
    assert out["status"] == "success"
    assert out["content"][0]["json"]["passages"] == []
    assert "No published document" in out["content"][0]["json"]["note"]


async def test_tool_schema_exposes_only_query_scheme_and_state():
    spec = st.search_scheme_docs.tool_spec["inputSchema"]["json"]
    assert set(spec["properties"]) == {"query", "schemeId", "state"}
    assert spec["required"] == ["query"]
