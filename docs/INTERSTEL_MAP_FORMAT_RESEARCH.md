# Interstel editor and `.MAP` research note

Status: **research track**, non-blocking for Empirata `organic-v1` procedural maps.
Last updated: 2026-11-12.

## What the manual establishes

Sources: classic rules spec IMP-010–017, manual section index pp. 58–64, strategy notes.

| Topic | Confidence | Finding |
|---|---|---|
| Grid | `[M]` | 60 rows × 100 columns; outer border impassable (58×98 playable) |
| Cell types | `[M]` | Land, sea, city (gameplay). Decorative coasts do not change movement |
| New game | `[M]` | Selects an existing `.MAP` (or random among installed maps). Does **not** generate a fresh world every start (IMP-013) |
| Typical density | `[M]` | About **60–70 cities**, terrain-dependent (IMP-014) |
| Editor features | `[M]` | Edit land/sea/cities; grow land/sea masses; scatter (“sprinkle”) cities; validate; load/save (IMP-015) |
| Lake ports | `[M]` / findings | Validator forbids cities that would trap ships on enclosed lakes |
| File format | `[?]` | Exact `.MAP` binary layout unverified (IMP-017 / V-07) |
| Editor growth algorithm | `[?]` | How “world growth” stamps land/sea is not recovered |
| Random map *selection* | `[?]` | Algorithm for picking among `.MAP` files unverified — distinct from generation |
| Start-city placement | `[?]` | Exact DOS start selection rules unverified |

## Empirata stance

- Ship **organic-v1** (and keep **ellipse-v1**) as labeled Empirata campaign geography.
- Do **not** claim Interstel editor parity until `.MAP` + growth routines are recovered with hashed binary evidence.
- Future classic path: decode `.MAP` → import authentic maps into Empirata tiles/cities → optionally mimic editor growth if ALG recovered.
- Commercial binaries and sample `.MAP` files stay **out of the public repository**; record hashes/sizes privately when analyzing.

## Suggested extraction order (when prioritized)

1. Locate `.MAP` load/save paths in the Interstel 2.05C image; record file size and header patterns from authorized private samples.
2. Map on-disk bytes → 100×60 terrain + city list (+ any ownership/production fields if present).
3. Document editor “grow” / “sprinkle” / “validate” call sites as ALG entries.
4. Only then consider an Empirata importer or editor-parity generator.

Until then, treat procedural organic maps as a **lab/campaign feature** with their own playability checklist ([`docs/evaluation/mapgen-playability.md`](evaluation/mapgen-playability.md)).

## Related Empirata IDs

- IMP-013–017, V-07 in the classic rules specification
- Extractor backlog item “MAP format / start placement” in `.cursor/agents/dos-algorithm-extractor.md`
- MF findings item on lake-trapped ports in `docs/manual/findings.md`
