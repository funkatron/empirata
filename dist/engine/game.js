import { MAX_FIGHTER_FUEL, movementAllowance, requiredProductionTurns, STATS } from './units.js';
import { MAP_HEIGHT, MAP_WIDTH, makeTestTerrain, playable, terrainAt, cityAt, equal, isCoastal } from './world.js';
import { emptyKnowledge, updateAllKnowledge } from './knowledge.js';
export class RuleNotImplemented extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'RuleNotImplemented';
    }
}
function clone(g) { return structuredClone(g); }
function log(g, recipient, kind, message) {
    g.events.push({ id: g.nextEventId++, round: g.round, recipient, kind, message });
    if (g.events.length > 300)
        g.events.shift();
}
function newUnit(g, owner, kind, position) {
    return { id: `u${g.nextId++}`, owner, kind, position: { ...position }, damage: 0, spent: 0,
        fuel: kind === 'fighter' ? MAX_FIGHTER_FUEL : null, order: { kind: 'none' }, aboard: null };
}
export function makeRulesLab() {
    const tiles = makeTestTerrain();
    const mkCity = (id, x, y, owner) => ({ id, position: { x, y }, owner,
        production: null, progress: 0, firstCycle: true });
    const cities = [mkCity('c-blue', 8, 25, 'blue'), mkCity('c-red', 80, 36, 'red'),
        ...[[20, 16], [24, 40], [33, 24], [53, 11], [67, 24], [69, 40], [52, 50], [83, 20]]
            .map(([x, y], i) => mkCity(`c${i + 1}`, x, y, null))];
    const g = { schema: 1, ruleset: 'interstel-2.05', mode: 'rules-lab', scenario: 'classic-lab', width: MAP_WIDTH, height: MAP_HEIGHT, tiles,
        players: [{ id: 'blue', label: 'Blue', combatEfficiency: 50, productionEfficiency: 50 },
            { id: 'red', label: 'Red', combatEfficiency: 50, productionEfficiency: 50 }],
        active: 'blue', round: 1, cities, units: [], knowledge: { blue: undefined, red: undefined, green: undefined },
        rng: { seed: 20261021, draws: 0 }, nextId: 1, nextEventId: 1, events: [] };
    // Lab-only starting units bypass original starting conditions intentionally.
    g.units.push(newUnit(g, 'blue', 'army', { x: 9, y: 25 }));
    g.units.push(newUnit(g, 'blue', 'destroyer', { x: 7, y: 25 }));
    g.units.push(newUnit(g, 'red', 'army', { x: 79, y: 36 }));
    for (const faction of ['blue', 'red', 'green'])
        g.knowledge[faction] = emptyKnowledge(g);
    updateAllKnowledge(g);
    log(g, 'blue', 'system', 'Rules lab loaded. Combat, capture, cargo, and autopilot orders are intentionally disabled.');
    return g;
}
export function selectProduction(game, cityId, kind) {
    const g = clone(game);
    const city = g.cities.find(c => c.id === cityId);
    if (!city || city.owner !== g.active)
        throw new Error('You can only set production in your own cities on your turn.');
    if (!STATS[kind])
        throw new Error('Unknown unit type');
    if (STATS[kind].domain === 'sea' && !isCoastal(g, city.position))
        throw new Error('Inland cities cannot build ships.');
    if (city.production === kind)
        return g;
    city.production = kind;
    city.progress = 0;
    city.firstCycle = true;
    log(g, city.owner, 'production', `Production set to ${STATS[kind].name} at ${city.id}; previous progress discarded.`);
    updateAllKnowledge(g);
    return g;
}
export function setOrder(game, unitId, order) {
    if (!['sentry', 'skip', 'none'].includes(order.kind))
        throw new RuleNotImplemented('STANDING_ORDERS', 'Only Sentry, Skip, and Clear are active in v0.2.');
    const g = clone(game), unit = g.units.find(u => u.id === unitId);
    if (!unit || unit.owner !== g.active)
        throw new Error('Unit not available to the active player.');
    unit.order = { kind: order.kind };
    if (order.kind === 'skip')
        unit.spent = movementAllowance(unit);
    return g;
}
export function moveUnit(game, id, to) {
    const g = clone(game), unit = g.units.find(u => u.id === id);
    if (!unit || unit.owner !== g.active)
        throw new Error('That unit cannot be moved this turn.');
    if (unit.aboard)
        throw new RuleNotImplemented('CARGO', 'Transport unloading is not yet implemented.');
    if (unit.order.kind === 'sentry')
        throw new Error('Clear sentry before moving.');
    if (unit.spent >= movementAllowance(unit))
        throw new Error('No movement remaining this turn.');
    if (!playable(g, to))
        throw new Error('The outer map border is impassable.');
    const dx = Math.abs(to.x - unit.position.x), dy = Math.abs(to.y - unit.position.y);
    if (Math.max(dx, dy) !== 1)
        throw new Error('Manual movement must be one adjacent square.');
    const terrain = terrainAt(g, to);
    const domain = STATS[unit.kind].domain;
    if ((domain === 'land' && terrain !== 'land' && !cityAt(g, to)) || (domain === 'sea' && terrain !== 'sea' && !cityAt(g, to))) {
        throw new Error(`${STATS[unit.kind].name} cannot cross this terrain.`);
    }
    const city = cityAt(g, to);
    if (domain === 'sea' && city && !isCoastal(g, city.position))
        throw new Error('A ship cannot enter an inland city.');
    if (city && city.owner !== unit.owner) {
        if (unit.kind === 'army')
            throw new RuleNotImplemented('CITY_CAPTURE', 'City assault probabilities are still being verified.');
        if (domain !== 'air')
            throw new Error('Cannot enter a city that is not friendly.');
    }
    const occupants = g.units.filter(u => !u.aboard && equal(u.position, to));
    if (occupants.some(u => u.owner !== unit.owner))
        throw new RuleNotImplemented('COMBAT', 'Historical combat resolution is not yet verified.');
    if (occupants.some(u => u.owner === unit.owner) && !city)
        throw new RuleNotImplemented('CARGO', 'Loading and same-cell stacking require verified original mechanics.');
    unit.position = { ...to };
    unit.spent++;
    if (unit.kind === 'fighter') {
        unit.fuel = (unit.fuel ?? MAX_FIGHTER_FUEL) - 1;
        if (city?.owner === unit.owner)
            unit.fuel = MAX_FIGHTER_FUEL; // Timing to be verified.
        else if (unit.fuel <= 0) {
            g.units = g.units.filter(u => u.id !== unit.id);
            log(g, unit.owner, 'fuel', `${unit.id} ran out of fuel and crashed.`);
        }
    }
    updateAllKnowledge(g);
    return g;
}
function beginTurn(g) {
    for (const unit of g.units.filter(u => u.owner === g.active)) {
        unit.spent = 0;
        if (unit.order.kind === 'skip')
            unit.order = { kind: 'none' };
        const city = cityAt(g, unit.position);
        if (STATS[unit.kind].domain === 'sea' && unit.damage > 0 && city?.owner === g.active && isCoastal(g, city.position)) {
            unit.damage--;
            log(g, g.active, 'repair', `${unit.id} repaired one damage point in port.`);
        }
    }
    for (const city of g.cities.filter(c => c.owner === g.active && c.production !== null)) {
        const kind = city.production;
        const required = requiredProductionTurns(kind, city.firstCycle, 50);
        city.progress++;
        if (city.progress >= required) {
            city.progress = 0;
            city.firstCycle = false;
            const unit = newUnit(g, g.active, kind, city.position);
            g.units.push(unit);
            log(g, g.active, 'production', `${city.id} completed ${STATS[kind].name} (${unit.id}).`);
        }
    }
    updateAllKnowledge(g);
}
export function endTurn(game) {
    const g = clone(game), currentIndex = g.players.findIndex(p => p.id === g.active);
    if (currentIndex < 0)
        throw new Error('Invalid active player');
    const next = (currentIndex + 1) % g.players.length;
    if (next === 0)
        g.round++;
    g.active = g.players[next].id;
    beginTurn(g);
    return g;
}
/** Lab convenience: opposing faction passes its turn. Not a classic AI implementation. */
export function advanceLabRound(game) {
    if (game.mode !== 'rules-lab' || game.active !== 'blue')
        throw new Error('Lab round advance requires blue player.');
    let g = endTurn(game);
    while (g.active !== 'blue')
        g = endTurn(g);
    return g;
}
