# Q9 OODA plan — ALG-AI-002 production branches (2026-11-16)

## Observe

- Prior #132 chooser covered army / transport / grade-B destroyer only.
- DOS `0x3490` also gates **fighter** (`3×fighters < armies`), **carrier** (no carriers), inland army bias.

## Orient

- Extend `chooseClassicCityProduction` using live inventory counts; coastal checks for air/naval.
- Table-driven tests; no full `0x3490` tree in this PR.

## Decide

PR `cursor/q9-alg-ai-002-branches-85b7` (stack #135).

## Act

`npm test` → push → PR.