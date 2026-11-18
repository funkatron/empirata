# Raiden agent handoff — ALG-AI-002 `0x3ADC` stale slots **[D] high**

**For:** Cursor agent on private worker **raiden** (Linux)  
**Repo:** https://github.com/funkatron/empirata  
**Base branch:** `main` (or `cursor/q24-alg-ai-002-3adc-stale-85b7` if PR #160 is still open)  
**Do not commit:** `EMPIRE.EXE`, unpacked images, manual PDF, or any copyrighted game bytes.

---

## Copy-paste prompt (start here)

```text
You are on the user's private Linux machine (Raiden). Goal: raise ALG-AI-002 `0x3ADC` tracked-threat slot policy to [D] HIGH CONFIDENCE by static disassembly of the Interstel 2.05C unpacked program image.

Read first:
- agents/raiden-handoff-3adc-stale-trace.md (this file)
- agents/alg-ai-002-3adc-slot-trace-2026-11-17.md
- docs/DOS_ALGORITHM_RULESET.md (ALG-AI-002, §0x3ADC subsection)
- AGENTS.md

Question to answer with evidence:
  Do the ~20 tracked enemy map cells used by production routine 0x3ADC include STALE chart contacts (last-known positions), or only FRESH sightings?

Inputs (user machine — locate; do not upload binary to GitHub):
  Unpacked image SHA-256 MUST be:
    0a06eba8ef371847e8c818703ba51e7ab5ef91b732643ca4e422e26923ba8166
  Typical path (adjust if different):
    /home/coj/private/interstel/EMPIRE_UNPACKED_IMAGE.bin

Dependencies:
  objdump (i8086), python3, git, node 24 for npm test after any code/doc edits

Steps:
1. Clone or pull funkatron/empirata; checkout main or continue branch cursor/q24-alg-ai-002-3adc-stale-85b7.
2. Verify image: sha256sum "$IMAGE" — must match above.
3. Run:
     python3 tools/disasm_alg_ai_002_3adc.py "$IMAGE" --report /tmp/alg-ai-002-3adc-report.txt
   Save report under agents/ as agents/alg-ai-002-3adc-disasm-report-RAIDEN.txt ONLY if it contains no raw game bytes (disassembly text is OK per repo policy — confirm with DOS doc precedent; if unsure, attach report to PR description excerpt only).
4. Manual disasm follow-on (document findings in agents/alg-ai-002-3adc-slot-trace-2026-11-17.md):
   - At 0x3ADC: loop bound 0x14 (~20 slots), slot stride.
   - Backtrace slot array base and writers (0x3490 vs 0x1E60C sight).
   - Inside loop before pathfinder call: fresh-only test/jz → fresh-only [D]; no such branch → stale+fresh [D].
   - Confirm slots use map indices / ES:234 chart, not live unit table.
5. Update docs/DOS_ALGORITHM_RULESET.md: change stale vs fresh from [?] to [D] with one-sentence ruling + evidence pointer.
6. If ruling is stale+fresh: ensure tests/alg-ai-002-3adc-threat.test.mjs stale case matches; if fresh-only: change classic-production.ts + tests (feature branch).
7. npm ci && npm run build && npm test (Node 24).
8. Feature branch cursor/raiden-3adc-stale-proof-85b7, push, open PR to main. Title: "ALG-AI-002: [D] 0x3ADC stale slot trace (Raiden)".

Deliverables in PR body:
- Verdict table (stale+fresh vs fresh-only) with instruction offsets cited.
- Link or paste key disasm lines from report (no binary attachments).
- Whether Empirata staging code already matches DOS or needs a one-line fix.

Merge: only if user asks. Return PR URL to the user.
```

---

## Context (why this exists)

- Cloud agents **lack** the private unpacked image; PR #160 / Q24 set **medium** confidence staging (stale + fresh in `classicTrackedThreatLocations`).
- User wants **[D] high** before treating the policy as settled.
- Tool: `tools/disasm_alg_ai_002_3adc.py` (supports `--report`).

---

## Success criteria

| Outcome | Action |
|---------|--------|
| **Stale + fresh [D]** | Ruleset `[D]`; optional note in README 0.6.7; slice G1 → done |
| **Fresh-only [D]** | Change `classicTrackedThreatLocations` to filter `!stale`; update tests; semver patch |
| **Inconclusive** | Document what was missing; keep `[?]`; propose DOSBox Case A from trace doc |

---

## Out of scope

- Full `0x3490` tree, `0x3B45`, PlayerView inventory PRs.
- Modern AI changes.
- Committing `dist/` or root `index.html` as source.

---

## After the agent finishes

User pastes PR URL or verdict back into the main Empirata cloud thread for merge coordination.