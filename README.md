# Empirata

A browser-based, classic-rules strategy wargame based on the **gameplay** of *Empire: Wargame of the Century* (Interstel DOS version 2.05).

**[Play the current development build](https://funkatron.github.io/empirata/)** · [Classic rules specification](docs/Empirata_Classic_Rules_Specification_v0.1.md) · [Implementation status](docs/ENGINE_STATUS.md)

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

## Development

The site is entirely static; GitHub Pages hosts `index.html` in the repository root. To work locally:

```bash
npm run build
npm test
node scripts/build-single-file.cjs
npm start
```

The root `index.html` embeds all JS and CSS. All engine code is in `src/engine`, UI in `src/ui`, tests in `tests`, and original rules/specification in `docs`. No proprietary *Empire* code, artwork or map assets are distributed.
