import type { City, Coord, FactionId } from '../types.js';

/** Player slot `0…3` for DOS glyph bands (`10p−6` city encoding). */
export function classicDosPlayerIndex(game: { players: { id: FactionId }[] }, faction: FactionId): number {
  const idx = game.players.findIndex(p => p.id === faction);
  return idx >= 0 ? idx : 0;
}

/**
 * Chart city glyph `10*ownerIndex − 6` on `ES:234` (ALG-AI-001 passability layer).
 * Neutral / unknown cities use the unowned band (`null` owner).
 */
export function classicChartCityGlyph(
  game: { players: { id: FactionId }[] },
  observer: FactionId,
  city: Pick<City, 'owner'>,
): number {
  if (city.owner === null) return 0;
  const ownerIdx = classicDosPlayerIndex(game, city.owner);
  // DOS city write uses `10*playerSlot-6` with player slots 1…4 in traces (`4` for slot 1).
  return 10 * (ownerIdx + 1) - 6;
}

/** Land-class glyphs on the DOS chart (ALG-AI-001 bands). */
export function classicLandChartGlyphs(): number[] {
  return [0, 1, 3];
}

/** Sea-class glyph candidates for a player row (neutral `2` plus `10p-3…10p+3`). */
export function classicSeaChartGlyphs(playerIndex: number): number[] {
  const slot = playerIndex + 1;
  const glyphs = new Set<number>([0, 1, 2, 3]);
  for (let k = -3; k <= 3; k++) {
    const g = 10 * slot + k;
    if (g >= 0 && g < 34) glyphs.add(g);
  }
  return [...glyphs];
}

/** Chart glyph candidates for passability (`ES:234` analogue) on a known tile. */
export function classicChartGlyphsForTile(
  game: { players: { id: FactionId }[] },
  faction: FactionId,
  terrain: 'land' | 'sea' | null,
  city: Pick<City, 'owner'> | undefined,
): number[] {
  if (city) return [classicChartCityGlyph(game, faction, city)];
  if (terrain === 'land') return classicLandChartGlyphs();
  if (terrain === 'sea') return classicSeaChartGlyphs(classicDosPlayerIndex(game, faction));
  return [0];
}