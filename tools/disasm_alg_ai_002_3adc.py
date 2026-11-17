#!/usr/bin/env python3
"""Static triage for ALG-AI-002 subroutine 0x3ADC (invasion threat reachability).

Reads a privately supplied unpacked Interstel 2.05C program image (not the
packed EMPIRE.EXE). Does not upload or redistribute game bytes.

Expected unpacked image SHA-256:
  0a06eba8ef371847e8c818703ba51e7ab5ef91b732643ca4e422e26923ba8166

Usage:
  python3 tools/disasm_alg_ai_002_3adc.py /path/to/EMPIRE_UNPACKED_IMAGE.bin
"""
from __future__ import annotations

import argparse
import hashlib
import re
import struct
import subprocess
import sys
from pathlib import Path

KNOWN_UNPACKED_SHA256 = (
    "0a06eba8ef371847e8c818703ba51e7ab5ef91b732643ca4e422e26923ba8166"
)
ANCHOR = 0x3ADC
WINDOW = 0x180


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def disasm_window(data: bytes, base: int, size: int) -> str:
    tmp = Path("/tmp/empire_snip.bin")
    tmp.write_bytes(data[base : base + size])
    try:
        proc = subprocess.run(
            [
                "objdump",
                "-D",
                "-b",
                "binary",
                "-mi8086",
                "-Mintel",
                f"--adjust-vma={base:#x}",
                str(tmp),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        return proc.stdout
    finally:
        tmp.unlink(missing_ok=True)


def nearby_cmp_immediates(dump: str) -> list[tuple[str, int]]:
    hits: list[tuple[str, int]] = []
    for line in dump.splitlines():
        m = re.search(r"\bcmp\b.*(0x[0-9a-f]+|#[0-9]+)", line, re.I)
        if m:
            raw = m.group(1).lstrip("#")
            try:
                hits.append((line.strip(), int(raw, 0)))
            except ValueError:
                continue
    return hits


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path, help="Unpacked program image")
    parser.add_argument("--anchor", type=lambda x: int(x, 0), default=ANCHOR)
    parser.add_argument("--window", type=lambda x: int(x, 0), default=WINDOW)
    args = parser.parse_args()
    raw = args.image.read_bytes()
    digest = sha256(args.image)
    print(f"sha256={digest}")
    if digest != KNOWN_UNPACKED_SHA256:
        print(
            "warning: SHA-256 does not match the documented unpacked image",
            file=sys.stderr,
        )
    lo = max(0, args.anchor - args.window // 2)
    hi = min(len(raw), args.anchor + args.window // 2)
    if args.anchor >= len(raw):
        parser.error(f"anchor {args.anchor:#x} past end of image ({len(raw)} bytes)")
    dump = disasm_window(raw, lo, hi - lo)
    print(f"\n--- disassembly {lo:#x}..{hi:#x} (anchor {args.anchor:#x}) ---\n")
    print(dump)
    imms = nearby_cmp_immediates(dump)
    interesting = [(ln, v) for ln, v in imms if v in (0x14, 0x13, 0x15, 20, 19, 21)]
    if interesting:
        print("\n--- cmp immediates near 0x14 (20 slots?) ---")
        for ln, v in interesting:
            print(f"  {v}: {ln}")


if __name__ == "__main__":
    main()