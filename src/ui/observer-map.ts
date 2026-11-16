import type {Game,PlayerView,Terrain} from '../engine/index.js';

/** Presentation-only visibility. Never feed these cells back into AI PlayerView. */
export const SPECTATOR_FOG_OPACITY=0.75;
export const EXPLORED_FOG_OPACITY=0.52;
const revealsTerrain=(game:Pick<Game,'scenario'>,enabled:boolean)=>
  enabled&&game.scenario==='ai-vs-ai';

/** The observer can see true geography through fog; both AIs still see only private knowledge. */
export function observerTerrain(
  game:Pick<Game,'scenario'|'tiles'>,view:Pick<PlayerView,'cells'>,index:number,reveal:boolean
):Terrain|null {
  return revealsTerrain(game,reveal)?game.tiles[index]??null:view.cells[index]?.terrain??null;
}

/** Visible = clear; explored but out of sight = 52%; undiscovered CvC terrain = 75%. */
export function observerFogOpacity(
  game:Pick<Game,'scenario'>,view:Pick<PlayerView,'cells'>,index:number,reveal:boolean
):number {
  const cell=view.cells[index];
  if(!cell||cell.visible)return 0;
  if(cell.terrain!==null)return EXPLORED_FOG_OPACITY;
  return revealsTerrain(game,reveal)?SPECTATOR_FOG_OPACITY:0;
}

/**
 * Offscreen terrain cache key. Reveal-on CvC geography ignores PlayerView so
 * visibility-only refreshes keep the stamped atlas layer.
 */
export function terrainLayerCacheKey(
  tilesRevision:number,tileSize:number,revealMap:boolean,knowledgeGeneration:number
):string {
  if(revealMap)return `geo|${tilesRevision}|${tileSize}`;
  return `know|${tilesRevision}|${tileSize}|${knowledgeGeneration}`;
}

/** Fog always tracks PlayerView visibility; reveal-on only changes terrain stamps, not fog. */
export function fogLayerCacheKey(
  tilesRevision:number,tileSize:number,revealMap:boolean,knowledgeGeneration:number
):string {
  const prefix=revealMap?'fog-geo':'fog-know';
  return `${prefix}|${tilesRevision}|${tileSize}|${knowledgeGeneration}`;
}

/**
 * Bumps knowledge-layer generation on refresh. Terrain cache keys for reveal-on CvC ignore
 * generation (true geography), but fog stamps always depend on visible/explored cells.
 */
export function refreshShouldInvalidateKnowledgeLayer(
  _scenario:Game['scenario'],_revealSpectatorTerrain:boolean
):boolean {
  return true;
}
