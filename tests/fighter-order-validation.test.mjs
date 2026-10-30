import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,setOrder} from '../dist/engine/index.js';
function base(carrier=false){
 const g=makeRulesLab(),u=g.units[0];
 g.units=[{...structuredClone(u),id:'f',kind:'fighter',fuel:20,position:{x:20,y:20}}];
 g.cities=[{id:'base',owner:'blue',position:{x:20,y:20},production:null,progress:0,firstCycle:true}];
 if(carrier){g.cities=[];g.units.push({...structuredClone(u),id:'cv',kind:'carrier',position:{x:20,y:20}});g.units[0].aboard='cv';}
 return g;
}
const patrol=(g,n)=>setOrder(g,'f',{kind:'patrol',from:{x:20,y:20},to:{x:20+n,y:20+n},outbound:true});
test('City fighter patrol permits ten squares, rejects eleven and airborne origins',()=>{
 const g=base();assert.equal(patrol(g,10).units[0].order.kind,'patrol');assert.throws(()=>patrol(g,11),/range/);
 g.cities=[];assert.throws(()=>patrol(g,1),/base/);
});
test('Carrier fighter patrol permits six squares and rejects seven',()=>{
 const g=base(true);assert.equal(patrol(g,6).units[0].order.kind,'patrol');assert.throws(()=>patrol(g,7),/range/);
});
test('Fighter patrol requires round-trip fuel; Move To requires outbound fuel',()=>{
 const g=base();g.units[0].fuel=8;assert.equal(patrol(g,4).units[0].order.kind,'patrol');assert.throws(()=>patrol(g,5),/fuel/);
 const move=n=>setOrder(g,'f',{kind:'move-to',destination:{x:20+n,y:20}});
 assert.equal(move(8).units[0].order.kind,'move-to');assert.throws(()=>move(9),/fuel/);
 assert.equal(move(0).units[0].order.kind,'none');
});
test('Rejected orders preserve the original state and army patrol has no fighter range limit',()=>{
 const g=base(),before=structuredClone(g);assert.throws(()=>patrol(g,11));assert.deepEqual(g,before);
 g.units[0].kind='army';g.units[0].fuel=null;assert.equal(patrol(g,11).units[0].order.kind,'patrol');
});
