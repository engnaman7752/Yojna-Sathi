"""
Turn page text into retrievable chunks.

Two constraints shape this. A citation has to name a page, so a chunk always
knows which page it started on and which it ended on, and never loses that by
merging pages blindly. And a heading is what tells you whether a paragraph is
about eligibility or about how to apply, so a heading is never separated from
the text beneath it - a chunk that says "within 30 days" is useless if the
reader cannot see it sat under "Appeals".
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from typing import Callable, Iterable

DEFAULT_TARGET_TOKENS = 600
DEFAULT_OVERLAP_TOKENS = 80

# Roughly four characters per token. This is an approximation, and it fails in a
# specific direction for Devanagari: a Hindi syllable typically costs MORE than
# one token, so chars/4 UNDER-counts and a Hindi chunk comes out LARGER than the
# target - which risks exceeding the embedding model's input limit rather than
# merely wasting space. Pass a real tokenizer as token_counter before indexing
# any Hindi document in anger.
def approx_tokens(text: str) -> int:
    return max(1, len(text) // 4)


TokenCounter = Callable[[str], int]

_HEADING_NUMBERED = re.compile(r"^\s*(\d+(\.\d+)*)[.)]?\s+\S")
_DEVANAGARI = re.compile(r"[ऀ-ॿ]")


def looks_like_heading(line: str) -> bool:
    """Conservative: a false negative costs context, a false positive splits text."""
    stripped = line.strip()
    if not stripped or len(stripped) > 90:
        return False
    if stripped.endswith((".", "।", ",", ";", ":")) and not _HEADING_NUMBERED.match(stripped):
        return False
    if _HEADING_NUMBERED.match(stripped):
        return True
    letters = [c for c in stripped if c.isalpha()]
    if letters and all(c.isupper() for c in letters):
        return True
    return False


def detect_language(text: str) -> str:
    """'hi' if the text is substantially Devanagari, else 'en'. Crude on purpose."""
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return "en"
    devanagari = len(_DEVANAGARI.findall(text))
    return "hi" if devanagari / len(letters) > 0.2 else "en"


@dataclass
class Chunk:
    chunk_id: str
    text: str
    scheme_id: str
    version: int
    state: str
    language: str
    page: int          # the page the chunk starts on, 1-based
    page_end: int
    doc_id: str
    source_url: str | None = None
    headings: list[str] = field(default_factory=list)
    token_estimate: int = 0

    def metadata(self) -> dict:
        """Chroma metadata. Flat scalars only; headings are joined for filtering."""
        return {
            "schemeId": self.scheme_id,
            "version": self.version,
            "state": self.state,
            "language": self.language,
            "page": self.page,
            "pageEnd": self.page_end,
            "docId": self.doc_id,
            "sourceUrl": self.source_url or "",
            "headings": " > ".join(self.headings),
        }


@dataclass
class _Line:
    text: str
    page: int
    is_heading: bool


def _lines_from_pages(pages: Iterable) -> list[_Line]:
    out: list[_Line] = []
    for page in pages:
        page_number = page["page"] if isinstance(page, dict) else page.page
        text = page["text"] if isinstance(page, dict) else page.text
        for raw in (text or "").splitlines():
            if raw.strip():
                out.append(_Line(raw.strip(), page_number, looks_like_heading(raw)))
    return out


def stable_chunk_id(scheme_id: str, version: int, doc_id: str, ordinal: int) -> str:
    """Deterministic, so re-indexing the same version replaces rather than duplicates."""
    seed = f"{scheme_id}|{version}|{doc_id}|{ordinal}"
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()[:32]


def chunk_pages(
    pages: Iterable,
    *,
    scheme_id: str,
    version: int,
    state: str,
    doc_id: str,
    source_url: str | None = None,
    language: str | None = None,
    target_tokens: int = DEFAULT_TARGET_TOKENS,
    overlap_tokens: int = DEFAULT_OVERLAP_TOKENS,
    token_counter: TokenCounter = approx_tokens,
) -> list[Chunk]:
    lines = _lines_from_pages(pages)
    if not lines:
        return []

    chunks: list[Chunk] = []
    current: list[_Line] = []
    heading_stack: list[str] = []
    tokens = 0

    def flush() -> None:
        nonlocal current, tokens
        if not current:
            return
        body = "\n".join(line.text for line in current)
        ordinal = len(chunks)
        chunks.append(
            Chunk(
                chunk_id=stable_chunk_id(scheme_id, version, doc_id, ordinal),
                text=body,
                scheme_id=scheme_id,
                version=version,
                state=state,
                language=language or detect_language(body),
                page=min(line.page for line in current),
                page_end=max(line.page for line in current),
                doc_id=doc_id,
                source_url=source_url,
                headings=list(heading_stack),
                token_estimate=token_counter(body),
            )
        )
        # Carry the tail forward so a sentence split across the boundary is
        # still retrievable from either side.
        carried: list[_Line] = []
        carried_tokens = 0
        for line in reversed(current):
            cost = token_counter(line.text)
            if carried_tokens + cost > overlap_tokens:
                break
            carried.insert(0, line)
            carried_tokens += cost
        current = carried
        tokens = carried_tokens

    for index, line in enumerate(lines):
        cost = token_counter(line.text)

        if line.is_heading:
            # Never end a chunk on a heading: break before it instead, so the
            # heading travels with the text it introduces.
            if tokens + cost > target_tokens:
                flush()
            heading_stack = [line.text]
        elif tokens + cost > target_tokens:
            flush()

        current.append(line)
        tokens += cost

        is_last = index == len(lines) - 1
        if is_last:
            body = "\n".join(l.text for l in current)
            ordinal = len(chunks)
            chunks.append(
                Chunk(
                    chunk_id=stable_chunk_id(scheme_id, version, doc_id, ordinal),
                    text=body,
                    scheme_id=scheme_id,
                    version=version,
                    state=state,
                    language=language or detect_language(body),
                    page=min(l.page for l in current),
                    page_end=max(l.page for l in current),
                    doc_id=doc_id,
                    source_url=source_url,
                    headings=list(heading_stack),
                    token_estimate=token_counter(body),
                )
            )
    return chunks
