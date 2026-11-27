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

## Transport with cargo [?]
`0x1D114`: coin flip (`rand % 2`) between helpers `0x1DA38` and `03BF:0D34`; the latter sets order 0xD, else order 3 with a wander target (`03BF:0C46`). Not traced.

## Empirata mapping (staged)
- Waiting transport = own, empty, not aboard, order None.
- Claim = `Unit.classicBoardGoal` (army square), saved and validated; army goes on Sentry.
- Executor: claimed transport routes toward the army; within 1 square it uses Load Ship, drops the goal, and then sails with what it loaded (DOS cargo behaviour is [?]).
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

Islands regress: the claimed army lands alone and loses its attack. DOS cargo and sailing rules (above) are needed before this is judged.

## Still [?]
Transport-with-cargo choice (`0x1DA38`, `03BF:0D34`), claim release when the transport is lost, whether a transport waits for more armies.
