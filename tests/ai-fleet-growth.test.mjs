import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,endTurn,playRedOpponent,updateAllKnowledge,getPlayerView,chooseAiTransportObjective,planAiReconLandingSquare} from '../dist/engine/index.js';

function fleet(){
 const g=endTurn(makeRulesLab()),base=g.units.find(u=>u.owner==='red');
 for(let i=0;i<8;i++)g.units.push({...structuredClone(base),id:`reserve-${i}`,position:{x:80,y:36}});
 g.units.push({...structuredClone(base),id:'scout',kind:'destroyer',position:{x:84,y:36}});
 g.units.push({...structuredClone(base),id:'transport',kind:'transport',position:{x:85,y:36}});
 updateAllKnowledge(g);return g;
}
test('A supplied faction commissions a second transport and retains its progress',()=>{
 const g=fleet(),home=g.cities.find(c=>c.id==='c-red');
 g.units.push({...structuredClone(g.units.find(u=>u.id==='scout')),id:'second-scout',position:{x:86,y:36}});updateAllKnowledge(g);
 assert.equal(playRedOpponent(g).cities.find(c=>c.id===home.id).production,'transport');
 home.production='transport';home.progress=8;
 const next=playRedOpponent(g).cities.find(c=>c.id===home.id);
 assert.equal(next.production,'transport');assert.equal(next.progress,8);
});
test('An expanding faction commissions a second reconnaissance destroyer',()=>{
 const g=fleet();
 g.units.push({...structuredClone(g.units.find(u=>u.id==='transport')),id:'sufficient-transport',position:{x:86,y:36}});
 for(const [id,x,y] of [['port-a',79,35],['port-b',79,37]])g.cities.push({id,position:{x,y},owner:'red',production:null,progress:0,firstCycle:true});
 updateAllKnowledge(g);
 const next=playRedOpponent(g);
 assert.ok(next.cities.some(c=>c.owner==='red'&&c.production==='destroyer'));
 assert.equal(next.cities.filter(c=>c.production==='destroyer').length,1,'Count other factories already assigned to scouts');
});
test('New expeditions prefer an unassigned known city; existing missions remain stable',()=>{
 const g=fleet(),view=getPlayerView(g,'red'),ship=view.ownUnits.find(u=>u.id==='transport');
 view.ownUnits.push({...structuredClone(view.ownUnits[0]),id:'cargo',aboard:ship.id});
 for(const [id,x] of [['near',84],['far',90]])view.cells[36*view.width+x]={terrain:'land',visible:true,city:{id,owner:null,production:null,productionKnown:false}};
 view.ownUnits.push({...structuredClone(ship),id:'partner',aiObjective:'near'});
 assert.equal(chooseAiTransportObjective(view,ship),'far');
 ship.aiObjective='near';assert.equal(chooseAiTransportObjective(view,ship),'near');
});
test('Reconnaissance drops use unknown land frontiers and avoid already supplied regions',()=>{
 const g=fleet(),view=getPlayerView(g,'red'),ship=view.ownUnits.find(u=>u.id==='transport');
 ship.position={x:50,y:30};
 view.cells[30*view.width+51]={terrain:'land',visible:true,city:null};
 assert.deepEqual(planAiReconLandingSquare(view,ship),{x:51,y:30});
 const scout={...structuredClone(view.ownUnits[0]),id:'land-scout',aboard:null,position:{x:51,y:30}};
 view.ownUnits.push(scout);assert.equal(planAiReconLandingSquare(view,ship),null);
 view.ownUnits.pop();view.ownCities.push({id:'supply',position:{x:51,y:30}});
 assert.equal(planAiReconLandingSquare(view,ship),null);
 view.ownCities.pop();ship.aiObjective='assault';assert.equal(planAiReconLandingSquare(view,ship),null);
});

