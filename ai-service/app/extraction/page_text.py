"""
Page-wise text for a scheme document.

Two jobs, and the order matters. First take whatever text layer the PDF already
has, because it is exact and free. Only where that layer is missing or too thin
to be real does a page go to the model for transcription - a scanned circular
has no text layer at all, and guessing at an empty string would silently drop a
page of eligibility rules.

The output is saved page by page with 1-based page numbers, because that is what
an evidence citation refers to and what Phase 7 has to chunk on. Page 1 of a PDF
is page 1 here, not page 0.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Callable, Literal

from pypdf import PdfReader

TextSource = Literal["text_layer", "model", "empty"]

# A page with fewer characters than this is treated as having no usable text
# layer. 100 is a starting point chosen so that a sparse cover page still counts
# as text while a scanned image does not; it should be tuned against the real
# corpus once there is one, using the chars_per_sq_inch recorded on every page.
DEFAULT_MIN_CHARS_PER_PAGE = 100

# A transcriber is given the document path and a 1-based page number and returns
# that page's text. It is injected rather than imported so that the extraction
# path can be tested without a model, and so that Java never ends up calling one.
Transcriber = Callable[[Path, int], str]


@dataclass
class PageText:
    page: int                      # 1-based, as an evidence citation means it
    text: str
    source: TextSource
    char_count: int
    chars_per_sq_inch: float


@dataclass
class DocumentText:
    doc_id: str
    sha256: str
    page_count: int
    pages: list[PageText] = field(default_factory=list)

    @property
    def transcribed_pages(self) -> list[int]:
        return [p.page for p in self.pages if p.source == "model"]

    @property
    def empty_pages(self) -> list[int]:
        return [p.page for p in self.pages if p.source == "empty"]


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def _page_area_sq_inches(page) -> float:
    box = page.mediabox
    width_in = float(box.width) / 72.0
    height_in = float(box.height) / 72.0
    area = width_in * height_in
    return area if area > 0 else 1.0


def extract_pages(
    pdf_path: str | Path,
    *,
    doc_id: str | None = None,
    transcribe: Transcriber | None = None,
    min_chars_per_page: int = DEFAULT_MIN_CHARS_PER_PAGE,
) -> DocumentText:
    """Read every page, falling back to the model only where the text layer fails.

    With no transcriber supplied, a page that has no usable text layer is
    recorded as source="empty" rather than being quietly filled in. The caller
    can then decide whether to refuse the document.
    """
    path = Path(pdf_path)
    reader = PdfReader(str(path))
    document = DocumentText(
        doc_id=doc_id or path.stem,
        sha256=sha256_of(path),
        page_count=len(reader.pages),
    )

    for index, page in enumerate(reader.pages):
        page_number = index + 1
        layer_text = (page.extract_text() or "").strip()
        area = _page_area_sq_inches(page)

        if len(layer_text) >= min_chars_per_page:
            text, source = layer_text, "text_layer"
        elif transcribe is not None:
            text, source = (transcribe(path, page_number) or "").strip(), "model"
        else:
            text, source = layer_text, "empty"

        document.pages.append(
            PageText(
                page=page_number,
                text=text,
                source=source,
                char_count=len(text),
                chars_per_sq_inch=round(len(layer_text) / area, 3),
            )
        )
    return document


def save_page_text(document: DocumentText, out_dir: str | Path) -> Path:
    """Persist page-wise text for Phase 7 to chunk and cite."""
    directory = Path(out_dir)
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / f"{document.doc_id}.pages.json"
    payload = {
        "docId": document.doc_id,
        "sha256": document.sha256,
        "pageCount": document.page_count,
        "transcribedPages": document.transcribed_pages,
        "emptyPages": document.empty_pages,
        "pages": [asdict(p) for p in document.pages],
    }
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return target


def load_page_text(doc_id: str, directory: str | Path) -> DocumentText:
    payload = json.loads((Path(directory) / f"{doc_id}.pages.json").read_text(encoding="utf-8"))
    document = DocumentText(
        doc_id=payload["docId"], sha256=payload["sha256"], page_count=payload["pageCount"]
    )
    document.pages = [PageText(**p) for p in payload["pages"]]
    return document


def page_of(document: DocumentText, page_number: int) -> PageText | None:
    """The page an evidence citation points at, or None if it is out of range."""
    for page in document.pages:
        if page.page == page_number:
            return page
    return None
