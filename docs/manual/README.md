# Interstel manual research

This reference separates printed rules, strategic advice, implementation evidence,
and unanswered executable questions. It supplements the classic specification;
it does not certify DOS parity.

## Start here

- [Reading and source record](source-record.md): edition, reproducible scan identity,
  page mapping and what was actually checked.
- [Strategy and tactics](strategy.md): campaign phases, unit roles and experiments.
- [Rules and implementation findings](findings.md): confirmed discrepancies and
  unresolved algorithms, with concrete verification tasks.
- [Section index](section-index.md): find a topic by printed page or scan spread.

## Evidence labels

| Label | Meaning |
| --- | --- |
| Scan | Passage or table visually inspected in the downloaded PDF |
| Text | Extracted PDF text read; image-level verification remains |
| Code | Present code path inspected; passing tests do not establish historical equivalence |
| Advice | Manual recommendation for human play; not a mandatory rule or original AI algorithm |
| Proposal | Modern implementation or evaluation idea derived from evidence |

A scan can settle what the manual says without settling what DOS 2.05C actually
does. Preserve both when they disagree. Do not import pre-Interstel Empire or
Empire Deluxe behavior without edition-specific evidence.

## Current research result

The strongest new evidence is visual confirmation of submarine detection by
cities, combat factor exceptions, cargo damage timing, city-garrison semantics,
production saturation, fighter patrol constraints and coordinated invasion advice.
No game rules or AI policy change in this research PR. PR #19 remains a separate
unmerged strategy change at the time of this reading.
