"""Image pre-processing that measurably improves Tesseract accuracy on lab reports.

Kept deliberately simple and dependency-light (Pillow only): upscaling small
scans, converting to greyscale, boosting contrast and applying a light sharpen
are the steps that matter most for printed tabular text.
"""
from __future__ import annotations

import io

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

# Below this width Tesseract's accuracy on small print drops sharply.
MIN_WIDTH_FOR_OCR = 1600
MAX_WIDTH = 3500


def load_image(data: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(data))
    # Normalise EXIF rotation from phone photos of reports.
    try:
        image = ImageOps.exif_transpose(image)
    except Exception:
        pass
    return image


def preprocess(image: Image.Image) -> Image.Image:
    """Greyscale -> upscale -> autocontrast -> sharpen. Returns a new image."""
    if image.mode not in ("L", "RGB"):
        image = image.convert("RGB")

    grey = ImageOps.grayscale(image)

    width, height = grey.size
    if width < MIN_WIDTH_FOR_OCR and width > 0:
        scale = min(MIN_WIDTH_FOR_OCR / width, 3.0)
        grey = grey.resize(
            (int(width * scale), int(height * scale)), Image.LANCZOS
        )
    elif width > MAX_WIDTH:
        scale = MAX_WIDTH / width
        grey = grey.resize(
            (int(width * scale), int(height * scale)), Image.LANCZOS
        )

    grey = ImageOps.autocontrast(grey, cutoff=1)
    grey = ImageEnhance.Sharpness(grey).enhance(1.6)
    grey = grey.filter(ImageFilter.MedianFilter(size=3))
    return grey
