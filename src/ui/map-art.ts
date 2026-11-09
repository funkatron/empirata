import type {Terrain,UnitType} from '../engine/index.js';

const silhouettes:Record<UnitType,string>={
  army:'M2 12H5V8H12V5H22V8H16V12H22V19H2Z',
  fighter:'M12 2L15 9L22 14V17L15 15L17 21H7L9 15L2 17V14L9 9Z',
  transport:'M1 14H4V8H10V12H15V8H20V14H23L19 20H5Z',
  destroyer:'M2 14H7V11H11V6H14V11H18V14H22L18 19H6Z',
  submarine:'M2 15H9V11H13V8H16V15H22L19 19H5Z',
  cruiser:'M1 14H4V10H8V13H10V7H15V13H17V10H21V14H23L19 20H5Z',
  carrier:'M1 12H14V7H19V12H23V16L19 20H5L1 16Z',
  battleship:'M1 14H3V10H7V13H9V8H11V4H14V8H16V13H18V10H22V14H23L19 21H5Z',
};
const paths=new Map(Object.entries(silhouettes).map(([kind,path])=>[kind,new Path2D(path)]));
const city=new Path2D('M2 20V10H7V20Z M8 20V5H15V20Z M16 20V12H22V20Z M10 3H13V5H10Z M1 21H23V23H1Z');
const harbor=new Path2D('M3 11V8H9V5H15V8H21V11Z M10 10H14V18H20V15H23V20L20 23H4L1 20V15H4V18H10Z');

// Authored pixel-art sprite atlas: 8 land sprites on row 0, 8 sea on row 1.
// Decorative variants never change Empire's land/sea movement or combat rules.
const atlas=new Image();
let atlasReady=false;
export function isTerrainAtlasReady():boolean{return atlasReady;}
atlas.onload=()=>{atlasReady=true;window.dispatchEvent(new Event('empirata-terrain-ready'));};
atlas.src='./terrain-atlas.svg';
function tileVariant(column:number,row:number):number {
  // The eight variants share matching perimeter pixels, allowing arbitrary
  // neighbors without visible seams while avoiding obvious periodic repeats.
  return ((Math.imul(column,73856093)^Math.imul(row,19349663))>>>0)&7;
}

export function drawTerrain(ctx:CanvasRenderingContext2D,terrain:Terrain|null,x:number,y:number,size:number,column:number,row:number):void {
  if(!terrain){
    ctx.fillStyle='#080e15';ctx.fillRect(x,y,size+.25,size+.25);return;
  }
  if(!atlasReady){
    ctx.fillStyle=terrain==='land'?'#6f9746':'#134c78';
    ctx.fillRect(x,y,size+.25,size+.25);return;
  }
  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(atlas,tileVariant(column,row)*32,terrain==='land'?0:32,32,32,x,y,size+.25,size+.25);
  ctx.restore();
}

