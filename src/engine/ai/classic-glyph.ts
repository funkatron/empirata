import type { City, FactionId } from '../types.js';

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
  return 10 * ownerIdx - 6;
}