# Reconnaissance target selection: next bounded experiment

Status: investigation, not an AI-strength claim. Branch: `research/scout-targeting-after-pr50`.

## Problem

PR #50 makes destroyers and mobile ground scouts consider stale sightings, and returns loaded transports without useful missions toward friendly ports. The round-524 replay moved all 14 originally stranded transports outside ports, but discovered no new city within ten rounds. The next change must increase purposeful scouting without turning loaded transports into explorers or using omniscient evaluator knowledge.

## Hypothesis

When no hostile or neutral city is currently known, ranking reachable reconnaissance frontiers by stale-contact proximity, unexplored coverage and travel cost will reduce time to useful discovery relative to #50, without increasing scout losses or disrupting assigned escorts and city defenders.

## Implementation slice

1. Capture a deterministic, faction-private candidate list for each eligible destroyer and mobile, non-garrison army. Include reachable route length, unseen cells visible from the candidate, stale contact age and distance, and whether another scout already targets the same area.
2. Prefer reachable frontiers near recent or clustered stale sightings. Fall back to other reachable unexplored terrain when no useful stale-contact frontier remains. Reassess after observing the location or discovering a city. Avoid repeated loops to exhausted targets.
3. Do not redirect committed escorts, stationed city guards, loaded transports, or fighters. Fighter relocation is a separate fuel-safety experiment.

## Verification checklist

- [ ] Same private view produces the same target and step after save/reload.
- [ ] Altering hidden enemy cities/units without changing faction-visible knowledge does not alter target selection.
- [ ] Swapping faction labels on equivalent maps preserves decisions.
- [ ] A reachable stale-contact frontier outranks an otherwise equivalent distant unexplored frontier.
- [ ] Exhausted or unreachable stale sightings do not trap scouts in loops.
- [ ] Scouts avoid duplicate assignments when another eligible scout can cover a distinct frontier.
- [ ] Existing escort commitments and city guards are preserved.
- [ ] Node 24 build, engine tests, bundle smoke checks and CI pass; inspect Copilot reviews.

## Evidence and stop criteria

Use Continents seed 83 round-524 as a diagnostic, not as the optimization target. Also run held-out continents, islands and archipelago maps with swapped factions, and longer campaigns beyond the previous six 60-round checks.

Report: turns to first new hostile/neutral city, newly explored useful land, stale contacts investigated, unique frontiers visited, scout losses, landings, city captures and transport cargo held idle. Compare identical seeds and starts against #50 main. Reject changes that merely increase movement without useful discoveries or that cause unacceptable losses. Do not claim improved playing strength without longer held-out results.

No release version change is warranted for the investigation. Do not merge or deploy without explicit authorization.
