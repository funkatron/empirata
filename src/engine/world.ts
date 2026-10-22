import type { City, Coord, Game, Terrain } from './types.js';
export const MAP_WIDTH = 100;
export const MAP_HEIGHT = 60;
export const directions: ReadonlyArray<Readonly<Coord>> = Object.freeze([
  {x:-1,y:-1},{x:0,y:-1},{x:1,y:-1},{x:-1,y:0},
  {x:1,y:0},{x:-1,y:1},{x:0,y:1},{x:1,y:1}
]);
export const equal = (a:Coord,b:Coord) => a.x===b.x && a.y===b.y;
export const index = (world:Pick<Game,'width'>,p:Coord) => p.y * world.width + p.x;
export function inMap(world:Pick<Game,'width'|'height'>,p:Coord): boolean {
  return Number.isInteger(p.x) && Number.isInteger(p.y) && p.x>=0 && p.y>=0 && p.x<world.width && p.y<world.height;
}
export function playable(world:Pick<Game,'width'|'height'>,p:Coord): boolean {
  return inMap(world,p) && p.x>0 && p.y>0 && p.x<world.width-1 && p.y<world.height-1;
}
export function terrainAt(world:Pick<Game,'width'|'height'|'tiles'>,p:Coord): Terrain | null {
  return inMap(world,p) ? (world.tiles[index(world,p)] ?? null) : null;
}
export function cityAt(world:Pick<Game,'cities'>,p:Coord): City | undefined {
  return world.cities.find(c=>equal(c.position,p));
}
/** Provisional: definition of coastal adjacency (8-way) requires DOS validation. */
export function isCoastal(world:Pick<Game,'width'|'height'|'tiles'>,p:Coord): boolean {
  return directions.some(d=>terrainAt(world,{x:p.x+d.x,y:p.y+d.y})==='sea');
}
export function requiredPosition(world:Pick<Game,'width'|'height'>,p:Coord): void {
  if(!playable(world,p)) throw new Error('Movement onto the impassable outer border is not legal.');
}
/** An ORIGINAL test fixture, never represented as an Interstel .MAP file. */
export function makeTestTerrain(): Terrain[] {
  const tile:Terrain[]=Array.from({length:MAP_WIDTH*MAP_HEIGHT},()=> 'sea');
  const ellipse=(x:number,y:number,cx:number,cy:number,rx:number,ry:number) => ((x-cx)/rx)**2 + ((y-cy)/ry)**2 < 1;
  for(let y=1;y<MAP_HEIGHT-1;y++) for(let x=1;x<MAP_WIDTH-1;x++) {
    if(ellipse(x,y,24,29,20,18)||ellipse(x,y,76,30,18,20)||ellipse(x,y,51,10,11,7)||ellipse(x,y,49,50,11,6)) tile[y*MAP_WIDTH+x]='land';
  }
  // Purpose-built bays ensure test ports exist; this is not authentic map generation.
  tile[25*MAP_WIDTH+8]='land';
  for(let x=1;x<=7;x++) for(let y=24;y<=26;y++) tile[y*MAP_WIDTH+x]='sea';
  tile[36*MAP_WIDTH+80]='land'; tile[36*MAP_WIDTH+81]='sea';
  for(const [x,y] of ([[20,16],[24,40],[33,24],[53,11],[67,24],[69,40],[52,50],[83,20]] as [number,number][])) tile[y*MAP_WIDTH+x]='land';
  return tile;
}
