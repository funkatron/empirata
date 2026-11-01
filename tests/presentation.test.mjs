import test from 'node:test';
import assert from 'node:assert/strict';
import {cityName,gameOutcome,readableReport,makeRulesLab,exportSave,importSave,advanceLabRound,unitLabel} from '../dist/engine/index.js';
test('Cities retain names through capture and reload; numeric city series stays distinct',()=>{
 const g=makeRulesLab(),names=g.cities.map(c=>cityName(c.id));
 g.cities[0].owner='red';
 assert.deepEqual(importSave(exportSave(g)).cities.map(c=>cityName(c.id)),names);
 assert.equal(new Set(Array.from({length:1000},(_,i)=>cityName(`c${i+1}`))).size,1000);
 assert.ok(cityName('custom-city'));assert.equal(cityName('custom-city'),cityName('custom-city'));
});
test('Elimination counts cities, garrisons, stranded aircraft, third factions and draws',()=>{
 const g=makeRulesLab();assert.equal(gameOutcome(g).state,'ongoing');
 g.cities=g.cities.filter(c=>c.owner!=='red');
 g.units=g.units.filter(u=>u.owner!=='red');
 assert.equal(gameOutcome(g).winner,'blue');
 assert.equal(advanceLabRound(g),g);
 assert.equal(gameOutcome(importSave(exportSave(g))).winner,'blue');
 g.units.push({...g.units[0],id:'u99',owner:'red',kind:'fighter',fuel:1});
 assert.equal(gameOutcome(g).state,'ongoing');
 g.players.push({id:'green',label:'Green',productionEfficiency:50,combatEfficiency:50});
 g.units[0].owner='green';assert.equal(gameOutcome(g).state,'ongoing');
 g.units=[];g.cities=[];assert.equal(gameOutcome(g).winner,null);
});
test('Reports hide diagnostic identifiers and replace city names without partial matches',()=>{
 const g=makeRulesLab(),u=g.units[0];
 const result=readableReport(`${unitLabel(u)} landed at c-blue, c1 and c10.`,[u],[{id:'c-blue'},{id:'c1'},{id:'c10'}]);
 assert.ok(!result.includes('u1'));assert.ok(!result.includes('c-blue'));assert.ok(result.includes(cityName('c10')));
 assert.equal(readableReport('u99 (Blue 99th Infantry Division) lost.',[],[]),'Blue 99th Infantry Division lost.');
});

test('Name wrappers disappear while hull designations, capacities and coordinates remain',()=>{
 const cities=[{id:'c-blue'}];
 const known=[{id:'u1'},{id:'ship'}];
 assert.equal(readableReport('u1 (Blue 1st Infantry Division) landed at c-blue.',known,cities),'Blue 1st Infantry Division landed at Port Victoria.');
 assert.equal(readableReport('ship (BNS Fletcher (DD-1)) boarded (1/6).',known,[]),'BNS Fletcher (DD-1) boarded (1/6).');
 assert.equal(readableReport('u99 (RNS Iowa (BB-99)) lost at (10, 25).',[],[]),'RNS Iowa (BB-99) lost at (10, 25).');
 assert.equal(readableReport('c-blue completed Destroyer (u1 (BNS Fletcher (DD-1))).',known,cities),'Port Victoria completed Destroyer: BNS Fletcher (DD-1).');
 assert.equal(readableReport('c-blue completed Army: u1 (Blue 1st Infantry Division).',known,cities),'Port Victoria completed Army: Blue 1st Infantry Division.');
 assert.equal(readableReport('Neutral city (read-only).',[],[]),'Neutral city (read-only).');
});
