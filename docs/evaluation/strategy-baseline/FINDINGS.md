# Campaign observations

**42 campaigns · 8,150 completed rounds · 84 faction observations.**

This report is computed from the selected summary.json. Endpoint totals can change with wall-clock cutoffs. Campaigns can share geography and are not independent maps. Historical conclusions about the committed baseline are kept separately in BASELINE_INTERPRETATION.md; they do not describe a newly collected policy.

## Recorded campaign endpoints

| Status | Campaigns |
| --- | ---: |
| round-limit | 32 |
| time-limit | 10 |

## Comparable observations at round 100

Only recorded distant-start checkpoints are shown. The observation count states the denominator; missing checkpoints are not imputed. Medians can be fractional.

| Terrain | Cities in world | Faction observations | Median owned cities | Median armies ashore | Median transports | Total landing events |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| archipelago | 12 | 12 | 1.5 | 3 | 1 | 4 |
| archipelago | 64 | 12 | 3 | 4 | 1 | 4 |
| continents | 12 | 12 | 3 | 17 | 0 | 0 |
| continents | 64 | 12 | 10 | 23 | 0.5 | 5 |
| islands | 12 | 12 | 1 | 2 | 1 | 0 |
| islands | 64 | 12 | 3.5 | 4 | 1 | 8 |

## Full recorded horizons: distant

36 campaigns · 7,250 rounds · 72 faction observations. These totals are descriptive, not equal-horizon rates.

| Measurement | Total |
| --- | ---: |
| Neutral-city capture events | 785 |
| Hostile-city capture events | 51 |
| Distinct faction/city pairs captured from a rival | 23 |
| Those pairs still held at the endpoint | 14 |
| Landing events | 996 |
| Unique landed armies within each campaign | 892 |
| Additional landings by already-landed armies | 104 |
| Ordinary loaded transport move steps | 4,610 |
| Ordinary empty transport move steps | 7,490 |
| Observed loaded departures from ports | 349 |
| Full-load port departures | 28 |
| Port departures toward a still-hostile city | 15 |
| Full-load departures in that hostile subset | 1 |
| Transport hulls lost | 22 |
| Loaded transports lost | 9 |
| Cargo lost with transports | 17 |

Hostile-target port-departure cargo distribution: 1 armies: 11, 2 armies: 3, 6 armies: 1.

## Full recorded horizons: near

6 campaigns · 900 rounds · 12 faction observations. These totals are descriptive, not equal-horizon rates.

| Measurement | Total |
| --- | ---: |
| Neutral-city capture events | 57 |
| Hostile-city capture events | 2 |
| Distinct faction/city pairs captured from a rival | 2 |
| Those pairs still held at the endpoint | 2 |
| Landing events | 45 |
| Unique landed armies within each campaign | 44 |
| Additional landings by already-landed armies | 1 |
| Ordinary loaded transport move steps | 154 |
| Ordinary empty transport move steps | 226 |
| Observed loaded departures from ports | 37 |
| Full-load port departures | 0 |
| Port departures toward a still-hostile city | 2 |
| Full-load departures in that hostile subset | 0 |
| Transport hulls lost | 4 |
| Loaded transports lost | 2 |
| Cargo lost with transports | 2 |

Hostile-target port-departure cargo distribution: 1 armies: 1, 3 armies: 1.

## Interpretation limits

Hostile-departure labels use pre-round actual ownership as evaluation context, not AI knowledge. Same-round ownership changes are excluded as ambiguous. Beach departures are not included.

Repeated landing events are not automatically errors. Move steps are not voyages. Capture events, distinct faction/city pairs, and retained pairs use different denominators. Armies ashore include guards, scouts and active ground forces.

This generated report makes no claim that validation passed or that a policy improved play. Inspect validation.json and the collection protocol for the selected dataset. Compare equal-round checkpoints before drawing conclusions from unequal endpoint horizons.
