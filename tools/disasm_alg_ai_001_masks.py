#!/usr/bin/env python3
"""Scan unpacked Interstel 2.05C image for ALG-AI-001 passability mask tables.

Static image anchor **[D]**: four profiles × four players × 0x22 bytes at **0x2E410**
(Raiden trace; DS `0x618` is not a flat-file offset).

Usage:
  python3 tools/disasm_alg_ai_001_masks.py --image /path/to/EMPIRE_UNPACKED_IMAGE.bin
  python3 tools/disasm_alg_ai_001_masks.py --image … --report /tmp/masks.txt
"""
from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path

MASK_IMAGE_BASE = 0x2E410
PROFILES = ("army", "fighter", "ship_a", "ship_b")
PLAYERS = 4
MASK_LEN = 0x22


def slice_masks(data: bytes) -> dict[str, list[list[int]]]:
    out: dict[str, list[list[int]]] = {}
    for pi, name in enumerate(PROFILES):
        base = MASK_IMAGE_BASE + pi * PLAYERS * MASK_LEN
        rows: list[list[int]] = []
        for p in range(PLAYERS):
            chunk = data[base + p * MASK_LEN : base + p * MASK_LEN + MASK_LEN]
            rows.append([i for i, b in enumerate(chunk) if b != 0])
        out[name] = rows
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Dump ALG-AI-001 mask allow-lists from unpacked EMPIRE image")
    parser.add_argument("--image", type=Path, required=True, help="Unpacked flat EMPIRE image (227408 bytes)")
    parser.add_argument("--report", type=Path, default=None, help="Write report path (default stdout)")
    args = parser.parse_args()
    data = args.image.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    lines = [
        f"image_bytes={len(data)}",
        f"sha256={digest}",
        f"mask_image_base=0x{MASK_IMAGE_BASE:X}",
        "",
    ]
    masks = slice_masks(data)
    for name, rows in masks.items():
        lines.append(f"{name}:")
        for p, nz in enumerate(rows):
            lines.append(f"  player {p}: passable glyphs {nz}")
        lines.append("")
    out = "\n".join(lines)
    if args.report:
        args.report.write_text(out, encoding="utf-8")
        print(f"wrote {args.report}", file=sys.stderr)
    else:
        print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())