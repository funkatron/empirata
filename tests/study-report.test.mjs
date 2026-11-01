import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const baseline=JSON.parse(readFileSync(new URL('../docs/evaluation/strategy-baseline/summary.json',import.meta.url)));
const script=new URL('../scripts/render-study-report.py',import.meta.url).pathname;
function report(summary){
  const out=mkdtempSync(join(tmpdir(),'empirata-report-'));
  try{
    writeFileSync(join(out,'summary.json'),JSON.stringify(summary));
    execFileSync('python3',[script],{env:{...process.env,STUDY_OUT:out}});
    return readFileSync(join(out,'FINDINGS.md'),'utf8');
  }finally{rmSync(out,{recursive:true,force:true});}
}
test('Regenerated study report follows changed observations without baseline conclusions',()=>{
  const row={...baseline.rows[0],id:'changed-policy',rounds:7,status:'time-limit',profile:'distant',hostileCaptures:9,
    hostileUniqueCities:8,hostileCitiesRetained:6,repeatLandingEvents:4,hostilePortDepartures:2,hostilePortDepartureLoads:[3,5]};
  // Deliberately stale top-level aggregates must not override supplied rows.
  const text=report({...baseline,rows:[row],common100:[]});
  assert.ok(text.includes('**1 campaigns · 7 completed rounds · 1 faction observations.**'));
  assert.ok(text.includes('| time-limit | 1 |'));
  assert.ok(text.includes('| Hostile-city capture events | 9 |'));
  assert.ok(text.includes('| Additional landings by already-landed armies | 4 |'));
  assert.ok(text.includes('3 armies: 1, 5 armies: 1'));
  assert.ok(!text.includes('14 of 15'));assert.ok(!text.includes('continents-17-swap-64'));
  assert.ok(!text.includes('All final saves validate'));assert.ok(!text.includes('Every campaign reached round 100'));
  assert.ok(text.includes('BASELINE_INTERPRETATION.md'));
});
test('Report handles empty data and computes campaign totals once per faction pair',()=>{
  assert.ok(report({rows:[],common100:[]}).includes('**0 campaigns · 0 completed rounds · 0 faction observations.**'));
  const text=report(baseline);
  assert.ok(text.includes('**42 campaigns · 8,150 completed rounds · 84 faction observations.**'));
  assert.ok(text.includes('| Hostile-city capture events | 51 |'));
  assert.ok(text.includes('| Additional landings by already-landed armies | 104 |'));
  assert.ok(text.includes('| continents | 64 | 12 | 10 | 23 | 0.5 | 5 |'));
});
