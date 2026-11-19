# Local agent — traces vs GUI testing (2026-11-19)

Use this on your **private Linux/Mac machine** (terminal-only is fine). Cloud agents run **`npm test`** and browser checks; **your local agent** owns **static disasm**, **DOSBox debugger notes**, and **promoting ruleset rows to `[D]` / `[T]`**.

## Who does what

| Work | Local agent (terminal) | Cloud agent / you in a browser |
|------|------------------------|--------------------------------|
| Unpacked image disasm (`tools/*.py`) | **Yes** | No (no private image) |
| DOSBox saved-game / debugger runs | **Yes** (log text only in repo) | Awkward over SSH |
| `npm run build && npm test` | Yes | Yes |
| Rules Lab / CvC “does it look right” | Optional smoke URL | **Preferred** when UI or feel matters |
| Commit game bytes / saves | **Never** | Never |

**Principle:** Terminal proves **algorithm shape** (probe order, loop bounds, reachability gates). GUI proves **presentation and muscle memory** — don’t block classic parity on GUI unless the slice is UI.

---

## One-shot environment (your shell)

```bash
export EMPIRE_IMAGE="${EMPIRE_IMAGE:-$HOME/private/interstel/EMPIRE_UNPACKED_IMAGE.bin}"
export EMPIRATA_REPO="${EMPIRATA_REPO:-$HOME/src/empirata}"   # adjust
cd "$EMPIRATA_REPO" && git pull origin main
sha256sum "$EMPIRE_IMAGE"
# expect: 0a06eba8ef371847e8c818703ba51e7ab5ef91b732643ca4e422e26923ba8166
```

Requires: `python3`, `objdump` (i8086), Node 24, `npm ci` once.

---

## Copy-paste prompt for your local agent

```text
You are the user's LOCAL terminal agent for Empirata classic DOS parity traces.

Read first:
- agents/local-agent-trace-workflow.md (this workflow)
- docs/DOS_ALGORITHM_RULESET.md (ALG section for the task)
- The protocol file named in the task below

Hard rules:
- Do NOT commit EMPIRE.EXE, unpacked images, manual PDF, or binary saves.
- OK to commit: disasm TEXT reports under agents/ (excerpts), RUN_ID log rows, ruleset/doc updates, engine/tests if code must change.
- Feature branch cursor/<topic>-85b7, push, open PR; never push main.

Task for THIS session:
  TRACE_ID: <pick one row from "Open trace queue" below>

Steps:
1. Verify sha256sum "$EMPIRE_IMAGE" matches ruleset §0.
2. Run the TRACE_ID command block; save report to /tmp then summarize into the matching agents/* protocol file (RUN_ID template).
3. State verdict: does Empirata on main match DOS for this slice? [D] promotion yes/no.
4. If engine gap: minimal fix + npm run build && npm test on branch.
5. PR body: instruction offsets cited, no binaries.

Do not run long GUI playtests; if runtime proof needs eyes, stop after logging DOS fields and note "human browser check optional".
```

---

## Open trace queue (pick `TRACE_ID` for the prompt)

| TRACE_ID | Goal | Command block |
|----------|------|----------------|
| **`escort-03c2-static`** | J1 gap: **20-angle** vs eight-dir at `1D09:03C2`; find loop bound / first-hit | See **Escort station static** below |
| **`4c52-rim-runtime`** | I2: rim direction after blocked north step | See **DOSBox `0x4C52`** below |
| **`3adc-stale-static`** | Re-verify `0x3ADC` slot freshness (already [D]; optional) | `python3 tools/disasm_alg_ai_002_3adc.py "$EMPIRE_IMAGE" --report /tmp/3adc.txt` |
| **`resign-df58`** | ALG-AI-004 crush ordering | Static anchor TBD; document in `agents/alg-ai-004-resign-bookkeeping-2026-11-18.md` |

### Escort station static (`escort-03c2-static`)

Closes ruleset gap: Empirata v0.6.16 has **8-dir + `006C`**; **20-angle** ring still "pending trace".

```bash
cd "$EMPIRATA_REPO"
python3 tools/disasm_empire_anchor.py "$EMPIRE_IMAGE" \
  --anchor 0x4600 --label escort-close-range --report /tmp/empire-escort-4600.txt
python3 tools/disasm_empire_anchor.py "$EMPIRE_IMAGE" \
  --anchor 0x4C52 --label legalize-direction --report /tmp/empire-4c52.txt
```

**Agent instructions:**

1. In `/tmp/empire-escort-4600.txt`, list **far calls** `{seg:off}`; find calls toward **`1D09:03C2`** (station) and note any **`cmp …,0x14`** (20) or **`0x8`** (8) in the callee window (re-disassemble around the far-call target if needed: `--anchor <linear>` once linear addr is known from prior work).
2. Record **probe order** (angle table vs eight chart dirs) in `agents/q30-j1-escort-first-hit-ooda-plan.md` or a new `agents/alg-ai-001-03c2-static-trace-YYYY-MM-DD.md`.
3. Append **RUN_ID** block:

```text
RUN_ID: escort-03c2-static-<date>
IMAGE_SHA256: <digest>
FINDING: <20-angle | 8-only | inconclusive>
EMPIRATA_GAP: <none | implement ring | doc only>
NOTES: <cited offsets>
```

4. If finding is clear **[D]**: update `docs/DOS_ALGORITHM_RULESET.md` escort station row; open PR **docs-only** unless code must change.

### DOSBox `0x4C52` (`4c52-rim-runtime`)

Protocol: `agents/alg-ai-001-4c52-dosbox-experiment-2026-11-18.md`

```bash
# After your DOSBox run — paste text only:
mkdir -p agents/evaluation/4c52-dosbox-runs
# echo "RUN_ID: ..." >> agents/evaluation/4c52-dosbox-runs/<id>.txt
```

Log **PRE_DIR / POST_DIR / MOVED** from the protocol table; do not commit `.sav` binaries (add to `.gitignore` locally if needed).

### Empirata regression after any engine change

```bash
cd "$EMPIRATA_REPO"
npm ci && npm run build && npm test
node --test tests/alg-ai-001-escort-station.test.mjs tests/alg-ai-001-rim.test.mjs
```

---

## What not to ask the local agent

- Full campaign playthroughs or iPad gesture QA
- "Open GitHub Pages and click around" unless `computerUse` / browser is explicitly available
- Uploading unpacked images to the repo or PR attachments

## Related

- Raiden-style handoff example: `agents/raiden-handoff-3adc-stale-trace.md`
- Classic pack: `agents/classic-parity-chatgpt-pack.md`
- Cloud handoff: `agents/local-agent-handoff-dos-ai.md`