/** [D] Passability mask bytes from unpacked image @0x2E410 (Raiden dump). Nonzero = passable glyph. */
import type { ClassicMaskProfile } from './classic-mask.js';

export const CLASSIC_MASK_IMAGE_BASE = 0x2E410;
export const CLASSIC_MASK_GLYPH_COUNT = 34;
export const CLASSIC_MASK_PLAYERS = 4;

export const CLASSIC_GLYPH_MASKS: Record<ClassicMaskProfile, readonly (readonly number[])[]> = {
  army: [
    [0, 1, 3, 4, 5, 8, 10, 11, 22, 26, 27, 33],
    [0, 1, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 20, 22, 25, 32],
    [5, 18, 19, 23, 24, 25, 26, 27, 28, 29, 30, 31],
    [3, 5, 8, 10, 11, 22, 25, 26, 27, 33],
  ],
  fighter: [
    [0, 1, 2, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 20, 22, 25, 27, 28],
    [5, 6, 9, 10, 16, 17, 18, 19, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
    [3, 5, 8, 10, 11, 22, 26, 27, 33],
    [0, 1, 2, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17, 20, 24, 25, 27, 28, 29, 30, 32],
  ],
  'ship-a': [
    [0, 1, 4, 5, 9, 10, 11, 12, 13, 14, 16, 17, 18, 20, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 33],
    [3, 5, 8, 10, 11, 12, 22, 26, 27, 31, 33],
    [0, 1, 2, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 25, 26, 27, 28, 29, 30],
    [3, 5, 9, 10, 11, 12, 16, 17, 19, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32],
  ],
  'ship-b': [
    [1, 2, 4, 5, 6, 10, 11, 14, 24, 26, 33],
    [15, 21, 22, 27, 28],
    [9, 10, 16, 22],
    [1, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 26, 27, 28, 29, 30, 31, 32, 33],
  ],
};

export function classicMaskAllowsGlyph(profile: ClassicMaskProfile, playerIndex: number, glyph: number): boolean {
  if (glyph < 0 || glyph >= CLASSIC_MASK_GLYPH_COUNT) return false;
  const table = CLASSIC_GLYPH_MASKS[profile];
  const row = table[playerIndex] ?? table[0];
  if (!row) return false;
  return row.includes(glyph);
}
