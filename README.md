# Empirata — Classic Rules Laboratory v0.3

**Purpose:** An initial browser-operable and independently testable TypeScript simulation foundation for **Empirata**, modeled on the **Interstel *Empire: Wargame of the Century* DOS 2.05 rules**, not Empire Deluxe or the older Bright v5.0 rules.

**Important:** This is a *rules laboratory*, not a complete or playable classic campaign. The reference manual describes several mechanics without publishing their exact algorithms; those are deliberately **not guessed** here. The sample map and extra starting units are ORIGINAL DEVELOPMENT FIXTURES, not authentic Interstel maps or starting conditions.

## Play in a browser (GitHub Pages)

Once this repository is published with GitHub Pages enabled, open the Pages URL in Safari, including on an iPad. No installation, local server, or account is needed to play the rules laboratory.

**Deploy:** The included GitHub Actions workflow builds, tests, and publishes `dist/` automatically on pushes to `main`. The repository owner must first enable **Settings → Pages → Source: GitHub Actions**. Alternatively, upload the provided single-file `index.html` to the root of an empty repository and set **Pages → Deploy from a branch → main / (root)**.

**Limitations:** Combat, city capture, and AI are not yet implemented; this is an interactive simulation test scenario, not a complete Empire campaign.

## Try it locally

The `dist/` folder contains a **prebuilt, self-contained static site** with no third-party runtime dependencies. Serve it with any local web server, or publish the contents of `dist/` to a static host such as GitHub Pages. The app needs no backend and makes no network requests.

If Node.js is installed:

```bash
npm start
```

Then open `http://127.0.0.1:4173` in your browser. For source development, install TypeScript (`npm install`) and use:

```bash
npm run build
npm test
npm start
```

`npm start` works with the committed prebuilt `dist/` without installing dependencies. The TypeScript source is in `src/engine/` and the standalone Canvas interface is in `src/ui/`. We intentionally deferred React/Vite until the core simulation settles; this makes the current foundation easy to test and static-host, without changing the future architecture.

### Basic controls

1. Tap/click a **blue unit** to select it; tap an **adjacent tile** to move. Arrow keys move orthogonally; **Q/E/Z/C** move diagonally. Blue units include an army and a destroyer in the test fixture.
2. Tap/click the **blue city** to choose a production type. If a unit occupies the city, click/tap repeatedly to cycle through units to the city. Production takes **6 blue faction turns** to make the first army at the standard 50% efficiency, and **5** for subsequent armies.
3. Select **Next round** to advance one round; the red faction *passes automatically* in this lab, with no AI.
4. Pan by dragging and zoom with +/− buttons or the wheel. A status panel displays the selected unit/city and its available actions.
5. Progress autosaves in **IndexedDB**, where available. Use **Export JSON** and **Import JSON** for portable saved states. Reset lab creates a fresh fixture.

### Current working engine behavior

- 60-row × 100-column world, eight-direction adjacency, impassable outer border.
- Eight historically documented units: canonical normal-efficiency production costs, movement, damage, fighter fuel, and transport/carrier capacity.
- Immutable command-style engine transitions; turn order and city production at the beginning of faction turns.
- First-production setup costs, repeated production cycles, discarding incomplete work when switching factory type.
- Inland cities limited to land/air production; ships limited to sea/eligible ports; armies limited to land/cities; aircraft have 20 movement fuel points.
- 50% efficiency only; other values refused until historical rounding behavior is validated.
- Standard ship speed loss at half damage; one-point friendly-port repair at the next owner turn (exact *timing* still awaiting DOS validation).
- Faction-separated known world, remembered terrain, stale sightings, and production intelligence that cannot be read directly from unseen enemy cities. Simplified visibility/detection remains provisional until a reference capture.
- Sentry, clear, and skip. Other standing orders intentionally unavailable.
- Versioned JSON save structure and IndexedDB autosave. Seeded RNG facility, currently unused for combat.

### Not implemented (intentionally blocked)

- Historical combat exchange and city-assault probability: blocks move attempts, **not** arbitrary approximations.
- Naval bombardment; ship loading/unloading and carrier operations.
- Automatic pathfinding/patrol, escort, go-home, waking sentries, report suite.
- Human-vs-AI gameplay, three-player hot seat, scoring/victory/surrender.
- Authentic `.MAP` import and historical map selection.
- Original AI policies, full combat detection matrix, efficiency sliders other than 50%.

### Provisional details to validate against the DOS executable

- Definition of coastal adjacency (currently any of eight touching sea tiles).
- Exact production tick/repair/refuel timing, production spawn order, and excess-unit cap.
- Whether cities provide passive vision on every turn (the lab currently treats owned cities as adjacent observers).
- Submarine detection exceptions and dynamic enemy-sighting update timing.
- Fighter refueling currently restores immediately when landing on a friendly city. Precise classic timing is not yet confirmed.

See [`docs/ENGINE_STATUS.md`](docs/ENGINE_STATUS.md) and the preserved [`Classic Rules Specification v0.1`](docs/Empirata_Classic_Rules_Specification_v0.1.md).

## Quality and distribution

```bash
npm test
```

The suite currently contains **25 independent tests** of constants, movement, production, fog of war, save integrity, and explicit unimplemented-rule blocks. No external assets or original *Empire* code are included. Source and UI are original to this project.


### Scripted historical-result demonstrations (v0.3)

Two buttons in the browser demonstrate a successful city capture and a naval combat result. These are **not** playable random battles. The initial state and winning outcome are explicitly supplied by the test fixture, because Interstel 2.05's exact selection of combat hits and city capture probability still requires verification. Each demonstration resets the lab and is intended for visual validation of manual-confirmed consequences.

The independent `src/engine/adjudication.ts` functions can be given a verified hit sequence or captured/repelled result. Once the authentic probability engine is verified, it can drive those same consequences without changing their implementation.


## Immediate encounters: Close Quarters (v0.3.1)

New visits start in **Close Quarters**, a small diagnostic skirmish around the blue starting port. An enemy army, enemy submarine, and enemy fighter are already visible. A neutral city is one step away. The blue army is selected automatically.

1. Tap the nearby **red A** (or gold city) on the map.
2. In the selection panel, select **Test: Blue wins** or **Test: Blue loses**.
3. Watch the state change and event report. Try the blue destroyer versus the nearby red S as another encounter.

**Important:** The outcomes are hand-selected tests, not real combat probabilities or AI behavior. This feature makes it easier to test verified *consequences* while the historical combat resolver is researched. Existing browser autosaves load unchanged; use **Start Close Quarters** to switch to the new scenario. To restore the previous map, select **Original test map**.
