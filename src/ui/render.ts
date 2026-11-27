import type {Game,PlayerView} from '../engine/index.js';
import {drawCity,drawCoast,drawTerrain,drawUnit} from './map-art.js';
import {fogLayerCacheKey,observerFogOpacity,observerTerrain,terrainLayerCacheKey} from './observer-map.js';

export interface RenderParams {
  view: PlayerView;
  game: Game;
  tileSize: number;
  cameraX: number;
  cameraY: number;
  revealSpectatorTerrain: boolean;
  selectedUnit: string|null;
  selectedCity: string|null;
  spectatorContact: string|null;
  spectatorCity: string|null;
  postPaint: (() => void)|null;
}

const COLORS={blue:'#68c4f1',red:'#f47c73',green:'#a4dc8b',neutral:'#e2c37c'};

export function createRenderer(canvas:HTMLCanvasElement,ctx:CanvasRenderingContext2D) {
  let tilesRevision=0;
  let knowledgeLayerGeneration=0;
  /** Terrain is cached at a fixed resolution: the atlas's native 32 px per tile.
   * Layer size no longer grows with zoom (100×60 → 3200×1920 ≈ 6.1 MP, inside
   * iPad canvas limits) and zooming never rebuilds it. */
  const LAYER_TILE=32;
  let terrainLayer:HTMLCanvasElement|null=null;
  let terrainLayerKey='';
  let terrainCodes:Uint8Array|null=null;
  let terrainCodesRevision=-1;
  /** Fog is one pixel per map cell, scaled up with smoothing off. */
  let fogLayer:HTMLCanvasElement|null=null;
  let fogLayerKey='';
  let paintRaf:number|null=null;
  let lastParams:RenderParams|null=null;
  let gestureTimer:ReturnType<typeof setTimeout>|null=null;
  const mapPaintStats={terrainRebuilds:0,lastEnsureMs:0,lastPaintMs:0,lastRebuild:false,fullRebuilds:0,lastStampedCells:0};

  /** Draw the part of a whole-map layer that falls inside the viewport. */
  function blitWorldLayer(
    layer:HTMLCanvasElement,layerTile:number,p:RenderParams,viewW:number,viewH:number,
  ):void{
    const t=p.tileSize;
    const x0=Math.max(0,p.cameraX/t),y0=Math.max(0,p.cameraY/t);
    const x1=Math.min(p.game.width,(p.cameraX+viewW)/t),y1=Math.min(p.game.height,(p.cameraY+viewH)/t);
    if(x1<=x0||y1<=y0)return;
    const smoothing=ctx.imageSmoothingEnabled;
    // Crisp when enlarging; filtered when shrinking (fit-to-world) to avoid shimmer.
    const devicePerTile=t*Math.abs(ctx.getTransform().a||1);
    ctx.imageSmoothingEnabled=devicePerTile<layerTile;
    ctx.drawImage(layer,x0*layerTile,y0*layerTile,(x1-x0)*layerTile,(y1-y0)*layerTile,
      x0*t-p.cameraX,y0*t-p.cameraY,(x1-x0)*t,(y1-y0)*t);
    ctx.imageSmoothingEnabled=smoothing;
  }

  const TERRAIN_CODE={land:1,sea:2} as const;
  function terrainCodesFor(p:RenderParams):Uint8Array{
    const codes=new Uint8Array(p.game.width*p.game.height);
    for(let i=0;i<codes.length;i++){
      const terrain=observerTerrain(p.game,p.view,i,p.revealSpectatorTerrain);
      codes[i]=terrain?TERRAIN_CODE[terrain]:0;
    }
    return codes;
  }

  function stampTerrainCell(layer:CanvasRenderingContext2D,codes:Uint8Array,width:number,height:number,x:number,y:number):void{
    const code=(cx:number,cy:number)=>cx>=0&&cx<width&&cy>=0&&cy<height?codes[cy*width+cx]!:0;
    const c=code(x,y);
    const terrain=c===1?'land':c===2?'sea':null;
    const px=x*LAYER_TILE,py=y*LAYER_TILE;
    layer.fillStyle='#08131b';layer.fillRect(px,py,LAYER_TILE,LAYER_TILE);
    drawTerrain(layer,terrain,px,py,LAYER_TILE,x,y);
    if(terrain==='land'){
      const seaAt=(dx:number,dy:number)=>code(x+dx,y+dy)===2;
      drawCoast(layer,px,py,LAYER_TILE,seaAt(0,-1),seaAt(1,0),seaAt(0,1),seaAt(-1,0),
        seaAt(1,-1),seaAt(1,1),seaAt(-1,1),seaAt(-1,-1));
    }
  }

  function ensureTerrainLayer(p:RenderParams):HTMLCanvasElement {
    const key=terrainLayerCacheKey(tilesRevision,LAYER_TILE,p.revealSpectatorTerrain,knowledgeLayerGeneration);
    if(terrainLayer&&terrainLayerKey===key){
      mapPaintStats.lastEnsureMs=0;mapPaintStats.lastRebuild=false;mapPaintStats.lastStampedCells=0;return terrainLayer;
    }
    const started=performance.now();
    const W=p.game.width,H=p.game.height;
    const width=W*LAYER_TILE,height=H*LAYER_TILE;
    const codes=terrainCodesFor(p);
    if(!terrainLayer)terrainLayer=document.createElement('canvas');
    const full=!terrainCodes||terrainCodes.length!==codes.length||terrainCodesRevision!==tilesRevision||
      terrainLayer.width!==width||terrainLayer.height!==height;
    if(terrainLayer.width!==width)terrainLayer.width=width;
    if(terrainLayer.height!==height)terrainLayer.height=height;
    const layer=terrainLayer.getContext('2d')!;
    layer.setTransform(1,0,0,1,0,0);
    let stamped=0;
    if(full){
      for(let y=0;y<H;y++)for(let x=0;x<W;x++)stampTerrainCell(layer,codes,W,H,x,y);
      stamped=W*H;mapPaintStats.fullRebuilds++;
    }else{
      // Re-stamp changed cells and their neighbours (coast shapes depend on neighbours).
      const dirty=new Uint8Array(codes.length);
      for(let i=0;i<codes.length;i++){
        if(codes[i]===terrainCodes![i])continue;
        const x=i%W,y=(i-x)/W;
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
          const nx=x+dx,ny=y+dy;
          if(nx>=0&&nx<W&&ny>=0&&ny<H)dirty[ny*W+nx]=1;
        }
      }
      for(let i=0;i<dirty.length;i++)if(dirty[i]){const x=i%W;stampTerrainCell(layer,codes,W,H,x,(i-x)/W);stamped++;}
    }
    terrainCodes=codes;terrainCodesRevision=tilesRevision;terrainLayerKey=key;
    mapPaintStats.terrainRebuilds++;mapPaintStats.lastRebuild=true;mapPaintStats.lastStampedCells=stamped;
    mapPaintStats.lastEnsureMs=performance.now()-started;
    return terrainLayer;
  }

  function ensureFogLayer(p:RenderParams):HTMLCanvasElement{
    const key=fogLayerCacheKey(tilesRevision,1,p.revealSpectatorTerrain,knowledgeLayerGeneration);
    if(fogLayer&&fogLayerKey===key)return fogLayer;
    const W=p.game.width,H=p.game.height;
    if(!fogLayer)fogLayer=document.createElement('canvas');
    if(fogLayer.width!==W)fogLayer.width=W;
    if(fogLayer.height!==H)fogLayer.height=H;
    const layer=fogLayer.getContext('2d')!;
    const image=layer.createImageData(W,H);
    for(let i=0;i<W*H;i++){
      const fog=observerFogOpacity(p.game,p.view,i,p.revealSpectatorTerrain);
      if(fog===0)continue;
      image.data[i*4]=3;image.data[i*4+1]=13;image.data[i*4+2]=22;image.data[i*4+3]=Math.round(fog*255);
    }
    layer.putImageData(image,0,0);
    fogLayerKey=key;return fogLayer;
  }

  /** Cell grid as one path over the visible cells. */
  function strokeGrid(p:RenderParams,viewW:number,viewH:number,sx:number,ex:number,sy:number,ey:number):void{
    if(p.tileSize<9||ex<=sx||ey<=sy)return;
    const t=p.tileSize;
    ctx.beginPath();
    for(let x=sx;x<=ex;x++){const px=Math.round(x*t-p.cameraX)+.5;ctx.moveTo(px,Math.max(0,sy*t-p.cameraY));ctx.lineTo(px,Math.min(viewH,ey*t-p.cameraY));}
    for(let y=sy;y<=ey;y++){const py=Math.round(y*t-p.cameraY)+.5;ctx.moveTo(Math.max(0,sx*t-p.cameraX),py);ctx.lineTo(Math.min(viewW,ex*t-p.cameraX),py);}
    ctx.strokeStyle='rgba(120,159,166,.14)';ctx.lineWidth=1;ctx.stroke();
  }

  function paintFrameWith(p:RenderParams):void {
    const paintStarted=performance.now();
    const w=canvas.clientWidth,h=canvas.clientHeight;
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#08131b';ctx.fillRect(0,0,w,h);
    const sx=Math.max(0,Math.floor(p.cameraX/p.tileSize)),ex=Math.min(p.game.width,Math.ceil((p.cameraX+w)/p.tileSize));
    const sy=Math.max(0,Math.floor(p.cameraY/p.tileSize)),ey=Math.min(p.game.height,Math.ceil((p.cameraY+h)/p.tileSize));
    const loadedShips=new Set(p.view.ownUnits.flatMap(u=>u.aboard?[u.aboard]:[]));
    const displayUnits=[...p.view.enemies.map(e=>({id:e.id,kind:e.kind,position:e.position,owner:e.owner,stale:e.stale})),
      ...p.view.ownUnits.filter(u=>!u.aboard).map(u=>({id:u.id,kind:u.kind,position:u.position,owner:u.owner,stale:false}))];
    const unitsByCell=new Map<number,Array<(typeof displayUnits)[number]>>();
    for(const unit of displayUnits){
      const index=unit.position.y*p.view.width+unit.position.x;
      const stack=unitsByCell.get(index)??[];
      stack.push(unit);unitsByCell.set(index,stack);
    }
    const neighbors=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]] as const;
    const cellAt=(x:number,y:number)=>x>=0&&x<p.view.width&&y>=0&&y<p.view.height?p.view.cells[y*p.view.width+x]:undefined;
    const revealMap=p.game.scenario==='ai-vs-ai'&&p.revealSpectatorTerrain;
    const displayTerrain=(x:number,y:number)=>x>=0&&x<p.view.width&&y>=0&&y<p.view.height?
      observerTerrain(p.game,p.view,y*p.view.width+x,p.revealSpectatorTerrain):null;
    const concealedCityCells=new Set(revealMap?p.game.cities.filter(c=>
      !cellAt(c.position.x,c.position.y)?.city).map(c=>c.position.y*p.view.width+c.position.x):[]);
    const fitSize=Math.min(w/p.view.width,h/p.view.height);
    const fitWeight=Math.max(0,Math.min(1,(Math.max(30,fitSize+8)-p.tileSize)/(Math.max(30,fitSize+8)-fitSize)));
    blitWorldLayer(ensureTerrainLayer(p),LAYER_TILE,p,w,h);
    strokeGrid(p,w,h,sx,ex,sy,ey);
    for(let y=sy;y<ey;y++)for(let x=sx;x<ex;x++){
      const i=y*p.view.width+x,c=p.view.cells[i]!;
      const px=x*p.tileSize-p.cameraX,py=y*p.tileSize-p.cameraY;
      const stack=unitsByCell.get(i);
      if(concealedCityCells.has(i)){
        const coastal=neighbors.some(([dx,dy])=>displayTerrain(x+dx,y+dy)==='sea');
        drawCity(ctx,coastal,px+p.tileSize*.13,py+p.tileSize*.13,p.tileSize*.74,COLORS.neutral);
      }
      if(c.city){
        const coastal=neighbors.some(([dx,dy])=>displayTerrain(x+dx,y+dy)==='sea');
        const size=p.tileSize*(stack?.44:.74);
        const offset=p.tileSize*(stack?.04:.13);
        drawCity(ctx,coastal,px+offset,py+offset,size,COLORS[c.city.owner??'neutral']);
        if(c.city.id===p.selectedCity||c.city.id===p.spectatorCity){
          ctx.strokeStyle='#fff7c4';ctx.lineWidth=2;ctx.strokeRect(px+2,py+2,Math.max(1,p.tileSize-4),Math.max(1,p.tileSize-4));
        }
      }
      if(!stack)continue;
      const u=stack.find(unit=>unit.id===p.selectedUnit||unit.id===p.spectatorContact)??stack.filter(unit=>!unit.stale).at(-1)??stack[stack.length-1]!;
      ctx.globalAlpha=u.stale?.48:1;
      const isolated=fitWeight>0&&stack.length===1&&neighbors.every(([dx,dy])=>{
        const cell=cellAt(x+dx,y+dy);
        return cell?.terrain===c.terrain&&!cell?.city&&!unitsByCell.has((y+dy)*p.view.width+x+dx);
      });
      const scale=c.city?.66:.82+fitWeight*(isolated?.28:.18);
      const offset=p.tileSize*(c.city?.28:(1-scale)/2);
      drawUnit(ctx,u.kind,px+offset,py+offset,p.tileSize*scale,COLORS[u.owner],!u.stale&&loadedShips.has(u.id));
      ctx.globalAlpha=1;
      const count=stack.filter(unit=>!unit.stale).length;
      if(count>1&&p.tileSize>=20){
        ctx.font=`bold ${Math.max(8,p.tileSize*.3)}px ui-monospace, monospace`;
        ctx.textAlign='right';ctx.textBaseline='top';
        ctx.strokeStyle='#0b1b25';ctx.lineWidth=2.5;ctx.lineJoin='round';
        ctx.fillStyle='#f2e5ba';
        ctx.strokeText(String(count),px+p.tileSize-2,py+2);
        ctx.fillText(String(count),px+p.tileSize-2,py+2);
      }
      if(u.id===p.selectedUnit||u.id===p.spectatorContact){ctx.strokeStyle='#fff0a4';ctx.lineWidth=2.3;ctx.strokeRect(px+1,py+1,Math.max(1,p.tileSize-2),Math.max(1,p.tileSize-2));}
    }
    blitWorldLayer(ensureFogLayer(p),1,p,w,h);
    p.postPaint?.();
    mapPaintStats.lastPaintMs=performance.now()-paintStarted;
  }


  return {
    invalidateMapLayer():void{tilesRevision++;knowledgeLayerGeneration++;terrainLayerKey='';fogLayerKey='';},
    invalidateKnowledgeLayer(scenario:string|undefined,reveal:boolean):void{
      knowledgeLayerGeneration++;fogLayerKey='';
      if(!(scenario==='ai-vs-ai'&&reveal))terrainLayerKey='';
    },
    schedulePaint(p:RenderParams):void{
      lastParams=p;
      if(paintRaf!==null)return;
      paintRaf=requestAnimationFrame(()=>{paintRaf=null;if(lastParams)paintFrameWith(lastParams);});
    },
    paint(p:RenderParams):void{
      lastParams=p;
      if(paintRaf!==null){cancelAnimationFrame(paintRaf);paintRaf=null;}
      paintFrameWith(p);
    },
    /** Layers are zoom-independent now; kept so gesture callers need no change. */
    beginZoomGesture(_currentTileSize:number):void{
      if(gestureTimer!==null)clearTimeout(gestureTimer);
      gestureTimer=setTimeout(()=>{gestureTimer=null;},150);
    },
    commitZoomGesture():void{if(gestureTimer!==null){clearTimeout(gestureTimer);gestureTimer=null;}},
    get mapPaintStats(){return {...mapPaintStats};},
    resetPaintStats():void{
      mapPaintStats.terrainRebuilds=0;mapPaintStats.lastEnsureMs=0;mapPaintStats.lastPaintMs=0;mapPaintStats.lastRebuild=false;
      mapPaintStats.fullRebuilds=0;mapPaintStats.lastStampedCells=0;
    },
  };
}

export type Renderer=ReturnType<typeof createRenderer>;
