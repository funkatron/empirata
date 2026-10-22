import { adjudicateCombat, adjudicateCityCapture, advanceLabRound, capacity, exportSave, getPlayerView, importSave, loadLocal, makeRulesLab, moveUnit, movementAllowance, requiredProductionTurns, saveLocally, selectProduction, setOrder, STATS, UNIT_TYPES, isCoastal, updateAllKnowledge } from '../engine/index.js';
const el = (id) => document.getElementById(id);
const canvas = el('map');
const context = canvas.getContext('2d');
if (!context)
    throw new Error('Canvas 2D is unavailable.');
const ctx = context;
let game = makeRulesLab();
let view = getPlayerView(game, 'blue');
let selectedUnit = null, selectedCity = null;
let tileSize = 30, cameraX = 0, cameraY = 0;
let down = null;
let hydrated = false;
const colors = { sea: '#23485f', land: '#516e50', unseen: '#0b1821', blue: '#68c4f1', red: '#f47c73', neutral: '#e2c37c' };
function uiMessage(message) { el('toast').textContent = message; }
function dispatch(operation) {
    try {
        game = operation();
        view = getPlayerView(game, 'blue');
        refresh();
        void saveLocally(game).catch(() => uiMessage('Local save unavailable; use Export JSON.'));
    }
    catch (error) {
        uiMessage(error instanceof Error ? error.message : String(error));
    }
}
function resize() {
    const rect = canvas.getBoundingClientRect(), ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    clamp();
    paint();
}
function clamp() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    cameraX = Math.max(0, Math.min(cameraX, Math.max(0, game.width * tileSize - w)));
    cameraY = Math.max(0, Math.min(cameraY, Math.max(0, game.height * tileSize - h)));
}
function focus(p) {
    cameraX = p.x * tileSize - canvas.clientWidth / 2;
    cameraY = p.y * tileSize - canvas.clientHeight / 2;
    clamp();
    paint();
}
function zoom(change) {
    const old = tileSize;
    tileSize = Math.max(11, Math.min(45, tileSize + change));
    cameraX = (cameraX + canvas.clientWidth / 2) * (tileSize / old) - canvas.clientWidth / 2;
    cameraY = (cameraY + canvas.clientHeight / 2) * (tileSize / old) - canvas.clientHeight / 2;
    clamp();
    paint();
}
function paint() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#08131b';
    ctx.fillRect(0, 0, w, h);
    const sx = Math.max(0, Math.floor(cameraX / tileSize)), ex = Math.min(game.width, Math.ceil((cameraX + w) / tileSize));
    const sy = Math.max(0, Math.floor(cameraY / tileSize)), ey = Math.min(game.height, Math.ceil((cameraY + h) / tileSize));
    for (let y = sy; y < ey; y++)
        for (let x = sx; x < ex; x++) {
            const i = y * game.width + x, c = view.cells[i];
            const px = x * tileSize - cameraX, py = y * tileSize - cameraY;
            ctx.fillStyle = c.terrain === null ? colors.unseen : c.terrain === 'land' ? colors.land : colors.sea;
            ctx.fillRect(px, py, tileSize + 0.25, tileSize + 0.25);
            if (c.terrain !== null && !c.visible) {
                ctx.fillStyle = 'rgba(3,13,22,.52)';
                ctx.fillRect(px, py, tileSize, tileSize);
            }
            ctx.strokeStyle = 'rgba(120,159,166,.12)';
            ctx.lineWidth = .65;
            ctx.strokeRect(px + .3, py + .3, tileSize - .6, tileSize - .6);
            if (c.city) {
                const ink = c.city.owner === 'blue' ? colors.blue : c.city.owner === 'red' ? colors.red : colors.neutral;
                ctx.fillStyle = ink;
                const r = Math.max(3, tileSize * .29);
                ctx.fillRect(px + tileSize / 2 - r, py + tileSize / 2 - r, r * 2, r * 2);
                ctx.fillStyle = '#122432';
                ctx.fillRect(px + tileSize / 2 - 1.5, py + tileSize / 2 - 1.5, 3, 3);
                if (c.city.id === selectedCity) {
                    ctx.strokeStyle = '#fff7c4';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
                }
            }
        }
    const displayUnits = [...view.enemies.map(e => ({ id: e.id, kind: e.kind, position: e.position, owner: e.owner, stale: e.stale })),
        ...view.ownUnits.filter(u => !u.aboard).map(u => ({ id: u.id, kind: u.kind, position: u.position, owner: u.owner, stale: false }))];
    for (const u of displayUnits) {
        const x = u.position.x * tileSize - cameraX, y = u.position.y * tileSize - cameraY;
        if (x < -tileSize || y < -tileSize || x > w || y > h)
            continue;
        const inset = tileSize * .08, side = tileSize * .84;
        ctx.globalAlpha = u.stale ? .48 : 1;
        ctx.fillStyle = u.owner === 'blue' ? '#173f65' : '#652923';
        ctx.fillRect(x + inset, y + inset, side, side);
        ctx.strokeStyle = u.owner === 'blue' ? colors.blue : colors.red;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + inset, y + inset, side, side);
        ctx.fillStyle = u.owner === 'blue' ? '#b6e5ff' : '#ffc5be';
        ctx.font = `bold ${Math.max(10, tileSize * .52)}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText({ army: 'A', fighter: 'F', destroyer: 'D', transport: 'T', submarine: 'S', cruiser: 'C', carrier: 'V', battleship: 'B' }[u.kind], x + tileSize / 2, y + tileSize / 2 + .5);
        ctx.globalAlpha = 1;
        if (u.id === selectedUnit) {
            ctx.strokeStyle = '#fff0a4';
            ctx.lineWidth = 2.3;
            ctx.strokeRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
        }
    }
}
function cellFromPointer(ev) {
    const rect = canvas.getBoundingClientRect();
    return { x: Math.floor((ev.clientX - rect.left + cameraX) / tileSize), y: Math.floor((ev.clientY - rect.top + cameraY) / tileSize) };
}
function tapTile(pos) {
    if (pos.x < 0 || pos.y < 0 || pos.x >= game.width || pos.y >= game.height)
        return;
    const units = view.ownUnits.filter(u => !u.aboard && u.position.x === pos.x && u.position.y === pos.y);
    const cityHere = view.ownCities.find(c => c.position.x === pos.x && c.position.y === pos.y);
    if (units.length) {
        // Cycling reaches the production screen even when friendly units occupy a city.
        if (cityHere && selectedUnit === units[units.length - 1]?.id) {
            selectedUnit = null;
            selectedCity = cityHere.id;
            refresh();
            return;
        }
        const last = units.findIndex(u => u.id === selectedUnit);
        selectedUnit = units[(last + 1) % units.length].id;
        selectedCity = null;
        refresh();
        return;
    }
    const cell = view.cells[pos.y * game.width + pos.x];
    if (selectedUnit) {
        const unit = view.ownUnits.find(u => u.id === selectedUnit);
        if (unit && Math.max(Math.abs(unit.position.x - pos.x), Math.abs(unit.position.y - pos.y)) === 1) {
            dispatch(() => moveUnit(game, selectedUnit, pos));
            return;
        }
    }
    const city = view.ownCities.find(c => c.position.x === pos.x && c.position.y === pos.y);
    if (city) {
        selectedCity = city.id;
        selectedUnit = null;
        refresh();
        return;
    }
    if (cell?.city) {
        selectedCity = null;
        selectedUnit = null;
        uiMessage(`City ${cell.city.id} · ${cell.city.owner ?? 'neutral'} (read-only)`);
        refresh();
        return;
    }
    selectedCity = null;
    selectedUnit = null;
    refresh();
}
function text(value) { return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function selectedUnitBlock(unit) {
    const allowance = movementAllowance(unit), stats = STATS[unit.kind], possible = capacity(unit);
    return `<div class="selection-title">${text(stats.name)} <span class="subtle">#${text(unit.id)}</span></div>
  <div class="subtle">${unit.position.x}, ${unit.position.y} · ${unit.order.kind === 'sentry' ? 'Sentry' : 'Awaiting orders'}</div>
  <div class="data"><div class="datum"><small>Movement</small><strong>${Math.max(0, allowance - unit.spent)} / ${allowance}</strong></div>
  <div class="datum"><small>Damage</small><strong>${unit.damage} / ${stats.hitPoints}</strong></div>
  ${unit.kind === 'fighter' ? `<div class="datum"><small>Fuel</small><strong>${unit.fuel} / 20</strong></div>` : ''}
  ${possible !== null ? `<div class="datum"><small>Cargo capacity</small><strong>${possible}</strong></div>` : ''}</div>
  <div class="actions"><button id="sentryButton">Sentry</button><button id="clearButton">Clear</button><button id="skipButton">Skip move</button></div>
  <p class="stat-note" style="margin-top:12px">Tap an adjacent tile, use arrow keys, or Q/E/Z/C for diagonal movement. Automatic combat/capture are still blocked until the original probability rules are verified. Use the scripted test scenarios to inspect known outcomes.</p>`;
}
function selectedCityBlock(city) {
    const coastal = isCoastal(game, city.position);
    const choices = UNIT_TYPES.filter(kind => coastal || STATS[kind].domain !== 'sea');
    const turns = city.production ? requiredProductionTurns(city.production, city.firstCycle) : null;
    return `<div class="selection-title">City ${text(city.id)}</div><div class="subtle">${coastal ? 'Coastal port' : 'Inland'} · ${city.position.x}, ${city.position.y}</div>
  <label class="subtle" for="productionSelect">Production</label>
  <select id="productionSelect"><option value="">Choose a unit…</option>${choices.map(kind => `<option value="${kind}" ${city.production === kind ? 'selected' : ''}>${STATS[kind].name} · ${city.firstCycle ? STATS[kind].first : STATS[kind].repeat} turns</option>`).join('')}</select>
  <div class="data"><div class="datum"><small>Factory progress</small><strong>${city.progress} / ${turns ?? '—'}</strong></div>
  <div class="datum"><small>Production phase</small><strong>${city.firstCycle ? 'Setup' : 'Repeat'}</strong></div></div>
  <p class="stat-note">Changing unit types discards unfinished production. Production advances at the beginning of your faction's turn.</p>`;
}
function refresh() {
    view = getPlayerView(game, 'blue');
    el('round').textContent = `ROUND ${game.round}`;
    el('cityCount').textContent = String(view.ownCities.length);
    el('unitCount').textContent = String(view.ownUnits.length);
    const unit = view.ownUnits.find(u => u.id === selectedUnit);
    const city = view.ownCities.find(c => c.id === selectedCity);
    const inspector = el('inspector');
    if (unit)
        inspector.innerHTML = selectedUnitBlock(unit);
    else if (city)
        inspector.innerHTML = selectedCityBlock(city);
    else
        inspector.innerHTML = '<p>Select a blue unit or city on the map to see its details and available orders.</p><p class="stat-note" style="margin-top:12px">This test map contains extra starting units for engineering validation; it is not a historical opening position.</p>';
    const productionSelect = document.getElementById('productionSelect');
    if (productionSelect && city)
        productionSelect.addEventListener('change', () => {
            if (productionSelect.value)
                dispatch(() => selectProduction(game, city.id, productionSelect.value));
        });
    for (const [button, kind] of [['sentryButton', 'sentry'], ['clearButton', 'none'], ['skipButton', 'skip']]) {
        const target = document.getElementById(button);
        if (target && unit)
            target.addEventListener('click', () => dispatch(() => setOrder(game, unit.id, { kind })));
    }
    el('events').innerHTML = [...view.events].reverse().slice(0, 8).map(e => `<div class="report"><span>ROUND ${e.round} / ${e.kind.toUpperCase()}</span>${text(e.message)}</div>`).join('') || '<p>No reports.</p>';
    paint();
}
canvas.addEventListener('pointerdown', ev => {
    if (ev.button !== 0)
        return;
    canvas.setPointerCapture(ev.pointerId);
    down = { x: ev.clientX, y: ev.clientY, cameraX, cameraY, moved: false };
    canvas.focus({ preventScroll: true });
});
canvas.addEventListener('pointermove', ev => {
    if (!down)
        return;
    const dx = ev.clientX - down.x, dy = ev.clientY - down.y;
    if (Math.abs(dx) + Math.abs(dy) > 6)
        down.moved = true;
    if (down.moved) {
        cameraX = down.cameraX - dx;
        cameraY = down.cameraY - dy;
        clamp();
        paint();
    }
});
canvas.addEventListener('pointerup', ev => {
    if (!down)
        return;
    const wasMoved = down.moved;
    down = null;
    if (!wasMoved)
        tapTile(cellFromPointer(ev));
});
canvas.addEventListener('pointercancel', () => { down = null; });
canvas.addEventListener('wheel', ev => { ev.preventDefault(); zoom(ev.deltaY < 0 ? 2 : -2); }, { passive: false });
document.addEventListener('keydown', ev => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey)
        return;
    const target = ev.target;
    if (target.matches('input,textarea,select,button,[contenteditable="true"]'))
        return;
    const moves = { ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
        q: { x: -1, y: -1 }, e: { x: 1, y: -1 }, z: { x: -1, y: 1 }, c: { x: 1, y: 1 } };
    if (ev.key === 'Escape') {
        selectedUnit = null;
        selectedCity = null;
        refresh();
        return;
    }
    if (ev.key === '+' || ev.key === '=') {
        zoom(3);
        return;
    }
    if (ev.key === '-') {
        zoom(-3);
        return;
    }
    const delta = moves[ev.key];
    if (!delta || !selectedUnit)
        return;
    const u = view.ownUnits.find(u => u.id === selectedUnit);
    if (!u)
        return;
    ev.preventDefault();
    dispatch(() => moveUnit(game, selectedUnit, { x: u.position.x + delta.x, y: u.position.y + delta.y }));
});
el('demoCapture').addEventListener('click', () => {
    dispatch(() => {
        const lab = makeRulesLab();
        lab.cities.push({ id: 'c-demo', position: { x: 10, y: 25 }, owner: null, production: null, progress: 0, firstCycle: true });
        updateAllKnowledge(lab);
        return adjudicateCityCapture(lab, { armyId: 'u1', cityId: 'c-demo', outcome: 'captured' });
    });
    selectedUnit = null;
    selectedCity = 'c-demo';
    refresh();
    focus({ x: 10, y: 25 });
    uiMessage('Scripted city capture: successful outcome supplied by test fixture, NOT random gameplay.');
});
el('demoCombat').addEventListener('click', () => {
    dispatch(() => {
        const lab = makeRulesLab();
        const template = lab.units.find(u => u.id === 'u2');
        lab.units.push({ ...structuredClone(template), id: 'u-fixture-sub', kind: 'submarine', owner: 'red',
            position: { x: 6, y: 25 }, damage: 0, spent: 0, aboard: null });
        updateAllKnowledge(lab);
        return adjudicateCombat(lab, { attackerId: 'u2', defenderId: 'u-fixture-sub', hits: ['attacker', 'attacker'] });
    });
    selectedCity = null;
    selectedUnit = 'u2';
    refresh();
    focus({ x: 6, y: 25 });
    uiMessage('Scripted naval battle: two destroyer hits supplied by test fixture, NOT computed odds.');
});
el('nextRound').addEventListener('click', () => { dispatch(() => advanceLabRound(game)); uiMessage(`Round ${game.round}. Opponent passed; no AI is implemented yet.`); });
el('zoomIn').addEventListener('click', () => zoom(4));
el('zoomOut').addEventListener('click', () => zoom(-4));
el('recenter').addEventListener('click', () => focus(view.ownUnits.find(u => u.id === selectedUnit)?.position ?? view.ownCities[0]?.position ?? { x: 8, y: 25 }));
el('exportSave').addEventListener('click', () => {
    const data = new Blob([exportSave(game)], { type: 'application/json' }), url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `empirata-lab-round-${game.round}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
});
el('importSave').addEventListener('click', () => el('saveFile').click());
el('saveFile').addEventListener('change', async () => {
    const input = el('saveFile'), file = input.files?.[0];
    if (!file)
        return;
    try {
        const loaded = importSave(await file.text());
        if (loaded.active !== 'blue')
            throw new Error('This lab UI only supports saves during the blue faction turn.');
        game = loaded;
        selectedUnit = null;
        selectedCity = null;
        refresh();
        void saveLocally(game);
        uiMessage('Saved game imported.');
    }
    catch (error) {
        uiMessage(error instanceof Error ? error.message : 'Save could not be loaded.');
    }
    finally {
        input.value = '';
    }
});
el('newGame').addEventListener('click', () => {
    if (!window.confirm('Reset this lab? Your saved progress will be replaced.'))
        return;
    game = makeRulesLab();
    selectedUnit = null;
    selectedCity = null;
    refresh();
    focus({ x: 8, y: 25 });
    void saveLocally(game);
    uiMessage('Rules lab reset.');
});
new ResizeObserver(resize).observe(canvas);
async function boot() {
    try {
        const saved = await loadLocal();
        if (saved?.active === 'blue')
            game = saved;
    }
    catch {
        uiMessage('Could not load local autosave; use Import JSON if needed.');
    }
    if (hydrated)
        return;
    hydrated = true;
    refresh();
    focus({ x: 8, y: 25 });
}
void boot();
