"""Extraction routing, against real PDFs built in the test."""

import io
import struct
import zlib
from pathlib import Path

import pytest
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from app.extraction.page_text import (extract_pages, load_page_text, page_of,
                                      save_page_text, sha256_of)

TEXT_PAGES = [
    ["INDIRA GANDHI NATIONAL WIDOW PENSION SCHEME", "", "1. Eligibility",
     "The applicant must be a widow.",
     "The applicant must be between 40 and 79 years of age.",
     "The household must be below the poverty line as per State criteria."],
    ["2. Exclusions", "", "An applicant already drawing another State pension",
     "is not eligible under this scheme.",
     "Applicants who are income tax payers are excluded."],
]


def _grey_png(w: int, h: int) -> bytes:
    raw = b"".join(b"\x00" + bytes([210] * 3 * w) for _ in range(h))
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


@pytest.fixture(scope="module")
def pdfs(tmp_path_factory) -> dict[str, Path]:
    directory = tmp_path_factory.mktemp("pdfs")
    image = ImageReader(io.BytesIO(_grey_png(600, 850)))

    text_pdf = directory / "text_layer.pdf"
    c = canvas.Canvas(str(text_pdf), pagesize=A4)
    for page in TEXT_PAGES:
        y = 800
        for line in page:
            c.drawString(60, y, line); y -= 20
        c.showPage()
    c.save()

    scanned = directory / "scanned.pdf"
    c = canvas.Canvas(str(scanned), pagesize=A4)
    for _ in range(2):
        c.drawImage(image, 20, 20, width=550, height=780); c.showPage()
    c.save()

    mixed = directory / "mixed.pdf"
    c = canvas.Canvas(str(mixed), pagesize=A4)
    c.drawImage(image, 20, 20, width=550, height=780); c.showPage()
    y = 800
    for line in TEXT_PAGES[0]:
        c.drawString(60, y, line); y -= 20
    c.showPage()
    c.save()

    return {"text": text_pdf, "scanned": scanned, "mixed": mixed}


def test_uses_the_text_layer_and_never_calls_the_model_for_it(pdfs):
    calls = []
    doc = extract_pages(pdfs["text"], transcribe=lambda p, n: calls.append(n) or "X")
    assert [p.source for p in doc.pages] == ["text_layer", "text_layer"]
    assert calls == [], "the model was called for a page that already had text"
    assert "widow" in doc.pages[0].text


def test_pages_are_one_based_so_evidence_citations_line_up(pdfs):
    doc = extract_pages(pdfs["text"])
    assert [p.page for p in doc.pages] == [1, 2]
    assert page_of(doc, 1) is doc.pages[0]
    assert page_of(doc, 0) is None
    assert page_of(doc, 99) is None


def test_a_scanned_document_goes_to_the_model(pdfs):
    seen = []
    def transcribe(path, page_number):
        seen.append(page_number)
        return f"transcribed page {page_number}"
    doc = extract_pages(pdfs["scanned"], transcribe=transcribe)
    assert seen == [1, 2]
    assert [p.source for p in doc.pages] == ["model", "model"]
    assert doc.transcribed_pages == [1, 2]


def test_a_mixed_document_transcribes_only_the_pages_that_need_it(pdfs):
    seen = []
    doc = extract_pages(pdfs["mixed"], transcribe=lambda p, n: seen.append(n) or "scanned cover")
    assert seen == [1], "only the image-only page should reach the model"
    assert [p.source for p in doc.pages] == ["model", "text_layer"]


def test_without_a_transcriber_a_blank_page_is_reported_not_invented(pdfs):
    doc = extract_pages(pdfs["scanned"])
    assert [p.source for p in doc.pages] == ["empty", "empty"]
    assert doc.empty_pages == [1, 2]
    assert all(p.text == "" for p in doc.pages)


def test_density_is_recorded_for_tuning_the_threshold(pdfs):
    doc = extract_pages(pdfs["text"])
    assert doc.pages[0].chars_per_sq_inch > 0
    scanned = extract_pages(pdfs["scanned"])
    assert scanned.pages[0].chars_per_sq_inch == 0.0


def test_threshold_is_adjustable(pdfs):
    strict = extract_pages(pdfs["text"], min_chars_per_page=10_000)
    assert [p.source for p in strict.pages] == ["empty", "empty"]


def test_hash_identifies_the_file_for_duplicate_rejection(pdfs, tmp_path):
    copy = tmp_path / "same.pdf"
    copy.write_bytes(pdfs["text"].read_bytes())
    assert sha256_of(copy) == sha256_of(pdfs["text"])
    assert sha256_of(pdfs["scanned"]) != sha256_of(pdfs["text"])


def test_page_text_round_trips_for_phase_7(pdfs, tmp_path):
    doc = extract_pages(pdfs["mixed"], doc_id="ignwps-guidelines",
                        transcribe=lambda p, n: "scanned cover")
    written = save_page_text(doc, tmp_path)
    assert written.name == "ignwps-guidelines.pages.json"
    again = load_page_text("ignwps-guidelines", tmp_path)
    assert again.sha256 == doc.sha256
    assert [p.page for p in again.pages] == [1, 2]
    assert [p.source for p in again.pages] == ["model", "text_layer"]
