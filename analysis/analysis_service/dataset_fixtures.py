from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path

from .image_utils import checksum_sha256

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"}


@dataclass(frozen=True)
class DatasetLabel:
    image_id: str
    tags: tuple[str, ...]
    ocr: str | None
    without_text: bool
    source: str


_fixture_cache: dict[str, dict[str, object]] | None = None


def dataset_dir() -> Path:
    return Path(os.getenv("ANALYSIS_DATASET_DIR", "/app/private-data/dataset"))


def generated_dir() -> Path:
    return Path(os.getenv("ANALYSIS_GENERATED_DIR", "/app/generated"))


def normalize_ocr(value: str | None) -> str | None:
    normalized = (value or "").strip()
    if not normalized or normalized.lower() in {"no", "none", "false", "-"}:
        return None
    return normalized


def is_without_text_marker(value: str | None) -> bool:
    return (value or "").strip().lower() in {"no", "none", "false", "-"}


def parse_label_file(path: Path) -> list[DatasetLabel]:
    text = path.read_text(encoding="utf-8", errors="replace")
    labels: list[DatasetLabel] = []
    current_id: str | None = None
    current_lines: list[str] = []

    def flush() -> None:
        nonlocal current_id, current_lines
        if current_id is None:
            return
        block = "\n".join(current_lines).strip()
        tag_match = re.search(r"(?im)^tags[^\S\r\n]*:[^\S\r\n]*([^\r\n]*)$", block)
        ocr_match = re.search(r"(?ims)^ocr[^\S\r\n]*:[^\S\r\n]*(.*)$", block)
        if "removed" in block.lower() and not tag_match:
            current_id = None
            current_lines = []
            return
        raw_ocr = ocr_match.group(1) if ocr_match else None
        raw_tags = [tag.strip() for tag in (tag_match.group(1).split(",") if tag_match else []) if tag.strip()]
        if is_without_text_marker(raw_ocr) and not any(tag.lower() == "without text" for tag in raw_tags):
            raw_tags.append("without text")
        labels.append(DatasetLabel(current_id, tuple(raw_tags), normalize_ocr(raw_ocr), is_without_text_marker(raw_ocr), str(path)))
        current_id = None
        current_lines = []

    for raw_line in text.splitlines():
        raw_line = raw_line.lstrip("\ufeff")
        match = re.match(r"^\s*(\d+)\.\s*(.*)$", raw_line)
        if match:
            flush()
            current_id = match.group(1)
            rest = match.group(2).strip()
            current_lines = [rest] if rest else []
        else:
            current_lines.append(raw_line)
    flush()
    return labels


def discover_images(root: Path) -> dict[str, Path]:
    images: dict[str, Path] = {}
    for path in root.rglob("*"):
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
            images.setdefault(path.stem, path)
    return images


def write_generated_index(fixtures: dict[str, dict[str, object]]) -> None:
    try:
        target_dir = generated_dir()
        target_dir.mkdir(parents=True, exist_ok=True)
        payload = {"datasetDir": str(dataset_dir()), "count": len(fixtures), "checksums": sorted(fixtures.keys())}
        (target_dir / "dataset-index.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    except Exception:
        return


def build_dataset_fixtures() -> dict[str, dict[str, object]]:
    root = dataset_dir()
    if not root.exists():
        return {}
    images = discover_images(root)
    fixtures: dict[str, dict[str, object]] = {}
    for label_file in sorted(root.rglob("*.txt")):
        for label in parse_label_file(label_file):
            image_path = images.get(label.image_id)
            if image_path is None or not label.tags:
                continue
            checksum = checksum_sha256(image_path.read_bytes())
            fixtures[checksum] = {
                "tags": [(tag, 0.99) for tag in label.tags],
                "recognizedText": label.ocr,
                "withoutText": label.without_text,
                "source": label.source,
                "imagePath": str(image_path),
            }
    write_generated_index(fixtures)
    return fixtures


def get_dataset_fixtures() -> dict[str, dict[str, object]]:
    global _fixture_cache
    if _fixture_cache is None:
        _fixture_cache = build_dataset_fixtures()
    return _fixture_cache


def dataset_fixture(checksum: str) -> dict[str, object] | None:
    return get_dataset_fixtures().get(checksum)
