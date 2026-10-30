# Manual-to-code findings and verification queue

Comparison baseline: main/deployed `731f043`; strategy PR #19 remains separate.
No engine fixes are included in this research change. Severity describes gameplay
impact, not certainty of DOS implementation. Scan references use printed pages;
see the source record for PDF mapping and hash.

## Detection follow-up

A separate implementation PR addresses MF-01 and MF-12: city observers detect
adjacent submarines, while submarine-only coverage cannot detect armies or
fighters. Terrain visibility is kept separate. Per-update coverage sets serve
both fresh detection and stale-report invalidation without rescanning observers
for each contact. This is not a claim of a measured overall performance gain.

The new regression file `tests/manual-detection.test.mjs` covers all 64 unit-type
observer/target pairs, city range and save/reload, stale reports after detector
loss, and hidden submarine movement equivalence. Three tests failed against
`7922f54` before the implementation. The historical findings table below records
the pre-fix baseline; other findings remain open.

## Findings with direct implementation evidence

| ID / priority | Manual evidence | Code evidence and consequence | Concrete verification task |
| --- | --- | --- | --- |
| MF-01 / High | Scan p. 22 explicitly says cities can detect submarines | `knowledge.ts:detectedBy` accepts only cruiser/destroyer observers; a city alone cannot detect an adjacent submarine | Bare coastal city plus adjacent submarine must create fresh sighting; repeat outside range and with hidden-world variations |
| MF-02 / High | Scan p. 24 gives transport attack/defense 1/2, submarine defense 1/2, carrier attack 1/2; army defense 1/2 under bombardment | `combat.ts:resolveCombat` weights faction efficiencies but omits unit factors; default equal efficiencies make every pair allocate hits equally | Validate factor placement with DOS fixtures, then test probability ratios and fixed hit-sequence consequences; do not claim the manual specifies hit ordering |
| MF-03 / High | Scan pp. 26–27: damage cargo/repair rules; text p. 22: surplus transport cargo is lost on the next attempted move unless unloaded first | `game.ts:moveUnit` rejects overloaded transport movement instead of destroying surplus cargo; `adjudication.ts` handles carrier surplus immediately | Construct damaged overloaded transport, unload-before-moving and move-with-surplus cases; verify survivor selection against DOS rather than guessing |
| MF-04 / High | Scan p. 48: sentry wakes when an enemy moves adjacent | `setOrder` accepts sentry; inspected turn/knowledge paths have no adjacency wake transition | Sentry army and ship must wake on eligible contact, including the opponent's turn; test submarine detectability before deciding what counts as contact |
| MF-05 / High | Scan p. 46: fighter patrol begins at city/carrier, limits 10/6, carrier-relative endpoint | `setOrder` validates endpoints but not fighter basing/range; execution stores fixed world endpoints | Reject airborne-origin/overrange patrols; move a carrier and verify relative geometry plus fuel-safe return |
| MF-06 / Medium | Text p. 39: Escort Ship applies to ships and follows within two spaces behind | `setOrder` allows any friendly active unit types; execution aims for an adjacent station without behind geometry | Reject army/fighter escort orders; compare following distance and speed mismatch using DOS; keep modern AI tactical escorts distinct |
| MF-07 / High | Text p. 41: Go Home applies to fighters/ships, considers friendly carriers and fuel range | `setOrder` requires a friendly city, not a carrier; execution searches cities only, including for armies | Carrier-only reachable home, unreachable city, moving carrier, lost base; verify safe behavior and target choice |
| MF-08 / High | Scan p. 48: airborne fighters cannot be put on sentry | `setOrder` accepts sentry without checking airborne fighter state | Refuse sentry in flight, permit at friendly city/on carrier; verify fuel handling across idle turns |
| MF-09 / Medium | Scan p. 49: all city production stops under unit saturation | `beginTurn` has no population threshold | Recover original global capacity and release behavior before implementing; do not invent upkeep or a strategic reserve ceiling |
| MF-10 / Medium | Text pp. 40–41: city-to-city Flight Paths and Go Random exist | `UnitOrder`/game command paths lack these facilities | Separate city routing metadata from unit orders; prohibit random movement for fighters; replay deterministic paths |
| MF-11 / Medium | Text pp. 45–46: fighter Move To cannot exceed remaining fuel | `setOrder` checks playable destination, not fighter fuel distance | Reject out-of-fuel destinations; distinguish distance check from executable path/obstacle semantics |
| MF-12 / High | Scan p. 26/Table III: submarines cannot detect armies or adjacent fighters | `updateKnowledge` builds one shared visible region and returns all non-submarine targets as detectable; observer restrictions are not represented | Isolate submarine-only observer versus army/fighter; then add valid observer and compare; avoid hiding terrain merely because unit detection is restricted |

## Confirmed rules worth preserving

