/** Standard efficiency (50%): verified table from specification v0.1, section 4. */
export const STATS = Object.freeze({
    army: { name: 'Army', movement: 1, hitPoints: 1, hitDamage: 1, first: 6, repeat: 5, domain: 'land' },
    fighter: { name: 'Fighter', movement: 5, hitPoints: 1, hitDamage: 1, first: 12, repeat: 10, domain: 'air' },
    destroyer: { name: 'Destroyer', movement: 3, hitPoints: 3, hitDamage: 1, first: 24, repeat: 20, domain: 'sea' },
    transport: { name: 'Transport', movement: 2, hitPoints: 3, hitDamage: 1, first: 30, repeat: 25, domain: 'sea' },
    submarine: { name: 'Submarine', movement: 2, hitPoints: 2, hitDamage: 3, first: 24, repeat: 20, domain: 'sea' },
    cruiser: { name: 'Cruiser', movement: 2, hitPoints: 8, hitDamage: 2, first: 35, repeat: 30, domain: 'sea' },
    carrier: { name: 'Carrier', movement: 2, hitPoints: 8, hitDamage: 1, first: 48, repeat: 40, domain: 'sea' },
    battleship: { name: 'Battleship', movement: 2, hitPoints: 12, hitDamage: 3, first: 60, repeat: 50, domain: 'sea' }
});
export const UNIT_TYPES = Object.freeze(Object.keys(STATS));
export const MAX_FIGHTER_FUEL = 20;
export function movementAllowance(unit) {
    const stats = STATS[unit.kind];
    return stats.domain === 'sea' && unit.damage * 2 >= stats.hitPoints ? 1 : stats.movement;
}
export function capacity(unit) {
    if (unit.kind === 'transport')
        return Math.max(0, 6 - 2 * unit.damage);
    if (unit.kind === 'carrier')
        return Math.max(0, 8 - unit.damage);
    return null;
}
export function requiredProductionTurns(kind, firstCycle, efficiency = 50) {
    if (efficiency !== 50)
        throw new Error('Production efficiency rounding is not verified; only 50% is enabled.');
    return firstCycle ? STATS[kind].first : STATS[kind].repeat;
}
