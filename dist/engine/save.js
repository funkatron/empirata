import { updateAllKnowledge } from './knowledge.js';
const DATABASE = 'empirata-rules-lab';
const STORE = 'saves';
export function exportSave(game) {
    return JSON.stringify(game, null, 2);
}
export function importSave(json) {
    const data = JSON.parse(json);
    if (typeof data !== 'object' || data === null)
        throw new Error('Invalid save file.');
    const g = data;
    if (g.schema !== 1 || g.ruleset !== 'interstel-2.05' || g.mode !== 'rules-lab')
        throw new Error('Save version or ruleset is not supported.');
    if (g.width !== 100 || g.height !== 60 || !Array.isArray(g.tiles) || g.tiles.length !== 6000 ||
        !g.tiles.every(t => t === 'land' || t === 'sea'))
        throw new Error('Invalid world dimensions or terrain.');
    if (!Array.isArray(g.players) || !Array.isArray(g.units) || !Array.isArray(g.cities) ||
        typeof g.active !== 'string' || !g.players.some(p => p?.id === g.active) ||
        !Number.isInteger(g.round) || !Number.isInteger(g.nextId) || !Number.isInteger(g.nextEventId) ||
        !g.knowledge || !g.rng || !Array.isArray(g.events))
        throw new Error('Invalid game structure.');
    for (const p of g.players) {
        if (!p || p.productionEfficiency !== 50 || p.combatEfficiency !== 50)
            throw new Error('Unsupported faction efficiencies.');
    }
    for (const city of g.cities) {
        if (!city || !city.position || !Number.isInteger(city.position.x) || !Number.isInteger(city.position.y) ||
            typeof city.progress !== 'number' || city.progress < 0 || typeof city.firstCycle !== 'boolean')
            throw new Error('Invalid city entry.');
    }
    for (const u of g.units) {
        if (!u || !u.position || !Number.isInteger(u.position.x) || !Number.isInteger(u.position.y) ||
            typeof u.spent !== 'number' || u.spent < 0 || typeof u.damage !== 'number' || u.damage < 0)
            throw new Error('Invalid unit entry.');
    }
    const result = structuredClone(g);
    // Rebuild known visibility from current authoritative state while retaining remembered terrain and sightings.
    updateAllKnowledge(result);
    return result;
}
function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DATABASE, 1);
        req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE))
            req.result.createObjectStore(STORE); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
export async function saveLocally(game) {
    const db = await openDB();
    try {
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(exportSave(game), 'autosave');
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
    finally {
        db.close();
    }
}
export async function loadLocal() {
    const db = await openDB();
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).get('autosave');
            req.onsuccess = () => { try {
                resolve(typeof req.result === 'string' ? importSave(req.result) : null);
            }
            catch (err) {
                reject(err);
            } };
            req.onerror = () => reject(req.error);
        });
    }
    finally {
        db.close();
    }
}