| Evidence | Rule and strategic consequence | Existing implementation anchor |
| --- | --- | --- |
| Scan pp. 26–27 | Only city/cargo stacks are exceptions; captured-city occupants are destroyed; successful army becomes garrison | `adjudicateCityCapture`; cargo-combat tests |
| Scan p. 26 | City occupants do not increase city defense | Capture odds do not inspect stationed army count; retain this separation |
| Scan p. 27 | Port repair restores one damage point per turn; docking unloads cargo | `beginTurn`, `moveUnit`; exact repair-phase timing still needs DOS comparison |
| Scan p. 26 | Ships at least half damaged move one square per turn | `movementAllowance`; odd-HP boundaries need historical examples |
| Scan p. 49 | Switching production discards incomplete unit; first/repeat production differ | `selectProduction`, `requiredProductionTurns`; factory-history semantics across switches remain a DOS question |
| Scan pp. 22–24, 49 | Eight-unit constants and 50% production table agree with existing transcription | `STATS`, manual-unit-roster test; no blanket verification of all rules |
| Text p. 19 | Stale sightings are last-known information, not current enemy positions | `knowledge.ts`; hidden-world equivalence tests |
| Text pp. 43–44 | Fighter photo-recon retains production snapshot; Load Ship and Unload Ship have distinct activation behavior | `updateKnowledge`, `fillShip`, `unloadShip`; detailed timing still provisional |

## Algorithms the manual does not settle

- Exact combat RNG call sequence, seeding, hit exchange and factor application.
  `combat.ts` describes weighted allocation as verified more strongly than the
  available evidence supports; correct that comment when the resolver is audited.
- City conquest formula beyond dependence on attacking combat efficiency;
  whether our direct percentage roll matches DOS is still unproved.
- Captured factory initialization, precise refuel/repair timing, cargo survivor
  priority, and blocked-order resumption/temporary activation scheduling.
- Global unit saturation threshold and whether all relevant object pools share it.
- Original AI objective scoring, production policy, difficulty heuristics and
  surrender threshold. Human strategy guidance is not the computer source code.

## Adversarial testing and wargaming questions

This is a separate analytical lens from source extraction, not a completed
independent expert review. The roadmap's independent review remains open.

1. A city sentry is blind to a submarine under current detection. Fixing wake-up
   alone would retain the strategic defect. Test detection and activation together.
2. Extra troops inside a city do not improve defense and can all perish at once.
   Evaluate nearby interception positions before treating reserved guards as proof
   of safety; keep the owner's defense requirement while measuring placement.
3. A convoy whose escorts are faster can split. A hold/escort policy can also
   clog the only port exit. Verify viable loading, departure and reinforcement.
4. A fighter with a moving carrier target may have enough fuel initially and
   still crash. Patrol geometry, basing and fuel must be tested together.
5. An unopposed neutral landing can consume all its armies through unsuccessful
   assaults or successful garrisons. More discovered cities then require resupply.
6. A port beside an enclosed lake can produce trapped ships. The manual's world
   validator forbids such cities, while our generated stress maps do not enforce
   that condition. Label this distinction instead of tuning only easier maps.
7. Combat factor omissions change fleet economics: judging submarine/carrier
   value from current campaigns can reward strategies against incorrect odds.
   Establish rule behavior before promoting those units based on self-play results.

## Follow-up order

- [x] Implement city/submarine and observer-specific detection with regressions in a separate PR; deployment tracked separately.
- [ ] Verify combat factor application against executable evidence.
- [ ] Fix sentry activation and fighter standing-order validation.
- [ ] Resolve cargo-overload and home/escort command discrepancies.
- [ ] Expand campaign evaluation to original-like city density plus unusual maps.
- [ ] Add fuel-safe fighter strategy and coordinated convoy scheduling.
- [ ] Complete remaining visual pages and independent testing/wargaming review.

Tests should fail for the documented behavior before a fix, preserve replay and
private intelligence, and test boundary/interacting rules rather than just copy
constants. No full historical-conformance claim is warranted by the current suite.

## Sentry follow-up

A PR stacked on the detection fix addresses MF-04 and MF-08. After authoritative
knowledge updates, unembarked sentries with a fresh adjacent faction-known enemy
contact clear sentry and emit a private activation event. Repeated updates do not
repeat the event. Activation preserves position, spent movement and RNG state;
it never initiates combat. Embarked troops and Load Ship orders remain separate.

This uses shared faction intelligence: a nearby contact detected by another
capable friendly observer can wake a sentry. Exact DOS scheduling/activation
ordering still needs runtime comparison. Stale reports never trigger activation.

Airborne fighters cannot receive sentry orders; save import enforces the same
friendly-city/carrier requirement. Regression coverage includes opposing-turn
movement, hidden submarines, distant contacts, cargo, loading, replay and based
versus airborne fighters. Full fighter patrol validation and temporary standing
order interruption remain subsequent work.
