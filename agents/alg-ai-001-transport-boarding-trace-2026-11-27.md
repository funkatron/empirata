# ALG-AI-001 army boards a transport `0x1F6AA` (trace, 2026-11-27)

Static disassembly of the DOS Interstel 2.05C image (`ndisasm -b16`). [D] = read from code.

## `0x1F6AA(u)` — army `u` looks for a transport [D]
1. `pos = unitPos[u]`; `start = rand() % unitCount` (`25E6:0F64`, count at ES:6D9E).
2. Scan unit slots `start, start+1, …` once, wrapping. A slot qualifies when:
   - order byte (table `14E6`) == `0xE`;
   - unit type (table `1AB2`) == 3 (transport);
   - position word (table `84E`) != 0 **and** owner byte (table `17FA`) == current player (`1E46:08A7`);
   - Chebyshev distance to `pos` <= 10 (`1E46:0957`, positions are `y*100+x`).
3. First hit: transport target slot (table `24A`, index `2*ship`) = army position; army order = 1 (Sentry); army target slot = ship index; return 1. No capacity check, and the transport's order stays 0xE.
4. No hit: return 0. The random draw has been consumed either way.

## Where order 0xE comes from [D]
Transport activation (`0x1D0xx`): with no cargo, `0x1D92C` looks for an own city (distance < best, free of other claims, path `1A9E:006C`); if found it sets order 0xE and target = that city (`0x1D9F5`). If none is found and cargo is 0, order 0xE is set anyway (`0x1D10D`). `0x3D76` clears other tactical orders on an empty transport, which is why the claim must live in the target table, not in a general order.

## Transport with cargo `0x1D114` [D]
A transport with cargo and no sailing order (`12C2:0DAD` cargo count != 0) flips `rand % 2`:
- odd: `0xDA38` objective, else `03BF:0D34` explore, else order 3 (wander target `03BF:0C46`);
- even: explore first, then objective, then order 3.
The helpers set the order byte (0xB objective, 0xD explore) and the target table; they persist until reached.

`0xDA38` [D]: loop over cities (count at ES:6384, high to low); skip when the player's per-city tally (`51A + p*200 + 2*city`) is 0 (city unknown). On grade 2 (flag `62F6`) skip when the tally >= cap (`120 - combat/10` for owner 0, `180 - combat/10` otherwise; grade 1 has no cap). Owner 0 (neutral) and owner != 0 are tracked separately: distance `1E46:0957 < best`, `1E46:0CBA(city)` must be nonzero, and the pathfinder `1A9E:006C` must return a nonzero length <= best. Neutral wins when `bestNeutral >> flag[62FC] < bestEnemy` (grade 1: shift 0). It then adds `12C2:0DAD` (cargo) to the city's tally. Returns 0 when nothing qualifies.

`03BF:0D34` [D]: up to 10 tries of `rand % 0x16A6 + 0x65`; accept the first cell whose chart byte (`[0x234] + 6444[p]`) is 0 (uncharted) and for which `1E46:0C7F` is 0. Returns the cell or 0.

Unknown: what `1E46:0CBA` and `1E46:0C7F` test (taken as "city is reachable by ship" and "cell is blocked"), and the per-city tally writers.

## Empirata mapping (staged)
- Waiting transport = own, empty, not aboard, order None.
- Claim = `Unit.classicBoardGoal` (army square), saved and validated; army goes on Sentry.
- Executor: claimed transport routes toward the army; within 1 square it uses Load Ship, drops the goal, and then sails with what it loaded.
- Loaded transport: `classicLoadedTransportReissue` (coin, objective pick, explore cell) writes a `move-to`; the order ends on arrival or when no step exists. Chebyshev distance replaces the `1A9E:006C` path length; grade-2 cap and the per-city tally are not modelled.
- `classicArmyPortEmbarkStep` (adjacent in port) is no longer used by the AI.

## Campaign (classic grade 1, round 150; blue/red/neutral cities)
| Run | main (0.7.5) | this PR |
|---|---|---|
| continents 17 | 36/15/13 | 42/1/21 |
| continents 23 | 26/28/10 | 7/31/26 |
| continents 41 | 10/1/53 | 10/2/52 |
| islands 17 | 8/5/51 | 1/1/62 |
| islands 23 | 2/1/61 | 2/5/57 |
| islands 41 | 3/4/57 | 1/2/61 |

(Table above is from the first version, before `0x1D114`.) With `0x1D114` added: continents 17 `42/1/21`, 23 `8/33/23`, 41 `10/2/52`; islands 17 `1/2/61` (first capture round 147), 23 `2/4/58`, 41 `2/3/59`. Islands are still weaker than `main`: one army per sortie, and a landed army attacks a city alone.

## Still [?]
Meaning of `1E46:0CBA` / `0C7F`, per-city tally writers, grade-2 cap, order-3 wander, claim release when the transport is lost, whether a transport waits for more armies, how `0xE` transports use their city target.
