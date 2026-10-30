# City defence, expedition supply and coastal reconnaissance

## Policy

Each owned city reserves one army stationed there. Reserved defenders hold position and are excluded from AI boarding and automatic pickup when AI ships depart. Human loading rules remain unchanged. A city lacking a defender prioritizes army production; existing units are not granted or repaired. Captured cities and losses therefore take normal production time to acquire a replacement.

Every owned factory stays active. A city without a defender produces armies; otherwise it completes needed ships or produces armies continuously. Army counts never trigger an AI production pause. Fleet targets remain scalable without a fixed ship ceiling. Producing a defender and expedition troops takes normal time; there are no free replacements.

Safe reconnaissance coasts must be charted, vacant, outside fresh enemy army attack range, and connected to an unknown frontier. Nearby supply/scouts suppress duplicate drops. Expeditions without a city mission can land one scout; an expedition with a city mission may do so only far from its city objective and with at least four carried armies, leaving at least three for the assault. Stale sightings are advisory, not proof that a coast is defended. Hidden units are not consulted.

Stationing an army does not change classic city-capture probabilities or intrinsic city defence. This is a unit-allocation policy, not a new combat rule.

## Verification checklist

- [x] City defenders survive AI boarding and automatic port departure.
- [x] Human automatic pickup remains available.
- [x] Undefended city production overrides large remote reserves.
- [x] Army production continues above the old eight-army threshold.
- [x] Multiple cities retain separate defenders.
- [x] Distant apparently unguarded coasts permit a scout drop, while fresh defenders and insufficient assault reserves prohibit it.
- [x] Save/replay remains deterministic.

## Generated campaign observations

Three seed-101 layouts run for 200 rounds each using the existing clean-start generator. Normal final-save import validation passes. All 20 final owned cities have a stationed army. This checks the final snapshots, not uninterrupted defence immediately after capture or loss.

| Layout | Cities Blue/Red | Defended cities Blue/Red | Factories making armies Blue/Red |
|---|---|---|---|
| continents | 4/2 | 4/2 | 0/0 |
| islands | 4/3 | 4/3 | 2/0 |
| archipelago | 6/1 | 6/1 | 4/1 |

These are observations of the amended combined strategy, not evidence of a win-rate or balance improvement. The earlier fleet report records a previous policy revision and must not be treated as the final implementation's measurements. More seeds, swapped starts and longer horizons remain useful.

Raw observations: [city-defence.json](2026-10-30-city-defence.json).

```sh
SEEDS=101 ROUNDS=200 node scripts/evaluate-ai.mjs
```

The snapshot observations above predate removal of production pauses. Updated continuous-production observations are recorded separately in the continuous-production report.
