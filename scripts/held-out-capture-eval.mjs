/**
 * Held-out capture screening (not a baseline optimizer).
 * Seeds from agents/evaluation/held-out-manifest-audit.json — keep separate from 42-campaign baseline.
 */
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { makeCampaign, layouts } from './campaign-maps.mjs';

const engine = await import(pathToFileURL(resolve(process.env.EMPIRATA_ENGINE ?? 'dist/engine/index.js')));
const manifest = JSON.parse(
  readFileSync(new URL('../agents/evaluation/held-out-manifest-audit.json', import.meta.url), 'utf8'),
);
const rounds = Number(process.env.ROUNDS ?? 120);
const seeds = (process.env.SEEDS ?? manifest.heldMapSeeds.join(',')).split(',').map(Number);
const layoutList = (process.env.LAYOUTS ?? manifest.heldLayouts.join(',')).split(',');
const policyKind = process.env.AI_POLICY ?? 'classic-dos';
const grade = Number(process.env.AI_GRADE ?? 1);

if (!Number.isInteger(rounds) || rounds < 1 || seeds.some(s => !Number.isInteger(s) || s < 1)) {
  throw new Error('Invalid rounds/seeds');
}

function countOwned(g) {
  const neutralStart = 0;
  return {
    blue: g.cities.filter(c => c.owner === 'blue').length,
    red: g.cities.filter(c => c.owner === 'red').length,
    neutral: g.cities.filter(c => c.owner === null).length,
    captures: g.events.filter(e => e.message?.includes('captured')).length,
    neutralStart,
  };
}

const reports = [];
for (const layout of layoutList) {
  if (!layouts.includes(layout)) continue;
  for (const seed of seeds) {
    let g = makeCampaign(engine, layout, seed, {
      scenario: 'ai-vs-ai',
      aiPolicy: { kind: policyKind, grade: policyKind === 'classic-dos' ? grade : undefined },
    });
    const startNeutral = g.cities.filter(c => c.owner === null).length;
    const started = performance.now();
    for (let r = 0; r < rounds && engine.gameOutcome(g).state !== 'finished'; r++) {
      g = engine.advanceLabRound(g);
    }
    const elapsed = performance.now() - started;
    const end = countOwned(g);
    reports.push({
      layout,
      seed,
      policy: policyKind,
      grade,
      rounds: g.round - 1,
      ms: Math.round(elapsed),
      startNeutral,
      endNeutral: end.neutral,
      neutralCaptured: Math.max(0, startNeutral - end.neutral),
      blueCities: end.blue,
      redCities: end.red,
      captureEvents: end.captures,
    });
    console.error(
      `${layout}/${seed}: neutrals ${startNeutral}→${end.neutral}, blue ${end.blue}, red ${end.red}, events ${end.captures}`,
    );
  }
}
console.log(JSON.stringify({ schema: 1, rounds, reports }, null, 2));