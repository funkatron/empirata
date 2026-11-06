# Strategy and tactics: acquire, deliver, retain

Status: proposed program, grounded in the [42-campaign baseline](evaluation/strategy-baseline/BASELINE_INTERPRETATION.md). No new strategic weights or combat rules are introduced by this study.

## Aim and constraints

The AI should turn private intelligence and production into cities it can capture **and retain**. It must keep neutral expansion productive while organizing justified hostile operations, protect its supply, and recover from losses. More armies, ships, or landing events are intermediate measures—not the objective.

Keep the Interstel movement, combat, detection, production, fuel, cargo, and capture rules. A captured city consumes its victorious army as the permanent garrison. A stationed unit does not increase intrinsic city defense. Sentries, escorts and patrols grant no invented combat or production-suppression bonus. Use the [manual strategy research](manual/strategy.md) for historical advice and its explicit qualifications.

## Foundations before tuning

1. **One faction-neutral controller.** Incorporate #44 after its corrected head passes all checks. Decision helpers must use the subject faction or unit owner; `view.active` is the current turn and is not a reliable substitute for the owner of an inspected unit. Keep strict private-knowledge boundaries, input immutability, deterministic replay, save/resume, and faction-relabeling tests.
2. **Separate geography from policy.** #43 changes the default opening’s harbor. Evaluate baseline, harbor-only, controller-only and combined variants separately on that map before attributing wins to either change. The generated baseline overwrites that fixture and is unaffected by #43. Preserve deliberately difficult maps, but label physical limitations such as a portless starting landmass. Add original-validator-style worlds as another cohort, not a replacement for failures.
3. **Understand computation costs.** Dense runs hit the compute limit. Profile decision phases, cloning, knowledge-view construction, route searches, and repeated occupancy/cargo scans in an isolated process. Candidate improvements include per-planning-pass indexes and caches keyed by knowledge/state revision. Verify unchanged decisions and fog-of-war behavior before interpreting speed changes as progress.

## Decision hierarchy

| Layer | Decision | Inputs allowed | Output |
| --- | --- | --- | --- |
| Strategic assessment | Expand locally, secure port access, defend, invade, or reinforce? | Faction-known geography, city intelligence, own economy and forces, observed threats and freshness | Ranked opportunities and explicit uncertainty |
| Operations | What can this force accomplish and sustain? | Known routes, usable ports/beaches, troop supply, production completion times, damage and threats | An operation with reserved resources, phases and release conditions |
| Production and allocation | What is the next useful increment of capacity? | Operation demand, local defense needs, available lift and completion progress | City assignments and unique troop/ship reservations |
| Tactical execution | What legal action best advances the current assignment? | Fresh local intelligence, movement, fuel, cargo capacity and known routes | Movement, loading, interception, landing, assault or bounded waiting |
| Reassessment | Did the operation progress or become infeasible? | Actual arrival, delivery, capture, loss, route and knowledge changes | Continue, reinforce, resize, retarget or release—recording the reason |

The strategic layer must not use the evaluator’s omniscient map diagnostics. Unknown terrain remains unknown. A stale sighting can justify investigation; it cannot justify attacking an assumed current target.

## Strategic policy

### Expansion and access

- Prefer useful, reachable local captures early, accounting for travel, verified assault odds, production unlocked and likely retention—not straight-line distance alone.
- If naval access is needed, discover and secure a feasible coastal production city using known information. Distinguish an undiscovered port, a lost port, a blocked harbor and a physically portless landmass. Do not order armies toward unseen cities using evaluator knowledge.
- Keep small neutral expeditions independent of major invasions. One or two armies may be a sensible neutral load; the baseline does not support filling every ship before sailing.
- Detect lack of useful progress for diagnosis. Do not invent an automatic surrender or stalemate victory threshold to conceal an unreachable objective.

### Production and reserves

- Estimate useful troop supply by location and arrival time. Separate city guards, ground assaults, scouts, committed cargo and recruitable armies; each unit can have one reservation.
- Compare army output with actual lift throughput and round-trip time. A large inland army count does not mean a port can supply it, or that additional transports can reach it.
- Allocate scarce coastal factories to transport, protection, air or ground demand by the operation they enable. Preserve useful production progress; record why progress is discarded when circumstances require a switch.
- Reassess guard coverage by threat, interception reach and production importance. Explore mobile defensive screens where appropriate rather than treating an army inside every city as a defense bonus. Do not remove this safeguard globally without defense regressions.
- Replace lost escorts and transports while a real mission still needs them. Protect local capture and emergency defense from over-reservation for distant war.

## Operations and logistics

Give an expedition an identity before its ships are loaded. Proposed fields are owner, role, objective, phase, reserved troop/transport/support IDs, supply ports and pickup beaches, desired and viable strength, route estimates, recruitment/departure deadlines, progress, observed threat basis and release reason. Persist decisions that must survive reload; recompute route details from current private knowledge.

### Recruit and depart

- Neutral expeditions, hostile invasions, reconnaissance and reinforcement have different requirements.
- For a **major hostile operation**, the manual’s two-to-three full undamaged transports is a candidate force target of 12–18 armies. Test it conditionally; it is not a rule for every enemy city. Budget for repulses, successful attackers becoming garrisons, known enemy mobile forces, and follow-on objectives.
- Assign empty hulls and troops uniquely across multiple feasible ports or beaches. Use marching time, legal boarding capacity and ship travel to schedule meetings. Preserve city guards and useful active assaults.
- Establish a viable departure window from available troops and actual production rates. Recruitment can take longer than the existing 12-round near-target rendezvous window. Set a feasible deadline and release or resize an unattainable operation rather than waiting indefinitely for hypothetical reinforcements.
- Record exceptions for sailing below desired strength: a weakened target, credible local support, a lost partner, or a better opportunity. Avoid silent piecemeal departures caused only by iteration order.

