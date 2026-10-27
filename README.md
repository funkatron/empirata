# Empirata

A browser-based, classic-rules strategy wargame based on the **gameplay** of *Empire: Wargame of the Century* (Interstel DOS version 2.05).

**[Play the current development build](https://funkatron.github.io/empirata/)** · [Classic rules specification](docs/Empirata_Classic_Rules_Specification_v0.1.md) · [Implementation status](docs/ENGINE_STATUS.md) · [Development roadmap](docs/ROADMAP.md)

## Version 0.4 — First genuinely interactive skirmish

**Close Quarters** is the default starting test scenario. Unlike v0.3, it uses actual randomized encounters, **not** buttons that prescribe who wins. Its layout is an original, intentionally compact fixture rather than a historical Interstel opening.

- **Combat:** select a blue unit, then tap an adjacent red unit. Each hit is assigned by the probability described in the Interstel 2.05 manual; damaged units retain their damage, and a fight destroys one participant. Unit type determines damage per hit.
- **Conquest:** select a blue army, then tap a nearby neutral city. At normal combat efficiency, the capture attempt has a 50% chance of success. A victorious army becomes the city garrison and is removed from active units; a defeated army is also removed.
- **More armies:** two additional blue armies are positioned within assault range of the frontier city, allowing retry/testing without immediately rebuilding or restarting the world.
- **Naval combat:** a blue destroyer is adjacent to a red submarine. Destroyers detect submarines; submarines inflict 3 damage per hit.
- **Opponent response:** after you select **Next round**, a preliminary red computer opponent makes legal moves and may attack/capture. It sees only its own faction's visible or remembered information; its *strategy* is not a claim of original AI parity.
- **Production and saves:** city unit production, fog of war, local saves, JSON import/export, map pan/zoom, keyboard and iPad touch control remain available.

### Try it on an iPad

1. Open **https://funkatron.github.io/empirata/** in Safari.
2. Press **New skirmish** to replace an older saved scenario (export your save first if needed).
3. The blue army is selected. Tap the adjacent red **A** to fight, or select one of the other blue armies and tap the nearby gold city to attempt capture.
4. Select the blue **D**, then the adjacent red **S**, for naval combat.
5. Press **Next round** to give the computer opponent a turn and reset your own units' movement.

**There are no scripted win/loss buttons.** The combat results are random but **reproducible from saved game state**, which is valuable for diagnosing bugs.

### Historical fidelity and its limits

The Interstel 2.05 manual explicitly explains that damage is awarded by repeated weighted hit rolls, with equal (50/50) hit allocation for two normal-efficiency opponents. Cities use the attacker's combat efficiency to determine capture, which is 50% at the ordinary setting. Higher efficiency weights combat-hit allocation; hit **damage** remains unit-specific.

We follow those **documented odds**, but the original DOS PRNG, seeding, and sequence of calls have not been verified from the executable. Empirata uses a local seeded xorshift RNG, so its random outcomes are **not guaranteed to match the original executable turn-for-turn**. This is a known fidelity gap, not a gameplay-enhancement rule.

Other remaining limits: simplified red AI; unfinished troop transport/carrier loading, automatic standing orders, and victory conditions; historical maps not imported; exact production timing and some submarine detection details still need executable confirmation. The old “Original test map” remains available as a passive rules test fixture.

## Current logistics work (in development)

The source now contains **troop transport embarkation/landing** and **carrier fighter boarding/launching**, including cargo movement with ships, friendly-port unloading/refueling and cargo losses on ship destruction. Close Quarters has friendly transport/army and carrier/fighter pairs for hands-on use once the latest browser bundle is deployed.

To try the controls in an updated build: select an army and tap an adjacent friendly **T** to board; select the **T**, then a listed embarked army and tap adjacent land to disembark. For aircraft, select a fighter and tap an adjacent friendly **V** to board; select its cargo fighter and tap an empty adjacent square to launch.

**Verification note:** These mechanics and their tests have been committed to the source repository, but the current GitHub Pages build has not been independently confirmed to include them. Original-DOS loading-order, fuel timing and carrier cargo-loss selection still need reference comparisons.

## Development

The site is entirely static. CI builds and smoke-tests the standalone `index.html`, packages that exact file, and deploys it to GitHub Pages only after verification succeeds on `main`. Pull requests test and package the site without deploying. The checked-in root bundle is not the deployment source.

**Hosting setup:** In repository **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**. This replaces branch-based publishing. After merging, confirm both the `verify` and `deploy` jobs succeed before treating the live site as updated. A manual workflow run on `main` can retry deployment; it reruns verification first.

To work locally:

```bash
npm run build
npm test
node scripts/build-single-file.cjs
npm start
```

The root `index.html` embeds all JS and CSS. All engine code is in `src/engine`, UI in `src/ui`, tests in `tests`, and original rules/specification in `docs`. No proprietary *Empire* code, artwork or map assets are distributed.

### Computer opponent — early strategic behavior (October 2026)

Close Quarters' Red opponent now selects army or transport production based on its existing forces, loads nearby friendly armies into transports, and can land troops near non-Red cities it has actually discovered. Loaded transports avoid reflexively unloading at their own ports. These are intentionally basic deterministic heuristics, not a claim of reconstructing the original Interstel AI.

The regular test suite includes focused no-omniscience and production-transition tests. Long campaigns or DOS emulation are not required for ordinary CI. Naval route-finding, genuine inter-island invasions and opponent balance remain works in progress.

### Computer versus computer (experimental)

Select **Computer vs computer · clean start** in the Game menu. Each faction
begins with one city, no mobile units, fresh city-only intelligence and zero
production progress. The AI chooses production on its turn; advance rounds to
watch units finish and begin exploring. The map remains the fixed lab terrain,
and exact original DOS start placement is not verified.

**Computer skirmish · staged test** retains the prepared Close Quarters forces
for tactical regression checks. Both modes use the same provisional strategy
and ordinary movement, combat, production and fog-of-war rules. Use **Next
round**, **+10 rounds**, or **Play / Pause** to inspect a match.
**Observe** defaults to **Alternate each round**, switching the map between
Blue's and Red's private intelligence after each simulated round. You can
instead lock the map to Blue or Red. Compact scorecards show **both players'
city and unit totals simultaneously**; the map never merges private terrain
knowledge or reveals the entire world. Changing the viewpoint does not change
the game state. Playback pauses when
the tab is hidden. Save/export and import work between rounds.

These are deterministic **experimental AI modes**, not reconstructions of the
original DOS opponent. The staged fixture intentionally places forces near combat;
the clean opening evaluates development from production. The game does not run in the background when
the tab is hidden.

CI run `40366834046` passed **146/146 tests** on 2026-10-26, including a
20-round autonomous endurance test, hidden-objective checks, and exact
save/reload replay. Standalone bundle build and smoke test also passed.
