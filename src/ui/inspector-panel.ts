import type {City,Game,PlayerView,Unit} from '../engine/index.js';
import {capacity,cityName,isCoastal,movementAllowance,requiredProductionTurns,STATS,unitName,UNIT_TYPES} from '../engine/index.js';

export function text(value:unknown):string{return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!));}

export function knownUnitName(view:PlayerView,id:string):string {
  const unit=view.ownUnits.find(u=>u.id===id)??view.enemies.find(u=>u.id===id);
  return unit?unitName(unit):id;
}

export function selectedUnitBlock(view:PlayerView,unit:Unit):string {
  const allowance=movementAllowance(unit),stats=STATS[unit.kind],possible=capacity(unit);
  return `<div class="selection-title">${text(unitName(unit))}</div><div class="subtle">${text(stats.name)}</div>
  <div class="subtle">${unit.position.x}, ${unit.position.y} · ${unit.order.kind==='sentry'?'Sentry':unit.order.kind==='move-to'?`Moving to ${unit.order.destination.x}, ${unit.order.destination.y}`:unit.order.kind==='go-direction'?`Continuing ${unit.order.direction.x},${unit.order.direction.y}`:unit.order.kind==='patrol'?`Patrolling ${unit.order.from.x},${unit.order.from.y} ↔ ${unit.order.to.x},${unit.order.to.y}`:unit.order.kind==='load-ship'?'Waiting to load cargo':unit.order.kind==='go-home'?'Returning home':unit.order.kind==='escort'?`Escorting ${text(knownUnitName(view,unit.order.targetId))}`:'Awaiting orders'}</div>
  <div class="data"><div class="datum"><small>Movement</small><strong>${Math.max(0,allowance-unit.spent)} / ${allowance}</strong></div>
  <div class="datum"><small>Damage</small><strong>${unit.damage} / ${stats.hitPoints}</strong></div>
  ${unit.kind==='fighter'?`<div class="datum"><small>Fuel</small><strong>${unit.fuel} / 20</strong></div>`:''}
  ${possible!==null?`<div class="datum"><small>Cargo capacity</small><strong>${possible}</strong></div>`:''}</div>
  ${(unit.kind==='transport'||unit.kind==='carrier')?`<div class="stat-note">Aboard: ${view.ownUnits.filter(u=>u.aboard===unit.id).length} / ${capacity(unit)??0}</div>
  <div class="actions"><button id="loadShipButton">Load Ship</button><button id="unloadShipButton">Unload Ship</button></div><div class="actions">${view.ownUnits.filter(u=>u.aboard===unit.id).map(u=>`<button class="cargoButton" data-cargo="${text(u.id)}">Select ${text(unitName(u))}</button>`).join('')}</div>`:''}
  ${unit.aboard?'<p class="stat-note">Embarked: tap an adjacent legal square to launch or disembark (if movement remains).</p>':''}
  <div class="actions"><button id="moveToButton">Move To</button><button id="directionButton">Go Direction</button><button id="patrolButton">Patrol</button><button id="homeButton">Go Home</button><button id="escortButton">Escort</button><button id="sentryButton">Sentry</button><button id="clearButton">Clear</button><button id="skipButton">Skip move</button></div>
  <p class="stat-note" style="margin-top:12px">Tap an adjacent tile for manual movement, or choose Move To and tap a distant destination. Armies can assault neutral or enemy cities. Combat uses the original manual's normal-efficiency odds with a seeded random stream.</p>`;
}

export function selectedCityBlock(game:Game,city:City):string {
  const coastal=isCoastal(game,city.position);
  const choices=UNIT_TYPES.filter(kind=>coastal||STATS[kind].domain!=='sea');
  const turns=city.production?requiredProductionTurns(city.production,city.firstCycle):null;
  return `<div class="selection-title">${text(cityName(city.id))}</div><div class="subtle">${coastal?'Coastal port':'Inland'} · ${city.position.x}, ${city.position.y}</div>
  <label class="subtle" for="productionSelect">Production</label>
  <select id="productionSelect"><option value="">Choose a unit…</option>${choices.map(kind=>`<option value="${kind}" ${city.production===kind?'selected':''}>${STATS[kind].name} · ${city.firstCycle?STATS[kind].first:STATS[kind].repeat} turns</option>`).join('')}</select>
  <div class="data"><div class="datum"><small>Factory progress</small><strong>${city.progress} / ${turns??'—'}</strong></div>
  <div class="datum"><small>Production phase</small><strong>${city.firstCycle?'Setup':'Repeat'}</strong></div></div>
  <p class="stat-note">Changing unit types discards unfinished production. Production advances at the beginning of your faction's turn.</p>`;
}

export function spectatorUnitBlock(view:PlayerView,unit:Unit):string {
  const stats=STATS[unit.kind];
  const cargo=view.ownUnits.filter(u=>u.aboard===unit.id);
  return `<div class="selection-title">${text(unitName(unit))}</div><div class="subtle">${text(stats.name)}</div>
    <div class="subtle">${text(unit.owner)} · ${unit.position.x}, ${unit.position.y}</div>
    <div class="data"><div class="datum"><small>Movement remaining</small><strong>${Math.max(0,movementAllowance(unit)-unit.spent)}</strong></div>
    <div class="datum"><small>Damage</small><strong>${unit.damage} / ${stats.hitPoints}</strong></div>
    ${unit.kind==='fighter'?`<div class="datum"><small>Fuel</small><strong>${unit.fuel}</strong></div>`:''}
    ${capacity(unit)!==null?`<div class="datum"><small>Cargo</small><strong>${cargo.length} / ${capacity(unit)}</strong></div>`:''}</div>
    <p class="stat-note">Spectator inspection only. No orders can be issued.</p>`;
}

export function spectatorCityBlock(city:City):string {
  const turns=city.production?requiredProductionTurns(city.production,city.firstCycle):null;
  return `<div class="selection-title">${text(cityName(city.id))}</div>
    <div class="subtle">${text(city.owner??'Neutral')} · ${city.position.x}, ${city.position.y}</div>
    <div class="data"><div class="datum"><small>Production</small><strong>${text(city.production??'None')}</strong></div>
    <div class="datum"><small>Progress</small><strong>${city.progress} / ${turns??'—'}</strong></div></div>
    <p class="stat-note">Spectator inspection only. No production changes allowed.</p>`;
}

