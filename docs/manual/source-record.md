# Manual source and reading record

## Source identity

- Title: *Empire: Wargame of the Century*, Star Fleet Planetary Task Force
  Command Manual; Interstel IBM PC v2.05, second printing August 1988
  (edition from the transcription/cover record; executable target remains 2.05C).
- [Hosting page and transcription](https://oldgamesdownload.com/manual/empire-wargame-of-the-century-dos-manual-english/).
- [Downloaded original scan](https://oldgamesdownload.com/wp-content/uploads/manuals/empire-wargame-of-the-century_dos_manual_en_gb4.pdf).
- Retrieved: 2026-10-30.
- SHA-256: `f1173d95910ea9658b954177936753191bd15e1efd61027073f9b910e90bb1cd`.
- Size: 15,647,461 bytes; 40 PDF pages; paired printed-page spreads.
- Extraction: Poppler `pdftotext -layout`; selected spreads rendered with
  `pdftoppm -scale-to 1800 -png` and visually inspected.
- Code comparison: deployed/main `731f0433b09d624ef98271d45e080ddd9c701ea9`.
  PR #19 is discussed separately, not silently treated as deployed.

The scan is externally hosted; no copyrighted manual or full transcription is
committed here. These documents are selective research notes and original
implementation analysis, not a replacement copy of the manual.

## Reading coverage

| Material | Review performed | Remaining limit |
| --- | --- | --- |
| Contents and overview | Text; section inventory | Not every front-matter image inspected |
| Setup and efficiencies, pp. 9–19 | Text, including opponent rules and map selection | Precise rating formula/executable not reconstructed |
| Units, movement and combat, pp. 20–29 | Text; scans of pp. 22–27 | pp. 20–21 and 28–29 images still unchecked |
| Modes/command tables, pp. 30–35 | Text and inventory | Full visual command-availability matrix still unchecked |
| Commands, pp. 36–53 | Text; scans of pp. 46–49 | Remaining command-page images and DOS interactions still unchecked |
| Strategy, pp. 54–57 | Text and both complete scan spreads | Advice is not evidence of original AI code |
| Map creation, pp. 58–64 | Text | Visual validator details and original MAP format unverified |
| Credits/history, pp. 65–67 | Text | Historical claims not independently corroborated |
| Installation, fiction, warranty/index | Overview/contents only | No claim of detailed verification or gameplay significance |

This is a substantial gameplay/strategy reading pass, not completion of the
roadmap's exhaustive page-by-page visual audit or independent second review.

## Reproduce selected checks

Download the linked PDF, compare its SHA-256 and byte size, then run:

```sh
pdfinfo manual.pdf
pdftotext -layout manual.pdf manual-layout.txt
pdftoppm -f 16 -l 18 -scale-to 1800 -png manual.pdf rules
pdftoppm -f 28 -l 29 -scale-to 1800 -png manual.pdf orders
pdftoppm -f 32 -l 33 -scale-to 1800 -png manual.pdf strategy
```

PDF page numbers above are one-based. Printed page 22 is the left half of PDF
page 16, not PDF page 22. For printed pages 2–69 the mapping is
`PDF page = floor(printed page / 2) + 5`; check printed footers because scans
can crop margins. Page 40 contains repeated warranty/index material.
