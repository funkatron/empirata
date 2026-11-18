#!/usr/bin/env python3
"""Static triage for ALG-AI-002 subroutine 0x3ADC (invasion threat reachability).

Reads a privately supplied unpacked Interstel 2.05C program image (not the
packed EMPIRE.EXE). Does not upload or redistribute game bytes.

Expected unpacked image SHA-256:
  0a06eba8ef371847e8c818703ba51e7ab5ef91b732643ca4e422e26923ba8166

Usage:
  python3 tools/disasm_alg_ai_002_3adc.py /path/to/EMPIRE_UNPACKED_IMAGE.bin
  python3 tools/disasm_alg_ai_002_3adc.py /path/to/image.bin --report /tmp/3adc.txt
"""
from __future__ import annotations

import argparse
import hashlib
import re
import struct
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

KNOWN_UNPACKED_SHA256 = (
    "0a06eba8ef371847e8c818703ba51e7ab5ef91b732643ca4e422e26923ba8166"
)
ANCHOR_3ADC = 0x3ADC
ANCHOR_3490 = 0x3490
ANCHOR_SIGHT = 0x1E60C
PATHFINDER_OFF_PASSABILITY = 0x1ACE0  # ES:234 glyph test (ALG-AI-001 ruleset)
WINDOW_3ADC = 0x220
WINDOW_3490_PROLOGUE = 0x120
SCAN_REGION = (0x3400, 0x3F00)  # ALG-AI-002 production tree neighborhood


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


def near_call_targets(data: bytes, lo: int, hi: int) -> list[tuple[int, int]]:
    """Return (call_site, target) for E8 rel16 in [lo, hi)."""
    out: list[tuple[int, int]] = []
    i = lo
    while i < hi - 2:
        if data[i] == 0xE8:
            rel = struct.unpack_from("<h", data, i + 1)[0]
            dest = i + 3 + rel
            out.append((i, dest))
            i += 3
            continue
        i += 1
    return out


def far_call_sites(data: bytes, lo: int, hi: int) -> list[tuple[int, int, int]]:
    """Return (site, offset, segment) for 9A off seg."""
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


def find_byte_pattern(data: bytes, pattern: bytes, lo: int, hi: int) -> list[int]:
    hits: list[int] = []
    start = lo
    while start < hi:
        n = data.find(pattern, start, hi)
        if n < 0:
            break
        hits.append(n)
        start = n + 1
    return hits


@dataclass
class CmpHit:
    site: int
    imm: int
    line: str


def cmp_immediates_in_dump(dump: str, base: int) -> list[CmpHit]:
    hits: list[CmpHit] = []
    addr_re = re.compile(r"^\s*([0-9a-f]+):")
    for line in dump.splitlines():
        if "cmp" not in line.lower():
            continue
        m_addr = addr_re.match(line)
        if not m_addr:
            continue
        site = int(m_addr.group(1), 16)
        for token in re.findall(r"0x[0-9a-f]+|#[0-9]+", line, re.I):
            raw = token.lstrip("#")
            try:
                imm = int(raw, 0)
            except ValueError:
                continue
            hits.append(CmpHit(site, imm, line.strip()))
    return hits


FRESHNESS_LINE = re.compile(
    r"\b(test|and|or)\b.*\b(al|byte\b)",
    re.I,
)


def freshness_candidates(dump: str) -> list[str]:
    out: list[str] = []
    in_loop = False
    for line in dump.splitlines():
        low = line.lower()
        if "cmp" in low and "0x14" in low:
            in_loop = True
        if in_loop and ("call" in low or "9a" in low.split()):
            in_loop = False
        if in_loop and FRESHNESS_LINE.search(line):
            out.append(line.strip())
    return out


