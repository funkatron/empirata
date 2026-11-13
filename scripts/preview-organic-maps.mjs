#!/usr/bin/env node
/**
 * Spike: compare ellipse-v1 vs organic-v1 terrain for campaign layouts/seeds.
 * Writes ASCII + PGM previews under docs/evaluation/mapgen-previews/ (gitignored optional).
 * Usage: node scripts/preview-organic-maps.mjs
 */
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  analyzePlayability, cleanupTerrain, generateEllipseTerrain, generateOrganicTerrain,
  tilesToAscii, tilesToPgm,
} from '../dist/engine/mapgen.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'evaluation', 'mapgen-previews');
mkdirSync(root, {recursive: true});
const layouts = ['continents', 'islands', 'archipelago'];
const seeds = [17, 83, 211];
const summary = [];

for (const layout of layouts) {
  for (const seed of seeds) {
    const ellipse = generateEllipseTerrain(layout, seed);
    cleanupTerrain(ellipse, layout);
    const organic = generateOrganicTerrain(layout, seed, 12);
    const eReport = analyzePlayability(ellipse, layout, 12);
    const oReport = organic.report;
    const base = `${layout}-${seed}`;
    writeFileSync(join(root, `${base}-ellipse.txt`), tilesToAscii(ellipse) + '\n');
    writeFileSync(join(root, `${base}-organic.txt`), tilesToAscii(organic.tiles) + '\n');
    writeFileSync(join(root, `${base}-ellipse.pgm`), tilesToPgm(ellipse));
    writeFileSync(join(root, `${base}-organic.pgm`), tilesToPgm(organic.tiles));
    summary.push({
      layout, seed,
      ellipse: {landFraction: eReport.landFraction, landComponents: eReport.landComponents, ok: eReport.ok, reasons: eReport.reasons},
      organic: {
        landFraction: oReport.landFraction, landComponents: oReport.landComponents,
        ok: oReport.ok, attempts: organic.attempts, reasons: oReport.reasons,
      },
    });
    console.log(
      `${layout}/${seed}: ellipse land=${eReport.landFraction.toFixed(3)} comps=${eReport.landComponents}` +
      ` | organic land=${oReport.landFraction.toFixed(3)} comps=${oReport.landComponents}` +
      ` ok=${oReport.ok} attempts=${organic.attempts}`,
    );
  }
}
writeFileSync(join(root, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(`Wrote previews to ${root}`);
