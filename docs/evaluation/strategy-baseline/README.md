# Strategy baseline: collection protocol

This directory records observations of source commit `579784a19403f673298199b326163931d7cc4688` before strategic AI changes. The work changes evaluation tooling, not the controller.

## Design

- Main matrix: three map layouts × three seeds (17, 83, 211) × two faction placements × two city densities = 36 campaigns.
- A 64-city world is generated first. Its two starting cities and terrain are identical in the matched 12-city subset; the remaining ten sparse cities are the first neutral cities in deterministic generation order.
- Distant starts use the existing farthest-pair selection. The six supplementary nearby-rival cases use seed 83, 64 cities, both faction placements, and a 12–25-square separation; selection favors coastal cities on different land components when available.
- Main targets are 200 rounds, except six dense seed-17 campaigns targeting 300. Nearby-rival targets are 150. Each worker has a 180-second wall-clock budget, checked between complete rounds. A single slow round can exceed the deadline.
- Four campaign workers run at once. Separate verification and integration checks also used the shared host. Timings include observation overhead and shared-host contention; they are **not iPad/browser measurements**. Time-limit results are censored, not defeats or completed campaigns.

The matrix has nine independently generated terrain/seed combinations, not 36 statistically independent maps. Faction swaps and density pairs share terrain. These generated maps do not enforce all original DOS map-validation constraints. They are a controlled laboratory sample, not representative player-win probabilities.

## Measurements

`manifest.json` and `pressure-manifest.json` describe exact jobs. Each compressed `runs/*.json.gz` file (ordinary JSON when reproduced) contains initial terrain/state hashes, city positions and ownership, round-level count/time arrays (column names are in the manifest), regular state summaries, transport movement records, landing and capture events, unit removals, production and logistics counters, final random state/hash, and save-validation status.

Observation hooks run only in a disposable `study-engine/` copy of the TypeScript build. They capture legal ordinary transport moves **after automatic loading and before movement**, including departure load and hull capacity. This avoids missing a voyage that begins and ends between round snapshots. Moves accomplished by combat advancement are not part of this ordinary-movement series. No hook provides information to AI decisions.

Game and combat log hooks retain events before the normal rolling log can drop them. Sentry wake messages and scenario setup messages are not collected by these log hooks. Naval unit removal records include embarked cargo; army removals also include victorious armies absorbed into city garrisons and must **not** all be counted as combat deaths. Faction identity is restored from the unchanged player label during the Blue AI's internal faction swap.

`probe-validation.json` records equal full game states between unmodified and observed engines for six clean campaigns and two movement/combat fixtures. It includes actual transport-move and removal probes. These are safeguards against measurement changing behavior, not proof that every possible execution is unaffected.

### Interpretation rules

- A landing event is not necessarily overseas conquest; troops can disembark near their original landmass.
- Repeated landings by one army are counted separately from unique delivered armies. Repetition alone does not prove an erroneous reboarding loop.
- Port departure loads exclude beach departures. Loaded move steps are movement events, not unique voyages; repeated steps must not inflate departure statistics.
- Five-round landing totals combine a faction's landings at potentially unrelated locations. They are an **upper bound** on concentration, not proof of a coordinated assault on one objective.
- A landed army later absorbed into a captured city's garrison gives traceable capture participation, not a causal treatment-effect estimate. Many useful landed armies can survive without capturing a city themselves.
- Unembarked armies include guards, scouts, assault troops, and troops in transit. They are not all idle or available for overseas recruitment.
- Compare fixed-round checkpoints before endpoint totals when time limits differ. Nearby-rival cases are a separate cohort.
- One baseline policy cannot establish that a proposed policy will improve play. There is no opponent-strength comparison or human-adversary test here.

## Reproduce

```sh
npm run build
node scripts/prepare-study-engine.mjs
node --test tests/campaign-study.test.mjs
node scripts/verify-study.mjs
STUDY_SHA=579784a19403f673298199b326163931d7cc4688 node scripts/campaign-study.mjs run
STUDY_SHA=579784a19403f673298199b326163931d7cc4688 node scripts/pressure-study.mjs
python scripts/summarize-campaign-study.py
```

Run the two cohorts sequentially to preserve the four-worker limit. Use `STUDY_OUT` to write a fresh output directory for collection and analysis; do not overwrite the committed baseline when comparing a policy. Wall-clock cutoffs and times can differ across machines. Reproduce exact states by executing the recorded number of rounds rather than reproducing a time cutoff. Use recorded state hashes to check equality.

The map builder retains its original 12-city/seven-square default; only study-specific calls request dense maps and smaller spacing. Preparation scripts fail if compiled probe anchors change. The observed engine is never used by application build or deployment.

## Integration checks and storage

The recorded integration check also compares #43 and corrected #44. To reproduce it, build those exact source commits in separate checkouts, set `HARBOR_ENGINE` and `NEUTRAL_ENGINE` to their engine `index.js` paths, set `HARBOR_SHA` and `NEUTRAL_SHA` to the recorded commits, then run `node scripts/check-pr-integration.mjs`. The baseline engine remains in the current checkout.

Run `node scripts/diagnose-study-maps.mjs`, `node scripts/validate-study.mjs`, `python scripts/summarize-campaign-study.py` and `python scripts/render-study-report.py` to inspect/rebuild analysis. Readers accept either freshly generated JSON or committed gzip JSON. `dataset-files.json` records compressed and uncompressed hashes; compression uses a fixed timestamp. `engine-provenance.json` verifies every baseline engine source blob against the GitHub tree and records compiled hashes.

The shipped analysis labels hostile-target port departures from pre-round actual ownership, excluding same-round captures as ambiguous. This is evaluation context, not a claim about enemy knowledge available to the AI. Retained hostile captures count distinct faction/city pairs, including recaptures, whose final owner matches that faction; capture events use a different denominator.