def format_report(raw: bytes, digest: str, hash_ok: bool) -> str:
    lines: list[str] = []
    w = lines.append
    w(f"sha256={digest}")
    w(f"hash_ok={hash_ok}")
    w("")

    lo, hi = SCAN_REGION
    calls = near_call_targets(raw, lo, hi)
    to_3adc = [(s, t) for s, t in calls if t == ANCHOR_3ADC]
    w(f"--- near calls (E8) targeting {ANCHOR_3ADC:#x} in {lo:#x}..{hi:#x} ---")
    if to_3adc:
        for site, _ in to_3adc:
            w(f"  call site {site:#x}")
    else:
        w("  (none — try far 9A from 0x3490 city loop or table dispatch)")
    w("")

    w(f"--- disassembly {ANCHOR_3ADC:#x} (±{WINDOW_3ADC // 2} bytes) ---")
    base = max(0, ANCHOR_3ADC - WINDOW_3ADC // 2)
    end = min(len(raw), base + WINDOW_3ADC)
    dump_3adc = disasm_window(raw, base, end - base)
    w(dump_3adc)

    cmps = cmp_immediates_in_dump(dump_3adc, base)
    slot_cmps = [c for c in cmps if c.imm in (0x14, 0x13, 0x15, 20, 19, 21)]
    w("--- cmp immediates near 20-slot bound ---")
    for c in slot_cmps:
        w(f"  {c.site:#x} imm={c.imm:#x}: {c.line}")

    fresh = freshness_candidates(dump_3adc)
    w("--- possible freshness bit tests before pathfinder (manual confirm) ---")
    if fresh:
        for ln in fresh:
            w(f"  {ln}")
    else:
        w("  (none in window — absence supports 'no fresh-only filter in-loop' [D] if confirmed)")
    w("")

    w(f"--- disassembly {ANCHOR_3490:#x} prologue ({WINDOW_3490_PROLOGUE:#x} bytes) ---")
    dump_3490 = disasm_window(raw, ANCHOR_3490, min(WINDOW_3490_PROLOGUE, len(raw) - ANCHOR_3490))
    w(dump_3490)
    cmps3490 = [c for c in cmp_immediates_in_dump(dump_3490, ANCHOR_3490) if c.imm == 0x14]
    w("--- cmp 0x14 in 0x3490 prologue (slot fill loops?) ---")
    for c in cmps3490:
        w(f"  {c.site:#x}: {c.line}")

    w(f"--- far calls (9A) in {lo:#x}..{hi:#x} (pathfinder / helpers) ---")
    for site, off, seg in far_call_sites(raw, lo, hi):
        w(f"  {site:#x}: call {seg:04x}:{off:04x}")

    # Byte scans for cmp reg, 0x14 and cmp ax, 0x14
    patterns = {
        "cmp ax, 0x14 (3D 14 00)": bytes.fromhex("3D 14 00"),
        "cmp cx, 0x14 (83 F9 14 or 81 F9 14 00 00)": bytes.fromhex("83 F9 14"),
        "cmp dx, 0x14 (83 FA 14)": bytes.fromhex("83 FA 14"),
        "cmp bx, 0x14 (83 FB 14)": bytes.fromhex("83 FB 14"),
    }
    w(f"--- raw byte patterns in {lo:#x}..{hi:#x} ---")
    for name, pat in patterns.items():
        hits = find_byte_pattern(raw, pat, lo, hi)
        w(f"  {name}: {[f'{h:#x}' for h in hits[:12]]}" + (" …" if len(hits) > 12 else ""))

    w("")
    w("--- stale vs fresh decision rubric (run on image) ---")
    w("  HIGH [D] stale included: slot source = chart sight table; loop has NO test on age/fresh")
    w("         byte before loading slot map index; invalid slots skipped only via sentinels.")
    w("  HIGH [D] fresh-only: loop skips entries unless flag==fresh (test/jnz pattern).")
    w("  Slot writers: xref from SI/DI base at 0x3ADC entry back to 0x3490 or 0x1E60C sight.")
    w("  Cross-check: 0x383D live-unit scan is separate — threat slots must not walk 84E[].")

    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path, help="Unpacked program image")
    parser.add_argument("--anchor", type=lambda x: int(x, 0), default=ANCHOR_3ADC)
    parser.add_argument("--report", type=Path, help="Write full report to file")
    args = parser.parse_args()
    raw = args.image.read_bytes()
    digest = sha256(args.image)
    hash_ok = digest == KNOWN_UNPACKED_SHA256
    if not hash_ok:
        print(
            "warning: SHA-256 does not match the documented unpacked image",
            file=sys.stderr,
        )
    report = format_report(raw, digest, hash_ok)
    if args.report:
        args.report.write_text(report, encoding="utf-8")
        print(f"wrote {args.report}")
    print(report)


if __name__ == "__main__":
    main()