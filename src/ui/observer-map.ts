import type {Game,PlayerView,Terrain} from '../engine/index.js';

/** Presentation-only visibility. Never feed these cells back into AI PlayerView. */
export const SPECTATOR_FOG_OPACITY=0.6;
const revealsTerrain=(game:Pick<Game,'scenario'>,enabled:boolean)=>
  enabled&&game.scenario==='ai-vs-ai';

/** The observer can see true geography through fog; both AIs still see only private knowledge. */
export function observerTerrain(
  game:Pick<Game,'scenario'|'tiles'>,view:Pick<PlayerView,'cells'>,index:number,reveal:boolean
):Terrain|null {
  return revealsTerrain(game,reveal)?game.tiles[index]??null:view.cells[index]?.terrain??null;
}

/** Outside CvC revelation, preserve the existing 52% dimming for explored but unseen tiles. */
export function observerFogOpacity(
  game:Pick<Game,'scenario'>,view:Pick<PlayerView,'cells'>,index:number,reveal:boolean
):number {
  const cell=view.cells[index];
  if(!cell||cell.visible)return 0;
  if(revealsTerrain(game,reveal))return SPECTATOR_FOG_OPACITY;
  return cell.terrain!==null?0.52:0;
}
