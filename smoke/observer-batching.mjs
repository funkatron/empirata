import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
// Exercise the built UI's actual playback coordinator with deterministic timers.
const source=await readFile(new URL('../dist/ui/main.js',import.meta.url),'utf8');
function observer(count,finish=Infinity){
 const nodes=new Map(),timers=new Map();let id=0,paints=0;const saves=[];
 const el=key=>{if(!nodes.has(key))nodes.set(key,{textContent:'',hidden:true,disabled:false});return nodes.get(key);};
 const c=vm.createContext({game:{scenario:'ai-vs-ai',round:1,nextEventId:0},observer:'blue',spectatorMode:'alternate',
 gameOutcome:g=>({state:g.round>=finish?'finished':'ongoing'}),el,document:{getElementById:el},getPlayerView:()=>({ownUnits:[],events:[]}),
 advanceLabRound:g=>({...g,round:g.round+1}),refresh:()=>{paints++;},saveLocally:g=>{saves.push(g.round);return Promise.resolve();},
 setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:key=>timers.delete(key)});
 vm.runInContext(source.slice(source.indexOf('let playback ='),source.indexOf('function resize()')),c);
 vm.runInContext(`roundsPerAdvance=${count}`,c);
 return {run:s=>vm.runInContext(s,c),step:()=>{const [key,fn]=timers.entries().next().value;timers.delete(key);fn();},el,saves,paints:()=>paints,round:()=>c.game.round};
}
for(const count of [1,10,50,100])test(`Observer ${count}-round batch redraws and saves once at completion`,()=>{
 const o=observer(count);o.run('startRoundPlayback(false)');
 for(let i=0;i<count;i++){assert.equal(o.paints(),0);assert.deepEqual(o.saves,[]);o.step();}
 assert.equal(o.round(),count+1);assert.equal(o.paints(),1);assert.deepEqual(o.saves,[count+1]);assert.equal(o.el('roundProgress').hidden,true);
});
test('Pause flushes a partial batch and cancels pending advancement',()=>{
 const o=observer(100);o.run('startRoundPlayback(false)');for(let i=0;i<3;i++)o.step();
 assert.equal(o.paints(),0);assert.equal(o.el('roundProgressText').textContent,'3 / 100');
 o.run('pausePlayback()');assert.equal(o.paints(),1);assert.deepEqual(o.saves,[4]);assert.equal(o.round(),4);
 o.run('pausePlayback()');assert.equal(o.paints(),1);
});
test('Repeated playback honors the next selected batch size',()=>{
 const o=observer(1);o.run('startRoundPlayback(true)');o.step();assert.equal(o.paints(),1);
 o.run('roundsPerAdvance=10');for(let i=0;i<10;i++)o.step();assert.equal(o.round(),12);assert.equal(o.paints(),2);assert.deepEqual(o.saves,[2,12]);o.run('pausePlayback()');
});

test('Game over stops a batch early and saves the final completed position',()=>{
 const o=observer(100,4);o.run('startRoundPlayback(true)');o.step();o.step();o.step();
 assert.equal(o.round(),4);assert.deepEqual(o.saves,[4]);assert.equal(o.paints(),1);
 assert.equal(o.el('advanceRounds').disabled,true);assert.equal(o.el('nextRound').disabled,true);
 assert.equal(o.el('roundProgress').hidden,true);
});
