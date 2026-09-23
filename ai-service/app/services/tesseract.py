"""Text extraction: PDF text layer first, Tesseract OCR as the fallback.

Why this order matters for the demo:
  * A digitally generated lab report (the common case, and what our sample data
    uses) carries a real text layer. Reading it is exact, instant and needs no
    external binary - so the pipeline works on any machine.
  * A scanned page or a photo has no text layer, so we rasterise with PyMuPDF
    (no Poppler dependency) and run genuine Tesseract OCR over it.

The caller always learns which path produced the text via `source`.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import fitz  # PyMuPDF

from ..config import get_settings
from .vision import load_image, preprocess

logger = logging.getLogger(__name__)

SOURCE_PDF_TEXT = "pdf_text_layer"
SOURCE_OCR = "tesseract_ocr"
SOURCE_MIXED = "pdf_text_layer+tesseract_ocr"


class ExtractionError(RuntimeError):
    """Raised when no text could be produced from the document at all."""


@dataclass
class ExtractionResult:
    text: str
    source: str
    pages: int
    warnings: list[str] = field(default_factory=list)
    ocr_available: bool = True

    def as_dict(self) -> dict[str, Any]:
        return {
            "text": self.text,
            "source": self.source,
            "pages": self.pages,
            "warnings": self.warnings,
            "ocrAvailable": self.ocr_available,
            "characters": len(self.text),
        }


def _ocr_image(image, settings) -> str:
    """Run Tesseract over a PIL image. Returns '' when OCR is unavailable."""
    if not settings.ocr_available:
        return ""
    import pytesseract

    pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd
    # --psm 6: assume a uniform block of text. Lab reports are tabular, and this
    # mode preserves line structure far better than the default for our parser.
    return pytesseract.image_to_string(
        image, lang=settings.ocr_language, config="--oem 3 --psm 6"
    )


def extract_from_pdf(data: bytes) -> ExtractionResult:
    settings = get_settings()
    warnings: list[str] = []

    try:
        document = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:  # corrupt / password protected
        raise ExtractionError(f"Could not open the PDF: {exc}") from exc

    page_count = document.page_count
    if page_count == 0:
        raise ExtractionError("The PDF contains no pages.")

    layer_chunks: list[str] = []
    for page in document:
        try:
            layer_chunks.append(page.get_text("text") or "")
        except Exception:
            layer_chunks.append("")

    layer_text = "\n".join(layer_chunks).strip()

    if len(layer_text) >= settings.text_layer_min_chars:
        document.close()
        return ExtractionResult(
            text=layer_text,
            source=SOURCE_PDF_TEXT,
            pages=page_count,
            warnings=warnings,
            ocr_available=settings.ocr_available,
        )

    # No usable text layer -> the PDF is a scan. Rasterise and OCR.
    if not settings.ocr_available:
        document.close()
        raise ExtractionError(
            "This PDF has no text layer, so it needs OCR, but the Tesseract engine "
            "was not found on this machine. Install Tesseract or set TESSERACT_CMD, "
            "or upload a digitally generated PDF."
        )

    if layer_text:
        warnings.append(
            "The PDF text layer was very sparse, so the pages were processed with OCR instead."
        )

    ocr_chunks: list[str] = []
    pages_to_read = min(page_count, settings.max_ocr_pages)
    if page_count > pages_to_read:
        warnings.append(
            f"Only the first {pages_to_read} of {page_count} pages were processed."
        )

    zoom = settings.ocr_dpi / 72.0
    matrix = fitz.Matrix(zoom, zoom)
    for index in range(pages_to_read):
        try:
            pixmap = document[index].get_pixmap(matrix=matrix)
            image = load_image(pixmap.tobytes("png"))
            ocr_chunks.append(_ocr_image(preprocess(image), settings))
        except Exception as exc:
            logger.warning("OCR failed on page %s: %s", index + 1, exc)
            warnings.append(f"Page {index + 1} could not be read.")

    document.close()
    text = "\n".join(chunk for chunk in ocr_chunks if chunk).strip()
    if not text:
        raise ExtractionError(
            "OCR ran but produced no readable text. The scan may be too low quality."
        )

    return ExtractionResult(
        text=text,
        source=SOURCE_MIXED if layer_text else SOURCE_OCR,
        pages=page_count,
        warnings=warnings,
        ocr_available=True,
    )


def extract_from_image(data: bytes) -> ExtractionResult:
    settings = get_settings()
    if not settings.ocr_available:
        raise ExtractionError(
            "Image reports require OCR, but the Tesseract engine was not found on "
            "this machine. Install Tesseract or set TESSERACT_CMD, or upload a PDF."
        )

    try:
        image = load_image(data)
    except Exception as exc:
        raise ExtractionError(f"Could not read the image: {exc}") from exc

    text = _ocr_image(preprocess(image), settings).strip()
    if not text:
        raise ExtractionError(
            "OCR ran but produced no readable text from this image."
        )

    return ExtractionResult(
        text=text, source=SOURCE_OCR, pages=1, warnings=[], ocr_available=True
    )


def extract_text(data: bytes, filename: str = "", content_type: str = "") -> ExtractionResult:
    """Dispatch on content type / extension. PDF and common image formats."""
    name = (filename or "").lower()
    ctype = (content_type or "").lower()

    if "pdf" in ctype or name.endswith(".pdf") or data[:5] == b"%PDF-":
        return extract_from_pdf(data)
    if ctype.startswith("image/") or name.endswith(
        (".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp")
    ):
        return extract_from_image(data)

    # Unknown type: sniff the magic bytes before giving up.
    if data[:8].startswith(b"\x89PNG") or data[:3] == b"\xff\xd8\xff":
        return extract_from_image(data)
    raise ExtractionError(
        "Unsupported file type. Please upload a PDF, PNG or JPEG medical report."
    )