// Shore overlay is assembled from neighboring *known* sea cells.
// Drawn in a 32-pixel offscreen grid to retain hard pixel edges at every zoom.
const shoreCache=new Map<number,HTMLCanvasElement>();
function shoreSprite(mask:number):HTMLCanvasElement {
  const cached=shoreCache.get(mask);
  if(cached)return cached;
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=32;
  const c=canvas.getContext('2d')!;
  const n=!!(mask&1),e=!!(mask&2),s=!!(mask&4),w=!!(mask&8);
  const sea='#247d9b',shallows='#40a5b4',sand='#c9b57a',highlight='#e3d49c';
  // Blocky stepped coastline, with the ocean cut into land on exposed edges.
  // No gradients or antialiasing: 32x32 source pixels scale as exact blocks.
  const top=[5,5,4,4,3,3,4,4,5,5,4,4,3,3,4,4,5,5,4,4,3,3,4,4,5,5,4,4,3,3,4,4];
  function edge(horizontal:boolean,reverse:boolean){
    for(let i=0;i<32;i++){
      const depth=top[i]!;
      if(horizontal){
        const y=reverse?32-depth:0;
        c.fillStyle=sea;c.fillRect(i,y,1,depth);
        c.fillStyle=shallows;c.fillRect(i,reverse?y-1:depth,1,1);
        c.fillStyle=sand;c.fillRect(i,reverse?y-3:depth+1,1,2);
        if(i%9===0){c.fillStyle=highlight;c.fillRect(i,reverse?y-3:depth+1,1,1);}
      }else{
        const x=reverse?32-depth:0;
        c.fillStyle=sea;c.fillRect(x,i,depth,1);
        c.fillStyle=shallows;c.fillRect(reverse?x-1:depth,i,1,1);
        c.fillStyle=sand;c.fillRect(reverse?x-3:depth+1,i,2,1);
        if(i%9===0){c.fillStyle=highlight;c.fillRect(reverse?x-3:depth+1,i,1,1);}
      }
    }
  }
  if(n)edge(true,false);
  if(s)edge(true,true);
  if(w)edge(false,false);
  if(e)edge(false,true);
  // Join two exposed edges using the same stepped bands. The previous corner
  // patch drew one-sided horizontal strips, leaving seams at east/south joins.
  // Build a symmetric quarter-corner instead, clipped entirely to this tile.
  for(const [corner,active] of [
    [0,n&&w],[1,n&&e],[2,s&&e],[3,s&&w],
  ] as const){
    if(!active)continue;
    const right=corner===1||corner===2,bottom=corner>=2;
    for(let yy=0;yy<9;yy++)for(let xx=0;xx<9;xx++){
      const x=right?31-xx:xx,y=bottom?31-yy:yy;
      // Rounded stair-step transition from sea at the outside to beach inland.
      const distance=Math.hypot(xx,yy);
      if(distance>=9)continue;
      c.fillStyle=distance<6?sea:distance<7?shallows:sand;
      c.fillRect(x,y,1,1);
    }
  }
  // Concave bays: diagonal sea without either adjacent cardinal sea.
  // These are invisible to a four-direction mask and cause square land corners.
  for(const [bit,cx,cy,dx,dy] of [
    [16,31,31,-1,-1],[32,0,31,1,-1],[64,0,0,1,1],[128,31,0,-1,1],
  ] as const){
    if(!(mask&bit))continue;
    for(let y=0;y<9;y++)for(let x=0;x<9;x++){
      const distance=Math.hypot(x,y);
      if(distance>=9)continue;
      c.fillStyle=distance<5?sea:distance<7?shallows:sand;
      c.fillRect(cx+dx*x,cy+dy*y,1,1);
    }
  }
  shoreCache.set(mask,canvas);
  return canvas;
}
export function drawCoast(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,north:boolean,east:boolean,south:boolean,west:boolean,northEast=false,southEast=false,southWest=false,northWest=false):void {
  const mask=(north?1:0)|(east?2:0)|(south?4:0)|(west?8:0)|
    (southEast&&!south&&!east?16:0)|(southWest&&!south&&!west?32:0)|
    (northWest&&!north&&!west?64:0)|(northEast&&!north&&!east?128:0);
  if(!mask)return;
  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(shoreSprite(mask),x,y,size+.25,size+.25);
  ctx.restore();
}

function drawSymbol(ctx:CanvasRenderingContext2D,path:Path2D,x:number,y:number,size:number,ink:string,loaded=false):void {
  ctx.save();
  ctx.translate(x,y);
  ctx.scale(size/24,size/24);
  ctx.strokeStyle='#0b1b25';
  ctx.lineWidth=2.6;
  ctx.lineJoin='round';
  ctx.stroke(path);
  ctx.fillStyle=ink;
  ctx.fill(path);
  if(loaded){
    ctx.fillStyle='#0b1b25';
    ctx.fillRect(1,1,7,6);
    ctx.fillStyle='#ffe49a';
    ctx.fillRect(2,2,2,4);
    ctx.fillRect(5,2,2,4);
  }
  ctx.restore();
}

let staleLayer:CanvasRenderingContext2D|undefined;

export function drawUnit(ctx:CanvasRenderingContext2D,kind:UnitType,x:number,y:number,size:number,ink:string,loaded=false):void {
  const path=paths.get(kind)!;
  if(ctx.globalAlpha===1){
    drawSymbol(ctx,path,x,y,size,ink,loaded);
    return;
  }

  // Composite faded contacts once so the overlapping outline and fill have
  // the same opacity. Rasterize the layer on the map's device pixel grid.
  const {a:scaleX,d:scaleY,e:offsetX,f:offsetY}=ctx.getTransform();
  const padding=size/24;
  const left=Math.floor((x-padding)*scaleX+offsetX),top=Math.floor((y-padding)*scaleY+offsetY);
  const width=Math.ceil((x+size+padding)*scaleX+offsetX)-left;
  const height=Math.ceil((y+size+padding)*scaleY+offsetY)-top;
  staleLayer??=document.createElement('canvas').getContext('2d')!;
  const layer=staleLayer;
  layer.resetTransform();
  if(layer.canvas.width!==width)layer.canvas.width=width;
  if(layer.canvas.height!==height)layer.canvas.height=height;
  layer.clearRect(0,0,width,height);
  layer.setTransform(scaleX,0,0,scaleY,offsetX-left,offsetY-top);
  drawSymbol(layer,path,x,y,size,ink,loaded);

  ctx.save();
  ctx.resetTransform();
  ctx.drawImage(layer.canvas,left,top);
  ctx.restore();
}

export function drawCity(ctx:CanvasRenderingContext2D,coastal:boolean,x:number,y:number,size:number,ink:string):void {
  drawSymbol(ctx,coastal?harbor:city,x,y,size,ink);
}
