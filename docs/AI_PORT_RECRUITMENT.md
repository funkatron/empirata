# Recruiting invasion partners at supply ports

A loaded transport previously recognized only partners already carrying armies.
The first ship could therefore leave before a nearby second transport received
its first load. A full lead ship also stopped recruiting even if its nearby
partner was still loading.

For a hostile objective, an empty uncommitted transport now qualifies as a
recruitment partner when it is within three squares, beside an army-producing
friendly city and connected by a short charted sea/friendly-port route. A full
lead ship may wait while such a partner finishes loading. Fresh ground threats
exclude unsafe recruitment routes. Neutral missions retain independent departure.

The existing first-assembly deadline remains twelve rounds. It does not restart
for the same objective. No existing-save migration or additional persistent state
is introduced. Construction and ordinary loading still determine actual cargo;
there is no invented production speed or automatic troop transfer.

Verification covers an empty partner, a full lead waiting until both ships are
full, deadline release, input immutability, neutral missions, missing army supply
and disconnected ports. Existing convoy and landing tests remain applicable.

This is an incremental recruitment correction, not the complete operation planner
from the invasion review. It does not reserve armies, predict production arrival,
assign empty hulls across distant ports or guarantee 12–18 troops. Twelve rounds
can be insufficient to produce a major force; the bounded fallback still allows
partial departures. A gathered expedition retains existing gathered-state behavior.
Transient ship occupancy is not treated as permanent geographic disconnection.
No general campaign-strength improvement is claimed from planner regressions.

## Beach pickup implementation

The [beach rendezvous increment](AI_BEACH_RENDEZVOUS.md) adds ship approaches,
inland marching, troop reservations and multi-turn collection. It retains port
pickup when the supply estimate is cheaper. Longer-range marching, production
forecasting and operation-wide allocation remain follow-up work.
