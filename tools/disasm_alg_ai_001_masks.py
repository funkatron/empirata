#!/usr/bin/env python3
"""Scan unpacked Interstel 2.05C image for ALG-AI-001 passability mask tables (0x618 family).

Usage:
  python3 tools/disasm_alg_ai_001_masks.py --image /path/to/EMPIRE_UNPACKED_IMAGE.bin --report /tmp/masks.txt

Emits 34-byte slices at army/fighter/ship-a/ship-b bases per DOS_ALGORITHM_RULESET.md.
Requires a local unpacked flat image (not committed to the repo).
"""

from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path

MASK_BASES = {
    "army": 0x618,
    "fighter": 0x67E,
    "ship_a": 0x6E4,
    "ship_b": 0x74A,
}
MASK_LEN = 0x22


def main() -> int:
    parser = argparse.ArgumentParser(description="Dump ALG-AI-001 mask bytes from unpacked EMPIRE image")
    parser.add_argument("--image", type=Path, required=True, help="Unpacked flat EMPIRE image (227408 bytes)")
    parser.add_argument("--report", type=Path, default=None, help="Write report path (default stdout)")
    args = parser.parse_args()
    data = args.image.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    lines = [f"image_bytes={len(data)}", f"sha256={digest}", ""]
    for name, base in MASK_BASES.items():
        end = base + MASK_LEN
        if end > len(data):
            lines.append(f"{name}: base 0x{base:X} OUT OF RANGE")
            continue
        chunk = data[base:end]
        hexes = " ".join(f"{b:02x}" for b in chunk)
        lines.append(f"{name}: base=0x{base:X} len=0x{MASK_LEN:X}")
        lines.append(hexes)
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