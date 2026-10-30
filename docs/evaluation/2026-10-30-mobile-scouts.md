# Mobile scouts and naval holding: campaign check

Six clean generated maps, seeds 17 and 83, 100 rounds each, original faction
assignments. Same commands and map generator as PR #18. This branch changes mobile
scout eligibility and the destroyer fallback after reconnaissance is exhausted.
No prepared units or routes. Every final save passed export/import validation.

| Layout | Seed | Cities Blue / Red | Army landing events Blue / Red |
| --- | --- | --- | --- |
| continents | 17 | 2 / 1 | 0 / 0 |
| continents | 83 | 2 / 1 | 0 / 0 |
| islands | 17 | 1 / 2 | 0 / 4 |
| islands | 83 | 2 / 1 | 1 / 0 |
| archipelago | 17 | 1 / 1 | 2 / 0 |
| archipelago | 83 | 2 / 1 | 1 / 1 |

Compared with the recorded PR #18 baseline on deployed `731f043`, continents/17
and islands/83 each gain one additional Blue city; archipelago/17 loses one Red
city. Three settings have unchanged final holdings. Landing counts also change.
This mixed result is not a general improvement claim. The direct regression
proves that the city guard no longer suppresses mobile reconnaissance and that an
initially unknown neutral city can be discovered and captured.

The next investigation remains discovery-to-capture delay and convoy logistics.
Do not tune solely for these six maps. Swapped starts and longer endurance sweeps
remain follow-up evaluation work for this change.

Raw observations: [mobile-scouts.json](2026-10-30-mobile-scouts.json).
