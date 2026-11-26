import test from 'node:test';
import assert from 'node:assert/strict';
import {cityName,gameOutcome,readableReport,reportParts,makeRulesLab,exportSave,importSave,advanceLabRound,unitLabel} from '../dist/engine/index.js';
test('Cities retain names through capture and reload without numeric suffixes',()=>{
 const g=makeRulesLab(),names=g.cities.map(c=>cityName(c.id));
 g.cities[0].owner='red';
 assert.deepEqual(importSave(exportSave(g)).cities.map(c=>cityName(c.id)),names);
 assert.equal(new Set(Array.from({length:256},(_,i)=>cityName(`c${i+1}`))).size,256);
 assert.ok(Array.from({length:1000},(_,i)=>cityName(`c${i+1}`)).every(name=>!/\s\d+$/.test(name)));
 assert.ok(!/\s\d+$/.test(cityName('generated-0')));
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

test('Legacy infantry and fighter production reports unwrap before unit identification',()=>{
 for(const [kind,name] of [['Army','Blue 1st Infantry Division'],['Fighter','Blue 1st Fighter Squadron “Eagles”']]){
  for(const units of [[],[{id:'u1'}]]){
   assert.equal(readableReport(`c-blue completed ${kind} (u1 (${name})).`,units,[{id:'c-blue'}]),`Port Victoria completed ${kind}: ${name}.`);
  }
 }
});

test('Report parts expose named unit and city references and drop internal tags',()=>{
 const parts=reportParts('u3 (Blue 3rd Infantry Division) was lost attacking c-red (ALG-AI-003).',[{id:'u3'}],[{id:'c-red'}]);
 assert.deepEqual(parts,[
  {unit:'u3',name:'Blue 3rd Infantry Division'},
  {text:' was lost attacking '},
  {city:'c-red',name:cityName('c-red')},
  {text:'.'},
 ]);
});

test('Cargo losses name the lost unit instead of its internal id',()=>{
 const g=makeRulesLab();
 const ship={...g.units[0],id:'u50',kind:'transport',owner:'blue'};
 const lost=unitLabel({id:'u51',owner:'blue',kind:'army'});
 const shown=readableReport(`${lost} was lost when ${unitLabel(ship)} exceeded capacity.`,[ship],[]);
 assert.ok(!/\bu\d+\b/.test(shown),shown);
 assert.match(shown,/^Blue 51st Infantry Division was lost/);
});

test('Displayed reports never contain raw unit ids for a full lab round',()=>{
 let g=makeRulesLab();
 for(let i=0;i<5;i++)g=advanceLabRound(g);
 for(const e of g.events){
  const shown=readableReport(e.message,g.units,g.cities);
  assert.ok(!/(^|[^\w-])u\d+([^\w-]|$)/.test(shown),shown);
  assert.ok(!/ALG-/.test(shown),shown);
 }
});
