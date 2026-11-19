#!/usr/bin/env python3
"""Disassemble a window of the private Interstel 2.05C unpacked EMPIRE flat image.

Use on the user's machine only — never commit game binaries.

Typical paths:
  $HOME/private/interstel/EMPIRE_UNPACKED_IMAGE.bin

Expected unpacked SHA-256 (reconstructed MZ digest; see ruleset §0):
  0a06eba8ef371847e8c818703ba51e7ab5ef91b732643ca4e422e26923ba8166

Examples:
  python3 tools/disasm_empire_anchor.py "$EMPIRE_IMAGE" --anchor 0x4600 --label escort-close-range
  python3 tools/disasm_empire_anchor.py "$EMPIRE_IMAGE" --anchor 0x4C52 --label legalize-direction
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


def far_calls(data: bytes, lo: int, hi: int) -> list[tuple[int, int, int]]:
    out: list[tuple[int, int, int]] = []
    i = lo
    while i < hi - 4:
        if data[i] == 0x9A:
            off, seg = struct.unpack_from("<HH", data, i + 1)
            out.append((i, off, seg))
            i += 5
            continue
        i += 1
    return out


def near_calls(data: bytes, lo: int, hi: int) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    i = lo
    while i < hi - 2:
        if data[i] == 0xE8:
            rel = struct.unpack_from("<h", data, i + 1)[0]
            out.append((i, i + 3 + rel))
            i += 3
            continue
        i += 1
    return out


def interesting_cmp_lines(dump: str) -> list[str]:
    """Highlight immediates that often matter in ALG-AI-001 (8, 14/0x14, 19/0x19)."""
    want = {0x8, 0x14, 0x19, 0x7D, 0x4}
    hits: list[str] = []
    for line in dump.splitlines():
        if "cmp" not in line.lower():
            continue
        for token in re.findall(r"0x[0-9a-f]+|#[0-9]+", line, re.I):
            try:
                imm = int(token.lstrip("#"), 0)
            except ValueError:
                continue
            if imm in want:
                hits.append(line.strip())
                break
    return hits


def main() -> int:
    parser = argparse.ArgumentParser(description="Disassemble one anchor in the unpacked EMPIRE image")
    parser.add_argument("image", type=Path, help="Unpacked flat EMPIRE image (~227408 bytes)")
    parser.add_argument("--anchor", type=lambda x: int(x, 0), default=0x4600, help="Linear file offset (default 0x4600 escort)")
    parser.add_argument("--window", type=lambda x: int(x, 0), default=0x280, help="Bytes to disassemble")
    parser.add_argument("--label", default="anchor", help="Report section title")
    parser.add_argument(
        "--expect-sha256",
        default=KNOWN_UNPACKED_SHA256,
        help="Fail if image digest differs (empty to skip check)",
    )
    parser.add_argument("--report", type=Path, default=None, help="Write report (default stdout)")
    args = parser.parse_args()

    if not args.image.is_file():
        print(f"error: image not found: {args.image}", file=sys.stderr)
        return 2

    digest = sha256(args.image)
    if args.expect_sha256 and digest != args.expect_sha256.lower():
        print(
            f"error: sha256 mismatch\n  got  {digest}\n  want {args.expect_sha256}",
            file=sys.stderr,
        )
        return 2

    data = args.image.read_bytes()
    lo = max(0, args.anchor - 0x40)
    hi = min(len(data), args.anchor + args.window)
    dump = disasm_window(data, lo, hi - lo)

    lines = [
        f"label={args.label}",
        f"anchor=0x{args.anchor:X}",
        f"window=[0x{lo:X},0x{hi:X})",
        f"sha256={digest}",
        "",
        "## Far calls (9A off:seg) in window",
    ]
    for site, off, seg in far_calls(data, lo, hi):
        lines.append(f"  0x{site:X} -> {seg:04X}:{off:04X}")
    lines.append("")
    lines.append("## Near calls (E8) in window")
    for site, dest in near_calls(data, lo, hi):
        lines.append(f"  0x{site:X} -> 0x{dest:X}")
    lines.append("")
    lines.append("## cmp / loop hints (8, 0x14, 0x19, 0x4, 0x7D)")
    for row in interesting_cmp_lines(dump):
        lines.append(f"  {row}")
    lines.append("")
    lines.append("## objdump")
    lines.append(dump)

    text = "\n".join(lines)
    if args.report:
        args.report.write_text(text, encoding="utf-8")
        print(f"wrote {args.report}", file=sys.stderr)
    else:
        print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())