# ALG-AI-004 resign — DOS bookkeeping vs Empirata (2026-11-18)

**Slice I3.** Evidence: ruleset § **ALG-AI-004** **[D]** (`0xDF58` spine).

## DOS (summary)

| Step | Behavior |
|------|----------|
| Offer gate | Computer, 1 human, 2 living sides, turn > 100, `ES:4F8==0`, cities < 25% |
| Offer | Set `4F8=1`; dialog accept/decline |
| Accept | Zero computer city count; elimination bookkeeping (`0xD8F1` sentinel); armies removed |
| Decline | Computer stays; `4F8` remains set (no re-offer) |

## Empirata

| DOS piece | Implementation |
|-----------|----------------|
| Predicate table | `shouldOfferClassicResign` in `classic-resign.ts` |
| One-shot offer | `classicResignOffered` + `maybeOfferClassicResign` in classic executor |
| Pending UX | `classicResignPending`; `respondClassicResign` |
| Accept transfer | Cities → human; **all** computer units removed; `updateAllKnowledge` |
| Decline | Clears pending only; `classicResignOffered` preserved |
| Elimination outcome | `gameOutcome` — computer has no cities/units → `finished`, human wins |

## Gaps

- No claim of identical `0xDF58` crush path vs resign path ordering.
- `ES:6C7C` living-side decrement not modeled as a separate counter (derived from map state).
- Multi-human / three-player not supported (matches Empirata scope).