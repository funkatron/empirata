import test from 'node:test';
import assert from 'node:assert/strict';
import {dosShipMixChoice} from '../dist/engine/index.js';

const inventory=(changes={})=>({army:0,fighter:0,destroyer:0,transport:0,submarine:0,cruiser:0,carrier:0,battleship:0,...changes});

test('ALG-AI-002: grade B prioritizes first battleship when absent',()=>{
  assert.equal(dosShipMixChoice(inventory(),2),'battleship');
});

test('ALG-AI-002: grade A selects carrier if none exist',()=>{
  assert.equal(dosShipMixChoice(inventory(),1),'carrier');
});

test('ALG-AI-002: transport minimum takes precedence after fleet anchors',()=>{
  assert.equal(dosShipMixChoice(inventory({battleship:1,carrier:1}),2),'transport');
  assert.equal(dosShipMixChoice(inventory({battleship:1,carrier:1,transport:1}),1),'transport');
});

test('ALG-AI-002: grade B requests destroyer when none exists and transports available',()=>{
  assert.equal(dosShipMixChoice(inventory({battleship:1,carrier:1,transport:2}),2),'destroyer');
});

test('ALG-AI-002: high-to-low ship-mix scan prefers scarce lower type',()=>{
  assert.equal(dosShipMixChoice(inventory({battleship:3,carrier:2,cruiser:1,submarine:4,transport:2,destroyer:1}),1),'destroyer');
});

test('ALG-AI-002: rejects invalid inventory and grade',()=>{
  assert.throws(()=>dosShipMixChoice(inventory({carrier:-1}),1));
  assert.throws(()=>dosShipMixChoice(inventory({carrier:1.5}),1));
  assert.throws(()=>dosShipMixChoice(inventory(),3));
});