test('A destroyer attacks a fresh adjacent transport before scouting',()=>{
 const g=fleet(),destroyer=g.units.find(u=>u.id==='scout');
 destroyer.position={x:84,y:36};
 g.units.push({...structuredClone(g.units.find(u=>u.id==='transport')),id:'enemy-transport',owner:'blue',position:{x:84,y:35}});
 g.tiles[35*g.width+84]='sea';updateAllKnowledge(g);
 const next=playRedOpponent(g);
 assert.ok(next.events.some(e=>e.kind==='combat'&&e.message.includes('enemy-transport')));
 const stale=structuredClone(g);stale.units.find(u=>u.id==='enemy-transport').position={x:40,y:55};updateAllKnowledge(stale);
 assert.ok(!playRedOpponent(stale).events.some(e=>e.kind==='combat'&&e.message.includes('enemy-transport')));
});

test('Reconnaissance can add a distant drop site on the same charted landmass',()=>{
 const g=fleet(),view=getPlayerView(g,'red'),ship=view.ownUnits.find(u=>u.id==='transport');ship.position={x:50,y:30};
 for(let x=51;x<=64;x++)view.cells[30*view.width+x]={terrain:'land',visible:true,city:null};
 view.ownUnits.push({...structuredClone(view.ownUnits[0]),id:'distant-scout',aboard:null,position:{x:64,y:30}});
 assert.deepEqual(planAiReconLandingSquare(view,ship),{x:51,y:30});
});

test('A distant landed scout explores instead of returning to supply on the same landmass',()=>{
 const g=endTurn(makeRulesLab()),base=g.units.find(u=>u.owner==='red');
 g.units.push({...structuredClone(base),id:'landed-scout',position:{x:90,y:36}});
 g.units.push({...structuredClone(base),id:'ship',kind:'transport',position:{x:90,y:35}});
 g.units.push({...structuredClone(base),id:'cargo',aboard:'ship',position:{x:90,y:35}});
 g.tiles.fill('sea');
 for(const city of g.cities)g.tiles[city.position.y*g.width+city.position.x]='land';
 for(let x=79;x<=95;x++)g.tiles[36*g.width+x]='land';
 updateAllKnowledge(g);
 g.knowledge.red.terrain=g.tiles.map((tile,i)=>i%g.width<=95?tile:null);
 const next=playRedOpponent(g);
 assert.deepEqual(next.units.find(u=>u.id==='landed-scout').position,{x:91,y:36});
});

test('A strong expedition may scout an unguarded distant coast while retaining its assault force',()=>{
 const g=fleet(),view=getPlayerView(g,'red'),ship=view.ownUnits.find(u=>u.id==='transport');
 ship.position={x:50,y:30};ship.aiObjective='distant';
 view.cells[30*view.width+51]={terrain:'land',visible:true,city:null};
 view.cells[30*view.width+90]={terrain:'land',visible:true,city:{id:'distant',owner:null}};
 for(let i=0;i<4;i++)view.ownUnits.push({...structuredClone(view.ownUnits[0]),id:`cargo-${i}`,aboard:ship.id,position:{...ship.position}});
 assert.deepEqual(planAiReconLandingSquare(view,ship),{x:51,y:30});
 view.enemies.push({id:'guard',kind:'army',owner:'blue',position:{x:52,y:30},stale:false});
 assert.equal(planAiReconLandingSquare(view,ship),null);
 view.enemies[0].stale=true;assert.deepEqual(planAiReconLandingSquare(view,ship),{x:51,y:30});
 view.ownUnits.pop();assert.equal(planAiReconLandingSquare(view,ship),null);
});

test('A hostile city can receive a second transport before an easier distant neutral objective',()=>{
 const g=fleet(),view=getPlayerView(g,'red'),ship=view.ownUnits.find(u=>u.id==='transport');
 view.ownUnits.push({...structuredClone(view.ownUnits[0]),id:'cargo',aboard:ship.id});
 view.cells[36*view.width+84]={terrain:'land',visible:true,city:{id:'hostile',owner:'blue'}};
 view.cells[36*view.width+94]={terrain:'land',visible:true,city:{id:'neutral',owner:null}};
 view.ownUnits.push({...structuredClone(ship),id:'partner',aiObjective:'hostile'});
 assert.equal(chooseAiTransportObjective(view,ship),'hostile');
 view.ownUnits.push({...structuredClone(ship),id:'partner-2',aiObjective:'hostile'});
 assert.equal(chooseAiTransportObjective(view,ship),'neutral');
});
