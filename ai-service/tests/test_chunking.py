from app.rag.chunking import (Chunk, approx_tokens, chunk_pages, detect_language,
                              looks_like_heading, stable_chunk_id)

PAGES = [
    {"page": 1, "text": "INDIRA GANDHI NATIONAL WIDOW PENSION SCHEME\n"
                        "1. Eligibility\n"
                        "The applicant must be a widow.\n"
                        "The applicant must be between 40 and 79 years of age.\n"},
    {"page": 2, "text": "2. How to apply\n"
                        "Submit Form A at the block office.\n"
                        "Applications close on 31 March each year.\n"},
]


def kw(**over):
    base = dict(scheme_id="ignwps", version=1, state="ALL", doc_id="nsap-guidelines",
                source_url="https://example.gov.in/nsap.pdf")
    base.update(over)
    return base


def test_headings_are_detected_conservatively():
    assert looks_like_heading("1. Eligibility")
    assert looks_like_heading("INDIRA GANDHI NATIONAL WIDOW PENSION SCHEME")
    assert looks_like_heading("2.1 Documents")
    assert not looks_like_heading("The applicant must be a widow.")
    assert not looks_like_heading("")
    assert not looks_like_heading("x" * 200)


def test_chunk_carries_the_heading_it_sits_under():
    chunks = chunk_pages(PAGES, **kw(), target_tokens=40, overlap_tokens=5)
    applying = [c for c in chunks if "Form A" in c.text][0]
    assert "2. How to apply" in applying.headings


def test_pages_are_recorded_so_a_citation_can_name_one():
    chunks = chunk_pages(PAGES, **kw(), target_tokens=10_000, overlap_tokens=0)
    assert chunks[0].page == 1 and chunks[0].page_end == 2


def test_metadata_carries_everything_a_citation_needs():
    meta = chunk_pages(PAGES, **kw())[0].metadata()
    assert meta["schemeId"] == "ignwps"
    assert meta["version"] == 1
    assert meta["state"] == "ALL"
    assert meta["sourceUrl"] == "https://example.gov.in/nsap.pdf"
    assert meta["page"] >= 1
    assert set(meta) == {"schemeId", "version", "state", "language", "page",
                         "pageEnd", "docId", "sourceUrl", "headings"}
    assert all(isinstance(v, (str, int, float, bool)) for v in meta.values()), \
        "Chroma metadata must be flat scalars"


def test_chunk_ids_are_stable_across_reindexing():
    a = chunk_pages(PAGES, **kw())
    b = chunk_pages(PAGES, **kw())
    assert [c.chunk_id for c in a] == [c.chunk_id for c in b]
    assert stable_chunk_id("ignwps", 1, "d", 0) != stable_chunk_id("ignwps", 2, "d", 0)


def test_a_new_version_gets_different_ids():
    v1 = chunk_pages(PAGES, **kw(version=1))
    v2 = chunk_pages(PAGES, **kw(version=2))
    assert set(c.chunk_id for c in v1).isdisjoint(c.chunk_id for c in v2)


def test_chunks_overlap_so_a_split_sentence_is_still_findable():
    long_pages = [{"page": 1, "text": "\n".join(f"Sentence number {i} about pensions." for i in range(80))}]
    chunks = chunk_pages(long_pages, **kw(), target_tokens=120, overlap_tokens=40)
    assert len(chunks) > 1
    shared = set(chunks[0].text.splitlines()) & set(chunks[1].text.splitlines())
    assert shared, "consecutive chunks should share their boundary lines"


def test_target_size_is_respected_within_a_tolerance():
    long_pages = [{"page": 1, "text": "\n".join(f"Line {i} of the scheme guidelines." for i in range(300))}]
    chunks = chunk_pages(long_pages, **kw(), target_tokens=600, overlap_tokens=80)
    assert all(c.token_estimate <= 900 for c in chunks), [c.token_estimate for c in chunks]
    assert len(chunks) >= 2


def test_language_detection_separates_hindi_from_english():
    assert detect_language("The applicant must be a widow.") == "en"
    assert detect_language("आवेदक विधवा होनी चाहिए।") == "hi"
    hindi = chunk_pages([{"page": 1, "text": "पात्रता\nआवेदक विधवा होनी चाहिए।"}], **kw())
    assert hindi[0].language == "hi"


def test_empty_input_yields_no_chunks():
    assert chunk_pages([], **kw()) == []
    assert chunk_pages([{"page": 1, "text": "   "}], **kw()) == []
