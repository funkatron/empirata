# Continuous production and larger invasions

## Final policy

Every owned city keeps producing. Cities without a stationed defender prioritize armies. Other factories complete needed ships or continuously produce armies; no army reserve count triggers an AI production pause. Captured cities select army production immediately. One stationed army per city is protected from AI deliberate boarding and automatic port pickup; human loading rules and intrinsic city defence remain unchanged. Replacements require normal production time.

Hostile cities can receive multiple transport assignments: at least two before an objective is considered fully assigned, with fresh observed defenders increasing demand. Nearby transports within three squares share a landing plan. Hostile landing readiness scales toward three armies per nearby transport, bounded by the available expedition and usable beach capacity. A regression covers a six-army landing from two transports and waiting for its ready force. This is not yet a long-distance rendezvous or synchronized arrival planner.

Reconnaissance drops use safe charted coastal frontiers with no fresh observed defender in attack range. A transport on a city mission needs at least four armies and a drop site more than eight squares from its city objective; it drops one army and retains at least three for the assault. Hidden defenders are not consulted. Distant landed scouts remain eligible to explore even on a landmass containing a friendly city.

## Verification checklist

- [x] 210 tests and coverage gates pass.
- [x] Four standalone bundle checks pass.
- [x] Continuous production above old reserve thresholds is tested.
- [x] Defender preservation during boarding and departure is tested, alongside unchanged human loading.
- [x] Multiple city defenders, missing defenders and transport supply are covered.
- [x] Coastal drops preserve assault strength and reject fresh threats.
- [x] Multi-transport assignment and a six-army coordinated landing are covered.
- [x] Three generated-map 100-round campaigns complete with final-save validation.

## Observations

These final-policy runs use seed 101, ordinary empty starts and three generated layouts. This short sweep checks operation, not balance or improved victory rate. It has no prepared cargo, scouting memory or repaired routes. The longer earlier reports are historical policy variants, not measurements of this final revision.

| Layout | Cities Blue/Red | Stationed defenders Blue/Red | Factories making armies Blue/Red |
|---|---|---|---|
| continents | 4/1 | 4/1 | 4/1 |
| islands | 1/1 | 1/1 | 0/0 |
| archipelago | 2/1 | 1/1 | 2/0 |

A newly captured city can lack a mobile defender until normal production supplies it. A factory not making armies in this table may be making ships; the production policy no longer pauses factories.

Raw data: [continuous-production.json](2026-10-30-continuous-production.json).

```sh
SEEDS=101 ROUNDS=100 node scripts/evaluate-ai.mjs
```
