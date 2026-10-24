import { advanceLabRound, capacity, exportSave, getPlayerView, importSave, loadLocal, makeRulesLab, makeCloseQuartersLab, moveUnit, runMoveToOrders, movementAllowance, requiredProductionTurns, saveLocally, selectProduction, setOrder, STATS, UNIT_TYPES, isCoastal } from '../engine/index.js';
const el = (id) => document.getElementById(id);
const canvas = el('map');
const context = canvas.getContext('2d');
if (!context)
    throw new Error('Canvas 2D is unavailable.');
const ctx = context;
let game = makeCloseQuartersLab();
let view = getPlayerView(game, 'blue');
let selectedUnit = 'u1', selectedCity = null;
let tileSize = 30, cameraX = 0, cameraY = 0;
let down = null;
let hydrated = false;
let choosingDestination = false;
let choosingOrder = 'move-to';
const colors = { sea: '#23485f', land: '#516e50', unseen: '#0b1821', blue: '#68c4f1', red: '#f47c73', neutral: '#e2c37c' };
function uiMessage(message) { el('toast').textContent = message; }
function dispatch(operation) {
    try {
        const before = game.nextEventId;
        game = operation();
        view = getPlayerView(game, 'blue');
        if (selectedUnit && !view.ownUnits.some(u => u.id === selectedUnit))
            selectedUnit = null;
        refresh();
        const result = view.events.filter(e => e.id >= before && e.kind === 'combat').at(-1);
        if (result)
            uiMessage(result.message);
        void saveLocally(game).catch(() => uiMessage('Local save unavailable; use Export JSON.'));
        return true;
    }
    catch (error) {
        uiMessage(error instanceof Error ? error.message : String(error));
        return false;
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
    if (choosingDestination && selectedUnit) {
        choosingDestination = false;
        const id = selectedUnit;
        const origin = view.ownUnits.find(u => u.id === id)?.position;
        if (!origin)
            return;
        const dx = pos.x - origin.x, dy = pos.y - origin.y;
        const order = choosingOrder === 'go-direction' ?
            { kind: 'go-direction', direction: { x: Math.sign(dx), y: Math.sign(dy) } } :
            choosingOrder === 'patrol' ? { kind: 'patrol', from: { ...origin }, to: pos, outbound: true } :
                { kind: 'move-to', destination: pos };
        if (dispatch(() => runMoveToOrders(setOrder(game, id, order))))
            uiMessage(`${choosingOrder} order assigned for ${id}.`);
        return;
    }
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
            const targetCity = cell?.city?.owner !== 'blue' ? cell?.city : null;
            if (dispatch(() => moveUnit(game, selectedUnit, pos)) && targetCity) {
                const newlyOwned = view.ownCities.find(c => c.id === targetCity.id);
                if (newlyOwned) {
                    selectedUnit = null;
                    selectedCity = newlyOwned.id;
                    refresh();
                }
            }
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
  <div class="subtle">${unit.position.x}, ${unit.position.y} · ${unit.order.kind === 'sentry' ? 'Sentry' : unit.order.kind === 'move-to' ? `Moving to ${unit.order.destination.x}, ${unit.order.destination.y}` : unit.order.kind === 'go-direction' ? `Continuing ${unit.order.direction.x},${unit.order.direction.y}` : unit.order.kind === 'patrol' ? `Patrolling ${unit.order.from.x},${unit.order.from.y} ↔ ${unit.order.to.x},${unit.order.to.y}` : 'Awaiting orders'}</div>
  <div class="data"><div class="datum"><small>Movement</small><strong>${Math.max(0, allowance - unit.spent)} / ${allowance}</strong></div>
  <div class="datum"><small>Damage</small><strong>${unit.damage} / ${stats.hitPoints}</strong></div>
  ${unit.kind === 'fighter' ? `<div class="datum"><small>Fuel</small><strong>${unit.fuel} / 20</strong></div>` : ''}
  ${possible !== null ? `<div class="datum"><small>Cargo capacity</small><strong>${possible}</strong></div>` : ''}</div>
  <div class="actions"><button id="moveToButton">Move To</button><button id="directionButton">Go Direction</button><button id="patrolButton">Patrol</button><button id="sentryButton">Sentry</button><button id="clearButton">Clear</button><button id="skipButton">Skip move</button></div>
  <p class="stat-note" style="margin-top:12px">Tap an adjacent tile for manual movement, or choose Move To and tap a distant destination. Armies can assault neutral or enemy cities. Combat uses the original manual's normal-efficiency odds with a seeded random stream.</p>`;
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
    el('scenarioName').textContent = game.scenario === 'close-quarters' ? 'CLOSE QUARTERS · PLAYABLE' : 'CLASSIC RULES LAB';
    el('threatCount').textContent = String(view.enemies.filter(u => !u.stale).length);
    const unit = view.ownUnits.find(u => u.id === selectedUnit);
    const city = view.ownCities.find(c => c.id === selectedCity);
    const inspector = el('inspector');
    if (unit)
        inspector.innerHTML = selectedUnitBlock(unit);
    else if (city)
        inspector.innerHTML = selectedCityBlock(city);
    else
        inspector.innerHTML = '<p>Select a blue unit, then tap an adjacent enemy to attack. Select a city to assign production. Red will respond on the next round using a preliminary rules-bound AI.</p>';
    const moveButton = document.getElementById('moveToButton');
    if (moveButton && unit)
        moveButton.addEventListener('click', () => { choosingOrder = 'move-to'; choosingDestination = true; uiMessage('Tap a map tile to set destination. Drag to pan.'); });
    for (const [button, kind, hint] of [['directionButton', 'go-direction', 'Tap an adjacent tile to choose a compass bearing.'], ['patrolButton', 'patrol', 'Tap a destination for the patrol route.']]) {
        document.getElementById(button)?.addEventListener('click', () => { choosingOrder = kind; choosingDestination = true; uiMessage(hint); });
    }
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
        choosingDestination = false;
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
    tapTile({ x: u.position.x + delta.x, y: u.position.y + delta.y });
});
el('nextRound').addEventListener('click', () => { dispatch(() => advanceLabRound(game)); uiMessage(`Round ${game.round}. Red has completed its response turn.`); });
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
        choosingDestination = false;
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
function startScenario(kind) {
    if (!window.confirm('Start a new test scenario? This will replace the current local autosave. Export JSON first if you want to keep it.'))
        return;
    choosingDestination = false;
    game = kind === 'close-quarters' ? makeCloseQuartersLab() : makeRulesLab();
    selectedUnit = 'u1';
    selectedCity = null;
    refresh();
    focus({ x: 9, y: 25 });
    void saveLocally(game).catch(() => uiMessage('Local save unavailable; export JSON.'));
    uiMessage(kind === 'close-quarters' ? 'Close Quarters ready: select a blue unit and tap an adjacent enemy or gold city to attack.' : 'Classic rules lab reset.');
}
el('newGame').addEventListener('click', () => startScenario('close-quarters'));
el('startSkirmish').addEventListener('click', () => startScenario('close-quarters'));
el('classicGame').addEventListener('click', () => startScenario('classic-lab'));
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
    selectedUnit = game.units.some(u => u.id === 'u1' && u.owner === 'blue') ? 'u1' : null;
    refresh();
    focus({ x: 9, y: 25 });
    if (game.scenario === 'close-quarters')
        uiMessage('Select a blue unit, then tap an adjacent red unit or gold city to fight.');
    else
        uiMessage('Existing saved game restored. Choose Start Close Quarters to try the immediate combat scenario.');
}
void boot();
