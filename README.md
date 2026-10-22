# Empirata

**Empirata** is a browser-based recreation project inspired by *Empire: Wargame of the Century* (Interstel DOS 2.05). The goal is to preserve the classic game's mechanics while modernizing only the controls and presentation.

## Open the browser version

Once GitHub Pages has been activated, visit **https://funkatron.github.io/empirata/**. The root `index.html` is a self-contained, single-file build, so it requires no build step, dependencies, or external server.

### Enable GitHub Pages (one-time setup)

1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select **main** and **/(root)**, then **Save**.
4. Once GitHub finishes publishing, open **https://funkatron.github.io/empirata/**.

### What works in v0.2

- 60 × 100 map and limited fog of war; select units/cities and move units manually
- Eight classic unit definitions and city production
- Turn progression, JSON save import/export, and browser autosave
- Keyboard, mouse, and touch interaction

**Important:** This is a rules laboratory, **not** a complete playable campaign. Combat, capturing cities, naval loading, automatic orders, and the computer opponent are intentionally incomplete while original behavior is researched. The sample map is a test fixture, not a historical Empire map.

### Controls

- Tap/click a blue unit, then an adjacent tile to move
- Use arrow keys for cardinal movement and Q/E/Z/C for diagonals
- Tap/click a blue city to choose production (tap again if a unit is occupying the city)
- Drag to pan and use the +/- map controls to zoom
- Select **Next round** to advance the test scenario

## Project status

- **Version:** v0.2 rules laboratory
- **Next milestone:** historically validated combat and city capture (v0.3)
- **Rules target:** Interstel DOS *Empire: Wargame of the Century* 2.05
- **Project name:** Empirata

The published `index.html` embeds the v0.2 game engine and interface. A separate, editable TypeScript source archive has also been prepared; it can be introduced to the repository with the next source commit. No original Empire software or artwork is included.
