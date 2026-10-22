import { directions, index, inMap, cityAt } from './world.js';
export function emptyKnowledge(game) {
    return { terrain: Array.from({ length: game.tiles.length }, () => null), visible: [], sightings: [], freshEnemies: [], cities: {} };
}
function detectedBy(game, faction, target) {
    if (target.kind !== 'submarine')
        return true;
    return game.units.some(observer => observer.owner === faction && !observer.aboard &&
        (observer.kind === 'cruiser' || observer.kind === 'destroyer') &&
        Math.max(Math.abs(observer.position.x - target.position.x), Math.abs(observer.position.y - target.position.y)) <= 1);
}
/** Knowledge is an independent snapshot, never a live alias of the omniscient state. */
export function updateKnowledge(game, faction) {
    const k = game.knowledge[faction];
    const visible = new Set();
    const origins = [...game.cities.filter(c => c.owner === faction).map(c => c.position),
        ...game.units.filter(u => u.owner === faction && !u.aboard).map(u => u.position)];
    for (const p of origins)
        for (const d of [{ x: 0, y: 0 }, ...directions]) {
            const q = { x: p.x + d.x, y: p.y + d.y };
            if (inMap(game, q))
                visible.add(index(game, q));
        }
    const freshEnemies = new Set();
    const previousSightings = new Map(k.sightings.map(s => [s.id, s]));
    for (const i of visible) {
        k.terrain[i] = game.tiles[i] ?? null;
        const pos = { x: i % game.width, y: Math.floor(i / game.width) };
        const city = cityAt(game, pos);
        if (city) {
            const known = k.cities[city.id];
            const isOwned = city.owner === faction;
            const spyPresent = game.units.some(u => u.owner === faction && u.kind === 'fighter' && !u.aboard &&
                Math.max(Math.abs(u.position.x - pos.x), Math.abs(u.position.y - pos.y)) <= 1);
            const revealProduction = isOwned || spyPresent;
            const intel = { id: city.id, owner: city.owner,
                production: revealProduction ? city.production : (known?.production ?? null),
                productionKnown: revealProduction || (known?.productionKnown ?? false) };
            k.cities[city.id] = intel;
        }
    }
    for (const enemy of game.units) {
        if (enemy.owner === faction || enemy.aboard)
            continue;
        const isSeen = visible.has(index(game, enemy.position)) && detectedBy(game, faction, enemy);
        if (isSeen) {
            freshEnemies.add(enemy.id);
            previousSightings.set(enemy.id, { id: enemy.id, kind: enemy.kind, owner: enemy.owner,
                position: { ...enemy.position }, observedRound: game.round });
        }
    }
    for (const [id, sight] of previousSightings) {
        // If this square is visible and the type is detectable, stale enemy reports are disproven.
        const probe = { id, kind: sight.kind, owner: sight.owner, position: sight.position, damage: 0, spent: 0, fuel: null, order: { kind: 'none' }, aboard: null };
        if (visible.has(index(game, sight.position)) && detectedBy(game, faction, probe) && !freshEnemies.has(id))
            previousSightings.delete(id);
    }
    k.visible = Array.from(visible).sort((a, b) => a - b);
    k.freshEnemies = Array.from(freshEnemies);
    k.sightings = Array.from(previousSightings.values()).sort((a, b) => a.id.localeCompare(b.id));
}
export function updateAllKnowledge(game) {
    for (const player of game.players)
        updateKnowledge(game, player.id);
}
/** The sole reader contract for player UI and future AI. */
export function getPlayerView(game, faction) {
    if (!game.players.some(p => p.id === faction))
        throw new Error('Unknown faction');
    const k = game.knowledge[faction];
    const visible = new Set(k.visible);
    const cells = k.terrain.map((terrain, i) => {
        const x = i % game.width, y = Math.floor(i / game.width);
        const actual = cityAt(game, { x, y });
        const intel = actual ? (k.cities[actual.id] ?? null) : null;
        // City lookup only checks whether a known city exists; never reads live city properties.
        return { terrain, visible: visible.has(i), city: terrain === null ? null : (intel ? { ...intel } : null) };
    });
    return { width: game.width, height: game.height, active: game.active, round: game.round, cells,
        ownCities: game.cities.filter(c => c.owner === faction).map(c => structuredClone(c)),
        ownUnits: game.units.filter(u => u.owner === faction).map(u => structuredClone(u)),
        enemies: k.sightings.map(s => ({ ...structuredClone(s), stale: !k.freshEnemies.includes(s.id) })),
        events: game.events.filter(e => e.recipient === null || e.recipient === faction).slice(-30).map(e => ({ ...e })) };
}
