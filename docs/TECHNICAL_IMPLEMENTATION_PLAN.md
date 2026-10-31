# Remaining roadmap: technical implementation plan

**Baseline:** main/deployed `7922f5440640971d680b8f131f393c39f819e259`, 2026-10-30.
**Status:** proposed engineering design and verification sequence. Unchecked items
are work to complete, not promises of historical parity or deployed features.

## Implementation progress

2026-10-30: PRs #18, #19, #21 and #23 have merged. The open-PR table below
is retained as the plan's original snapshot, not current merge status. Main
`73673db` includes campaign metrics, mobile scouts/naval holding, detection and
sentry activation. Fighter order assignment is the next scoped change; full
carrier-relative patrol execution remains outstanding.

## 1. Scope and delivery policy

Build a dependable Interstel DOS 2.05 rules implementation and a useful modern
opponent. Preserve private intelligence, deterministic replay, ordinary production
and legal actions. The opponent may improve beyond original AI behavior; its
strategy must not obtain hidden information or receive free units.

No existing-save repair or backward compatibility is required. Introduce explicit
schema changes when needed; reject incompatible saves clearly rather than silently
inventing missing state. Keep generated browser bundles out of source commits.

Use small, tested PRs. A merged PR, successful verification job and successful
Pages deployment are three different states. Source-only documentation under
`docs/**` may skip the main push workflow by current workflow configuration.

### Open work at this snapshot