### Transit and support

- Coordinate arrival times and use distinct staging stations with clear traffic lanes. Damage-adjusted speed, obstructed ports and an unreachable partner must not strand a fleet.
- Reserve escorts when the route or observed threats justify them. Ordinary scouting should not permanently displace an assigned escort. Allocate hunters so all combat ships do not pursue the same transport while abandoning the convoy.
- Preserve committed assault cargo. Reconnaissance drops need an explicit mission value and must not silently consume an invasion reserve.
- Investigate stale transport reports and respond to fresh contacts through legal movement and detection. No hidden-unit lookup, guaranteed safe route through unknown terrain, or fictional blockade bonus.

### Land, advance and sustain

- Choose connected, legal beaches with confirmed routes toward the objective. Beach capacity limits delivery **per turn**, not total operation size.
- Land waves as space clears, let delivered troops advance inland, and deliver follow-up loads. Do not reserve ground-assault armies merely to leave them stationary.
- Diagnose reboarding by recording its reason and whether the army’s previous objective remains useful. Repeated landing is sometimes deliberate evacuation or repositioning; prevent demonstrably unproductive cycles without banning all reuse of transports.
- Preserve an operation after its first capture. Empty transports return to a designated feasible source, reload and reinforce while other ships deliver. Recompute sources and escorts after captures or losses.
- Judge success by delivered force, useful ground progress, cities held later, surviving supply and continuing expansion. A successful unload alone is not completion.

## Tactical roles

| Unit | Primary role | Decision that needs testing |
| --- | --- | --- |
| Army | Capture, ground assault, interception and local defense | Advance useful landed troops; avoid congestion, guard stripping and unjustified reboarding |
| Transport | Pickup, delivery, evacuation and reinforcement | Preserve cargo, coordinate loads and route timing, withdraw from fresh threats |
| Destroyer | Convoy protection, shipping interception, submarine detection and reconnaissance | Allocate escort/hunter/scout duties by mission rather than letting every hull chase one contact |
| Fighter | Useful reconnaissance, interception and landing-area support | Reserve return fuel/bases; prioritize worthwhile legal combat over endless scouting where appropriate |
| Carrier | Mobile air base supporting a real operation | Require usable aircraft, recovery capacity and safe coordinated movement; stationary sortie success is insufficient |
| Submarine | Shipping interdiction and screening | Respect its attack/defense and detection limitations; measure useful interception before funding a fixed quota |
| Cruiser | Shipping protection and legal coastal bombardment | Integrate supporting fire with ground/landing timing and transport protection |
| Battleship | Heavy naval and coastal support | Justify its production delay through a specific operation; do not commission it merely to complete the roster |

Routine perimeter duties apply to charted friendly landmasses without known active opposition. Unknown interiors and stale contacts remain uncertainty. Reassign sentries and patrols when shipping, ownership or threats change. The baseline starts with no units and the current production selector does not commission submarines, cruisers or battleships, so it provides no evidence of their campaign effectiveness.

## Implementation sequence and completion checks

| Stage | Deliverable | Evidence needed before moving on |
| --- | --- | --- |
| 0. Foundations | Correct #44; assess #43 separately; profile dense turns | Full tests, faction-relabeling and knowledge isolation; clean attribution of map/controller differences |
| 1. Explain failures | Operation-stage and reassignment reasons; traces of repeated deliveries and port access | Reproduce the repeated-landing case; distinguish useful relocation, no-port geometry, congestion, late port acquisition and missed production |
| 2. Allocate useful supply | Access-aware target choice, troop/hull reservations, operation-specific production and departure | Two transports fill through ordinary turns without stripping guards, starving neutral expansion or waiting forever |
| 3. Concentrate safely | Route-based arrivals, reserved escorts, explicit understrength exceptions | Partner loss, damaged capacity, blocked port and fresh enemy transport do not cause indefinite waiting or uncontrolled pursuit |
| 4. Capture and retain | Connected waves, inland advance, repeat shuttle and recapture response | Successive captures, later retention and reinforcement under narrow-beach and attrition conditions |
| 5. Extend combined arms | Combat air missions and demand-driven specialist ships | Mission-level value versus their production and fuel costs across held-out maps |

- [ ] Each stage is a focused, reviewable PR with tests appropriate to its risk; engine changes keep full coverage verification.
- [ ] Use paired baseline/candidate comparisons at fixed rounds and within the same execution budget. Do not count a time-limited or unfinished game as a defeat.
- [ ] Retain unfavorable seeds and outcomes. Evaluate new holdout seeds (for example 419, 907, 1291) before selecting a policy; do not tune them after seeing candidate results.
- [ ] Primary outcomes: captured-and-retained cities, hostile operation completion, useful neutral expansion and losses. Secondary outcomes: load at departure, synchronized delivery to **one objective**, army waiting time, repeat boarding, repair/refuel cycles and isolated-process turn time.
- [ ] Require an explicit account of tradeoffs: a candidate with more landings but worse retention, lost convoys, stalled neutral growth or excessive runtime is not automatically better.
- [ ] Finish with real browser and iPad responsiveness checks. Pure engine timings do not establish complete rendering performance.

No overall strength improvement is claimed until these comparisons exist. The first implementation task after the foundations should be **explaining and correcting one demonstrated logistics failure**, not imposing a fleet-wide force-size formula.
