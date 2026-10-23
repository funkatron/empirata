#!/usr/bin/env python3
"""Triage tool for candidate timer/RNG call sites in a 16-bit DOS MZ executable.

This cannot identify a PRNG by itself. Results must be verified by 8086
control-flow disassembly and runtime traces. Uses only Python's stdlib.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import struct

# Signatures are *clues*, not validated function boundaries or references.
SIGNATURES: dict[str, bytes] = {
    "BIOS timer interrupt (INT 1Ah)": bytes.fromhex("CD 1A"),
    "DOS interrupt (INT 21h; generic)": bytes.fromhex("CD 21"),
    "DOS time service (MOV AH,2Ch; INT 21h)": bytes.fromhex("B4 2C CD 21"),
    "DOS time service (MOV AX,2C00h; INT 21h)": bytes.fromhex("B8 00 2C CD 21"),
    "BIOS clock tick memory offset (006Ch)": bytes.fromhex("6C 00"),
}


def examine(raw: bytes, max_matches: int = 12) -> dict:
    if len(raw) < 28 or raw[:2] != b"MZ":
        raise ValueError("Not a DOS MZ executable (missing MZ header)")
    last_page, pages, relocations, header_paras, minalloc, maxalloc, ss, sp, checksum, ip, cs, relocation_offset, overlay = struct.unpack_from("<13H", raw, 2)
    header_size = header_paras * 16
    declared_size = (pages - 1) * 512 + (last_page if last_page else 512) if pages else 0
    if header_size < 28 or header_size > len(raw):
        raise ValueError("Invalid MZ header length")
    body = raw[header_size:]
    matches: dict[str, list[dict]] = {}
    for name, signature in SIGNATURES.items():
        hits = []
        start = 0
        while len(hits) < max_matches:
            n = body.find(signature, start)
            if n < 0:
                break
            hits.append({
                "file_offset_hex": f"0x{header_size + n:06X}",
                "load_image_offset_hex": f"0x{n:06X}",
                "nearby_bytes": body[max(0, n-8): min(len(body), n+len(signature)+8)].hex(" "),
            })
            start = n + 1
        matches[name] = hits
    return {
        "sha256": hashlib.sha256(raw).hexdigest(),
        "actual_file_size": len(raw),
        "mz_declared_size": declared_size,
        "header_size": header_size,
        "relocation_entries": relocations,
        "initial_CS_IP": f"{cs:04X}:{ip:04X}",
        "initial_SS_SP": f"{ss:04X}:{sp:04X}",
        "file_image_bytes": len(body),
        "candidates": matches,
        "interpretation": "Only raw byte-pattern candidates, not proven executed code or a recovered RNG.",
        "next_step": "Disassemble near candidates, identify seed updates and RNG callers, then trace under a DOS debugger.",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("executable", type=Path, help="Original DOS MZ executable; do not distribute it")
    parser.add_argument("--max-matches", type=int, default=12, help="Maximum shown matches per signature")
    args = parser.parse_args()
    if args.max_matches <= 0:
        parser.error("--max-matches must be positive")
    try:
        print(json.dumps(examine(args.executable.read_bytes(), args.max_matches), indent=2))
    except (ValueError, OSError) as exc:
        parser.error(str(exc))


if __name__ == "__main__":
    main()