| PR | Scope | Relationship to this plan |
| --- | --- | --- |
| [18](https://github.com/funkatron/empirata/pull/18) | Campaign outcome metrics and twelve-run baseline | Reuse and extend; round-boundary counters are incomplete |
| [19](https://github.com/funkatron/empirata/pull/19) | Mobile scouting fix, idle destroyer escort/hold | Integrate before replacing role allocation |
| [21](https://github.com/funkatron/empirata/pull/21) | City/submarine and observer-specific detection | Prerequisite for correct sentry contact behavior |

These PRs were open when this plan was written. Recheck their actual heads,
reviews and checks before integration. Do not infer merge authorization from this
implementation plan. Resolve overlapping roadmap edits and run combined checks.

### Design boundaries

- Engine actions remain authoritative. Planners return intentions; they cannot
  bypass terrain, combat, cargo, fuel or movement rules.
- AI planning consumes a faction view. Omniscient state is permitted in evaluation
  measurements and authoritative collision resolution, never objective scoring.
- Wall-clock budgets must not decide gameplay. Use deterministic work limits and
  stable tie-breaks; performance timing is diagnostic only.
- Production stays active under the agreed strategy. Original global saturation
  is a separate unresolved historical rule, not permission to add reserve caps.

## 2. Dependency and PR sequence

| Stage | Proposed PR-sized deliverable | Depends on | Completion evidence |
| --- | --- | --- | --- |
| A1 | Integrate open detection/recon/evaluation work | Latest CI/review | Combined suite and exact-head deployment status |
| A2 | Sentry activation and fighter order validation | A1 detection | Contact, fuel and interruption regressions |
| A3 | Combat-factor reference fixtures and resolver correction | Manual plus DOS evidence | Reproducible factor application; no guessed original algorithm |
| A4 | Transport overload, home/escort and cargo semantics | Rule-specific evidence | Boundary and interacting-rule cases |
| B1 | Structured campaign observations and neutral-objective traces | A1 | Metrics independent of log wording |
| B2 | Neutral expansion allocation and production supply | B1 | Paired varied-map results and replay |
| B3 | Multi-transport rendezvous and repeat reinforcement | B2 | Distant arrival coordination, bounded waiting, attrition recovery |
| B4 | Naval sentries, patrols and escort distribution | A2, B1 | Useful coverage and no port congestion |
| B5 | City-based fighter operations, then carrier operations | A2–A4, B1 | Safe return/rebasing and useful discoveries |
| C1 | Observer profiling and reduced presentation cadence | Can start alongside A work | End-state equality, latency and measured wall time |
| C2 | Engine navigation/indexing optimization | C1 measured hotspots | Same decisions with bounded work |
| D1 | Remaining classic commands, victory and extra factions | Relevant A rules | Engine/UI/save integration and original evidence |
| D2 | Original maps and comprehensive audit closure | Reference availability | Validated fixtures and independent review |

B-stage strategy experiments should record which A-stage discrepancies remain.
In particular, do not use uncorrected transport/submarine combat odds to declare
a fleet composition strategically superior.

## 3. Rules correctness

Implementation anchors are `src/engine/knowledge.ts`, `game.ts`, `combat.ts`,
`adjudication.ts`, `types.ts`, `units.ts` and `save.ts`. Source claims and unresolved
questions are listed in [manual findings](manual/findings.md).

### Detection and sentry activation

Detection uses observer capabilities independently from terrain visibility.
PR #21 supplies coverage sets for ordinary observers and submarine detectors.
Use the same capability rules for contact creation, freshness and stale-report
invalidation. Test mixed observers and loss of the only capable detector.

Add an explicit order-activation step after authoritative actions update knowledge.
Evaluate sentry wake-up for affected factions when an enemy becomes an eligible
adjacent contact, including during the opponent's turn. Waking changes order
state; it must not grant movement, trigger an automatic attack or advance turns.

Embarked units require special handling: the manual distinguishes unloading from
ordinary sentry clearing. Avoid waking cargo merely because the parent hull sees
an enemy. A loading ship waits for capacity under its own order. Capture, sinking,
boarding and repair must not leave invalid order references.

Temporary interruption and permanent cancellation should be separate states if
DOS evidence supports resumed routes. Proposed shape: retain the route order and
store a typed interruption reason; do not erase its target just to request input.
This requires changes to save validation, UI status and replay tests together.

**Verification checklist**

- [ ] Detectable adjacent contact wakes an army/ship on either faction's turn.
- [ ] Invisible submarine contact cannot reveal hidden information through wake-up.
- [ ] Cargo/load orders keep their distinct activation semantics.
- [ ] Waking preserves spent movement and RNG state.
- [ ] Save/resume preserves interrupted and active orders exactly.

### Combat factors and outcome semantics

`resolveCombat` currently computes a hit share from faction efficiencies alone.
The manual specifies unit attack/defense factors, including bombardment exceptions.
Do not treat this as proof of an exact weighted draw algorithm. First build DOS
reference cases for symmetric units, transport attacker/defender, submarine
attack/defense, carrier attack and army under bombardment.

Record executable hash/version, setup, commands, initial state, observed outcomes
and confidence. Extract deterministic hit traces where possible. Use statistical
experiments only when internal traces are unavailable, with uncertainty stated.
A candidate implementation can isolate `effectiveCombatFactors(attacker, defender,
context)` from the random-hit sampler and existing outcome adjudication. The
formula must follow the evidence before the sampler is changed.

Preserve ordinary city assaults separately. The manual says conquest depends on
combat efficiency; it does not establish our direct-percentage roll. Successful
capturers become immobile garrisons, and city occupants do not increase intrinsic
defense. Tests must distinguish destroyed attackers from successful garrisons.

### Cargo, repair and production

For damaged transports, distinguish taking damage from the later movement attempt:
the manual permits unloading excess cargo before departure, otherwise surplus is
lost. Verify which units perish and the ordering relative to blocked moves and
combat; current movement rejection is a discrepancy. Carrier overflow is immediate.

Verify repair phase, refueling phase and captured factory initialization with DOS
fixtures. Keep partial production discard on type change. Do not support arbitrary
production efficiencies until rounding and initial/repeat timing are established.
Recover the original unit-saturation threshold before adding global saturation;
continue to treat ordinary active production as the modern strategic default.

### Fighter and ship orders

Add a shared order validator used by command assignment and save import. For
fighter patrol, validate friendly basing, ten-cell city range and six-cell carrier
range. Represent carrier-relative patrol endpoints as offsets plus carrier ID;
resolve them against the current carrier position on each decision.

Go Home must select a reachable legal city or carrier within fuel constraints;
loss or movement of a carrier requires reassessment. Define an explicit failure
result when no safe base exists. Fighter Move To must obey remaining-fuel limits.
Airborne fighters cannot receive sentry. Escort orders require ship-to-ship
eligibility; historical following geometry remains separate from AI tactical
screening positions. Test damaged ships, unequal speeds and disappearing targets.

Consolidated strategic priorities: [capture and sustain cities](AI_CAPTURE_STRATEGY.md).
Transport capacity and mobile army supply take priority over optional support
production. Preserve a viable hostile invasion while continuing neutral expansion.

## 4. Campaign instrumentation and neutral expansion

### Replace fragile measurements

PR #18 counts some outcomes using message substrings and round-boundary deltas.
Introduce typed simulation events at successful action boundaries, with stable
unit/city IDs, actor, recipient, round and outcome. Keep display messages derived
from those events. Candidate events include `unit-produced`, `army-boarded`,
`army-landed`, `city-assault`, `city-captured`, `unit-destroyed`, and
`mission-transition`.

Evaluation must collect events before bounded UI history truncation. Prefer an
optional evaluation recorder external to serialized Game state; give it explicit
per-run lifetime and no ability to affect decisions. Avoid unbounded history in
normal saves. Record cargo losses at destruction and garrison conversion as a
separate outcome. Include within-round recaptures, not just net final ownership.

### Trace the complete expansion chain

For each discovered neutral objective record first-known round, known land/sea
reachability, assigned armies/transports, attempted assaults, first capture and
reason for postponement. Distinguish unknown route, occupied route, unavailable
cargo, no safe landing, rendezvous wait and recent failed mission.

Introduce a per-faction planning context built once per decision phase from its
view: known land components, navigable sea components, occupancy, fresh threats,
city objectives, available mobile troops and production commitments. Refresh or
invalidate after actions that alter those facts. Do not store hidden connectivity.

Score neutral objectives using known route cost, available force, contested
approaches and assignment saturation. Prefer an actually reachable objective over
straight-line proximity. Reserve city defense explicitly and exclude that force
from scout/cargo supply. An uncertain city is an investigation target; it must not
be treated as definitely neutral using live ownership.

A city assignment needs enough armies to tolerate failed assaults and the loss of
successful attackers into garrisons. Supply demand should include nearby objectives,
replacement troops and transport capacity. Avoid fixed fleet ceilings and avoid
switching factories so often that their progress is repeatedly discarded.

**Verification checklist**

- [ ] Mobile scouts discover and hand off objectives to capture forces.
- [ ] Neutral expansion continues while another expedition attacks an enemy.
- [ ] Blocked objectives produce a bounded retry or alternate assignment.
- [ ] Multiple armies distribute across reachable cities without abandoning a viable assault.
- [ ] Hidden ownership/terrain changes cannot change decisions before observation.
- [ ] Paired clean campaigns report discovery-to-capture delays, losses and CPU cost.

## 5. Coordinated invasions and logistics

Existing `aiObjective`, `aiMissionProgress` and `aiAvoidObjective` fields support
persistent individual missions. Nearby landing groups do not supply distant
rendezvous scheduling. Introduce a minimal expedition record only when grouping
needs shared durable state; use a stable ID and explicit participant IDs.

Proposed phases: `recruiting`, `assembling`, `transit`, `landing`, `reinforcing`,
`retreating`, `complete`/`abandoned`. Store objective ID, known staging coordinate,
last meaningful progress round, assigned transports and planned strength. Compute
routes from current knowledge rather than persisting obsolete full paths.

Choose a staging position with known navigable access and enough free sea stations.
Estimate arrival in turns using actual movement allowance, including damage.
Leading transports can wait for identified reinforcements; impose a deterministic
maximum wait and reassess losses, changed ownership and new threats. Do not wait
for hypothetical ships without committed production and a credible route.

Before landing, match ready armies to distinct legal beaches with known routes to
the objective. Recheck eligibility immediately before each ordinary disembark action.
A hidden contact can interrupt delivery. Full-scale hostile invasions may aim for
12–18 troops as manual advice suggests; tiny neutral expansions need a different
strength policy. Select strength from evidence and force availability.

After unloading, release transports to supply and retain expedition identity for
reinforcement. Do not reboard assault troops merely because their transport is
nearby. Recover from sunk transports, lost supply ports, changed objectives and
landings too far from a usable city. Beachhead survival and replenishment matter
more than a single successful landing event.

## 6. Naval duties and air strategy

### Role allocation

Keep AI roles separate from user standing orders. Assign deterministic roles such
as reconnaissance, escort, coastal guard, corridor patrol, interception and repair.
Each assignment carries a target and a reason to reconsider it. Derive transient
assignments when possible; persist only state needed to prevent oscillation or
coordinate participants.

Loaded expeditions need distributed protection: count assigned escorts before
selecting another nearest transport. Coastal sentries should cover threatened
friendly approaches without occupying the only loading/departure square. Patrol
endpoints should cover known traffic routes or refresh intelligence, not merely
create motion. Ships with no useful assignment hold and reconsider.

Enemy-port interception targets remembered hostile ports and fresh traffic. It
uses ordinary combat; there is no invented economic blockade effect. Evaluate
shore threats, retreat/repair access and escort opportunity cost. Submarines,
cruisers and battleships require validated detection/combat economics before
production policy can be assessed meaningfully.

### Fighters first, carriers later

A fighter mission needs a destination, current fuel, reachable return bases and
reserve margin. Recompute safe return after each move and ownership change.
City-based reconnaissance should reveal useful objectives and then hand them to
armies/transports. Interception may use remaining movement for repeated attacks
when legal; it must not blindly assume survival or a still-friendly landing base.

Carrier operations add moving-base coordinates, capacity, damage, relative patrols
and loss recovery. Add them only after city-based flight is reliable. Test coastal
and inland starts, disappearing bases, blocked landing and carrier movement.

## 7. Large-unit observer performance

### Observed current work per round

`src/ui/main.ts:startRoundPlayback` calls `dispatch(advanceLabRound)` once per round.
`dispatch` builds a PlayerView, calls `refresh`, and schedules `saveLocally`.
`refresh` rebuilds the current view plus Blue and Red views for scorecards, rebuilds
UI content and renders. There is no evidence here of a separate animation for
every engine move. Measure the real calls before selecting an optimization.

Instrument engine advance, view creation, DOM update, canvas paint, serialization
and storage independently. Use 1/10/50/100-round steps at representative low,
medium and high unit counts, with longer fresh campaigns and a diagnostic save.
Record median/p95/max round time, batch wall time, long tasks, memory and pause
latency. Store environment/browser/version and avoid universal timing thresholds
from a shared CI runner.

### Presentation separation

Refactor simulation advancement from presentation and persistence scheduling.
Proposed display modes: every round, periodic updates, or batch completion. Update
progress with a lightweight DOM path; commit the final visible state on completion,
pause, error and scenario change. Keep observer perspective explicit while the
canvas shows an older round. Before inspection, flush the latest state or pause
and render so clicks cannot act on mismatched positions.

Preserve a yield between rounds and generation-based cancellation. Coalesce saves
with an ordered single writer and latest pending snapshot; a slow earlier save
must never overwrite a newer one. Flush on pause/completion and define recovery
behavior for tab suspension. Reducing save cadence changes crash recovery, so
measure it and document the policy rather than silently dropping persistence.

Suppressing redraws cannot make a single synchronous long AI round interruptible.
If profiling justifies it, move simulation to a Web Worker after the simpler split.
Tag messages with session generation and revision; discard stale responses after
new game/import. Pause can stop scheduling the next round; immediate cancellation
requires explicit worker termination/restart from the last committed snapshot.
A worker must return the same deterministic state as the main-thread engine.

### Engine optimization after profiling

Index unit IDs and cell occupancy; reuse knowledge-based component/route searches
within a valid planning phase. Track invalidation on movement, losses, captures and
new discoveries. Never cache across factions under a shared key. Consider fewer
full-state clones through an internal transaction only after public immutable
operation semantics and error atomicity are protected by tests.

- [ ] Same seed/actions produce identical final saves under every display mode.
- [ ] Pause, progress, orientation changes and inspection remain usable on iPad.
- [ ] Latest save wins under artificially delayed storage completions.
- [ ] No stale worker response replaces a newly imported or restarted game.
- [ ] Report measured improvement with separate rendering and computation costs.

## 8. Remaining classic systems and UI

Implement Flight Paths as city-to-city routing metadata with ownership/fuel checks;
validate automatic assignment for new/arriving fighters and chained routes. Add
Go Random only with seeded deterministic behavior and verified legality. Implement
Wait as turn-selection scheduling, distinct from Skip Move. Add Activate and
interruption behavior without resetting spent movement.

Victory requires explicit elimination/end-state semantics validated against the
reference game. Surrender thresholds remain unresolved. Extend faction scheduling
and observation beyond Blue/Red only after tests cover three-player production,
combat, knowledge isolation and end-state transitions. Do not use label-swapping
as a general three-player strategy architecture.

For UI work, preserve existing pinch/fit-world, global Game menu, contextual
inspection, observer speeds and progress. Audit remaining commands and accessible
labels against the manual inventory. Side-by-side observation is optional on wide
screens and needs two independent PlayerViews, synchronized round numbers and
clear faction labels. Reports should expose useful mission/production information
without overwhelming ordinary play with debugging data.

Original MAP support needs a separately documented binary format and verified
fixtures. Add a map validator for landmass city/port requirements and enclosed lakes.
Keep standard-like 60–70-city evaluations alongside sparse and unusual stress maps;
do not silently transform user maps to make the AI succeed.

## 9. Verification and release procedure

For each rule fix: retain a failing pre-fix regression, identify its manual page or
DOS fixture, implement the smallest coherent change, and run replay/information
isolation tests where affected. Avoid treating implementation-derived constants
as independent historical proof.

For strategy changes: run fixed paired seeds and swapped starts, record engine
commit and map parameters, and report regressions as well as gains. Use held-out
seeds and longer campaigns before claiming general improvement. Keep expensive
sweeps outside the ordinary CI gate and bound individual regression fixtures.

Normal code verification: `npm test` (coverage gates), standalone bundle build and
four bundle checks. UI changes also run the observer browser checks with save/load,
progress, pause and representative iPad sizes. Update test counts from actual runs.

Before merge, verify latest head CI and unresolved review threads. After merge,
verify the main push run and Pages job for the exact merge SHA when a deployment
is triggered. Report documentation-only skipped deployment explicitly. Record the
last deployed SHA and leave other open PRs untouched unless authorized.

### Completion checklist for the roadmap

- [ ] Confirmed rule discrepancies corrected or explicitly deferred with evidence.
- [ ] Remaining manual images checked; executable ambiguities recorded.
- [ ] Independent testing and wargaming review completed with findings tracked.
- [ ] Neutral expansion and invasion logistics evaluated across varied maps.
- [ ] Naval roles and fuel-safe air strategy produce measurable useful outcomes.
- [ ] Large-unit observer performance characterized and improved without state drift.
- [ ] Remaining command, victory, faction and map gaps have verified behavior.
- [ ] Documentation, latest CI and deployment status agree.

## References

- [Roadmap](ROADMAP.md)
- [Manual research and provenance](manual/README.md)
- [Rule findings MF-01–MF-12](manual/findings.md)
- [Manual strategy analysis](manual/strategy.md)
- [Classic rules specification](Empirata_Classic_Rules_Specification_v0.1.md)
- [DOS call-site investigation](DOS_CALL_SITE_AUDIT_2026-10-23.md)
- [Test strategy](TEST_STRATEGY.md)

`ENGINE_STATUS.md` contains dated historical milestones and stale introductory
claims. Use this plan's explicit baseline and the actual source/PR state when
making implementation decisions; refresh that document as milestones ship.
