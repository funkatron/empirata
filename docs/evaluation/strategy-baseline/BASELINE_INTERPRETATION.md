# Historical baseline interpretation

This is the frozen interpretation of the committed 42-run baseline at source `579784a19403f673298199b326163931d7cc4688`. It is not regenerated for other datasets or policies. For statistics computed from the selected dataset, see [FINDINGS.md](FINDINGS.md).

**42 campaigns · 8,150 completed rounds · 84 faction observations.** Source: `579784a19403f673298199b326163931d7cc4688`.

The collection is complete, not the games: 32 runs reached their requested horizon and 10 hit the wall-clock limit. None reached elimination. All final saves validate and all unit-production/removal accounting checks pass.

## Comparable results at round 100

Every campaign reached round 100. The table uses only the 36 distant-start campaigns. Each row contains 12 faction observations from three seeds and swapped starts; these are paired observations, not 12 independent maps. Medians can therefore be fractional.

| Terrain | Cities in world | Median owned cities | Median armies ashore | Median transports | Total landing events |
| --- | ---: | ---: | ---: | ---: | ---: |
| continents | 12 | 3 | 17 | 0 | 0 |
| continents | 64 | 10 | 23 | 0.5 | 5 |
| islands | 12 | 1 | 2 | 1 | 0 |
| islands | 64 | 3.5 | 4 | 1 | 8 |
| archipelago | 12 | 1.5 | 3 | 1 | 4 |
| archipelago | 64 | 3 | 4 | 1 | 4 |

Dense cities enable much more expansion, particularly on continents. That expansion is primarily ground/neutral growth; city totals alone do not demonstrate a successful invasion policy. Sparse and dense maps share terrain and starting cities, but they are laboratory maps without full DOS validation.

## Observed events across each cohort’s full recorded horizon

These totals are descriptive, not equal-horizon rates. The distant cohort covers 7,250 rounds with varying endpoints; the nearby-rival cohort covers 900 rounds (six games × 150).

| Measurement | Distant starts: 36 games | Nearby rivals: 6 games |
| --- | ---: | ---: |
| Neutral-city capture events | 785 | 57 |
| Hostile-city capture events | 51 | 2 |
| Distinct faction/city pairs ever captured from a rival | 23 | 2 |
| Those pairs still held at the endpoint | 14 | 2 |
| Landing events | 996 | 45 |
| Unique landed armies, counted within each campaign | 892 | 44 |
| Additional landings by already-landed armies | 104 | 1 |
| Ordinary loaded transport move steps | 4,610 | 154 |
| Ordinary empty transport move steps | 7,490 | 226 |
| Observed loaded departures from ports | 349 | 37 |
| Full-load port departures | 28 | 0 |
| Port departures toward a still-hostile city | 15 | 2 |
| Full-load departures in that hostile subset | 1 | 0 |
| Transport hulls lost | 22 | 4 |
| Loaded transports lost | 9 | 2 |
| Cargo units lost with those transports | 17 | 2 |

The hostile-departure subset uses the city’s actual pre-round ownership as an evaluation label, not knowledge supplied to the AI. Departures on the same round as an ownership change are excluded as ambiguous. Beach departures are not counted in port-departure statistics. Most departures are for neutral expansion, so “fill every transport” would be an unsupported policy.

## Findings that change the plan

### 1. Hostile force preparation deserves a targeted test

In the distant cohort, 14 of 15 observed hostile-target port departures carried only one or two armies; one carried six. The nearby-rival cases added two such departures carrying one and three armies. These small samples motivate operation-specific recruitment and departure decisions. They do not establish that every hostile city needs 12–18 armies, or that waiting for full ships improves outcomes.

### 2. Repeated delivery needs diagnosis before production is increased

The distant cohort contains 104 additional landing events beyond the first landing of each army; nearby rivals add one. In `continents-17-swap-64`, Red recorded 33 landings by 14 armies, including one army landing five times. None of those 14 armies became a captured city’s garrison during the observed interval. Red nevertheless held 42 cities through other armies, so this is a localized logistics symptom, not a failure of the whole faction. Trace why those troops reboarded and what objective each landing served before declaring all repetitions erroneous.

### 3. Port access and throughput are different problems

Six of the 72 distant-start faction observations have no coastal city anywhere on their initial landmass. Four of those share a landmass with their opponent and can fight on land; the other two are the same isolated, portless position under faction swap. No production heuristic can build a ship there without changing the map or rules. Conversely, other endpoints have ports but no surviving transports, which requires separating late port capture, losses, production decisions, and supply routing. Armies ashore include guards, scouts and active ground forces; do not label them all idle.

### 4. Capture and retention must be measured separately

The distant cohort’s 51 hostile capture events affected 23 distinct faction/city pairs; 14 of those pairs remained held at their endpoints. Repeated trading and recapture explain why these are different denominators. A landing count or a single city capture cannot stand in for sustained conquest. Nearby starts still produced only two hostile capture events by round 150; proximity alone does not create a useful attack policy.

### 5. Computation limits the evidence as well as the experience

All ten wall-clock-limited cases are dense maps. The median of per-campaign mean round times was about 182 ms for sparse maps and 717 ms for dense maps on this shared host. These measurements include observation and concurrent workload overhead; they are not browser responsiveness or device benchmarks, nor a controlled timing comparison between policies. Profile the controller in an isolated process before choosing an optimization.

## Incorporating PRs #43 and #44

- **#43:** changes the default clean-campaign harbor, not the generated study worlds. Initial generated states are identical with and without the harbor change. Its geometry regression passes. Equal port offsets do not establish equal whole-map opportunity or win rates. A separate controlled default-map comparison remains necessary.
- **#44:** replaces clone-and-swap control with a shared faction-parameterized strategy. Review exposed a real landing regression and an invalid type annotation. The follow-up uses ship ownership in pure landing queries, retains public wrapper validation, and adds hostile-landing and faction-relabeling tests. It is a prerequisite for future strategy work, not a demonstrated strength improvement.
- Six 60-round generated comparisons at seed 83 match full decision state after excluding event-message wording; the direct Blue path corrects faction names embedded in messages. This is limited early preservation evidence. Full long-run strength and timing comparisons remain open.

See [PR integration observations](pr-integration.json), [map diagnostics](map-diagnostics.json), [summary](summary.json), [accounting validation](validation.json), and the [collection protocol](README.md). The strategic proposals are in [the overall plan](../../STRATEGY_AND_TACTICS_PLAN.md).
