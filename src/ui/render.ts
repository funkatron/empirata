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
  let terrainLayer:HTMLCanvasElement|null=null;
  let terrainLayerKey='';
  let fogLayer:HTMLCanvasElement|null=null;
  let fogLayerKey='';
  let zoomGestureLayerTileSize:number|null=null;
  let zoomGestureCommitTimer:ReturnType<typeof setTimeout>|null=null;
  let paintRaf:number|null=null;
  let lastParams:RenderParams|null=null;
  const mapPaintStats={terrainRebuilds:0,lastEnsureMs:0,lastPaintMs:0,lastRebuild:false};

  function blitWorldLayer(
    layer:HTMLCanvasElement,layerTileSize:number,viewTileSize:number,
    cameraX:number,cameraY:number,viewW:number,viewH:number,
  ):void{
    if(layerTileSize===viewTileSize){ctx.drawImage(layer,-cameraX,-cameraY);return;}
    const scale=viewTileSize/layerTileSize;
    ctx.drawImage(layer,cameraX/scale,cameraY/scale,viewW/scale,viewH/scale,0,0,viewW,viewH);
  }

  function ensureTerrainLayer(p:RenderParams,layerTileSize:number):HTMLCanvasElement {
    const key=terrainLayerCacheKey(tilesRevision,layerTileSize,p.revealSpectatorTerrain,knowledgeLayerGeneration);
    if(terrainLayer&&terrainLayerKey===key){
      mapPaintStats.lastEnsureMs=0;mapPaintStats.lastRebuild=false;return terrainLayer;
    }
    const started=performance.now();
    const width=Math.max(1,Math.ceil(p.game.width*layerTileSize));
    const height=Math.max(1,Math.ceil(p.game.height*layerTileSize));
    if(!terrainLayer)terrainLayer=document.createElement('canvas');
    if(terrainLayer.width!==width)terrainLayer.width=width;
    if(terrainLayer.height!==height)terrainLayer.height=height;
    const layer=terrainLayer.getContext('2d')!;
    layer.setTransform(1,0,0,1,0,0);layer.clearRect(0,0,width,height);
    layer.fillStyle='#08131b';layer.fillRect(0,0,width,height);
    const displayTerrain=(x:number,y:number)=>x>=0&&x<p.view.width&&y>=0&&y<p.view.height?
      observerTerrain(p.game,p.view,y*p.view.width+x,p.revealSpectatorTerrain):null;
    for(let y=0;y<p.view.height;y++)for(let x=0;x<p.view.width;x++){
      const terrain=displayTerrain(x,y);
      const px=x*layerTileSize,py=y*layerTileSize;
      const seaAt=(dx:number,dy:number)=>displayTerrain(x+dx,y+dy)==='sea';
      drawTerrain(layer,terrain,px,py,layerTileSize,x,y);
      if(terrain==='land')drawCoast(layer,px,py,layerTileSize,seaAt(0,-1),seaAt(1,0),seaAt(0,1),seaAt(-1,0),
        seaAt(1,-1),seaAt(1,1),seaAt(-1,1),seaAt(-1,-1));
      if(layerTileSize>=9){layer.strokeStyle='rgba(120,159,166,.12)';layer.lineWidth=.65;layer.strokeRect(px+.3,py+.3,layerTileSize-.6,layerTileSize-.6);}
    }
    terrainLayerKey=key;
    mapPaintStats.terrainRebuilds++;mapPaintStats.lastRebuild=true;mapPaintStats.lastEnsureMs=performance.now()-started;
    return terrainLayer;
  }

  function ensureFogLayer(p:RenderParams,layerTileSize:number):HTMLCanvasElement|null{
    const key=fogLayerCacheKey(tilesRevision,layerTileSize,p.revealSpectatorTerrain,knowledgeLayerGeneration);
    if(fogLayer&&fogLayerKey===key)return fogLayer;
    const width=Math.max(1,Math.ceil(p.game.width*layerTileSize));
    const height=Math.max(1,Math.ceil(p.game.height*layerTileSize));
    if(!fogLayer)fogLayer=document.createElement('canvas');
    if(fogLayer.width!==width)fogLayer.width=width;
    if(fogLayer.height!==height)fogLayer.height=height;
    const layer=fogLayer.getContext('2d')!;
    layer.setTransform(1,0,0,1,0,0);layer.clearRect(0,0,width,height);
    for(let y=0;y<p.view.height;y++)for(let x=0;x<p.view.width;x++){
      const fog=observerFogOpacity(p.game,p.view,y*p.view.width+x,p.revealSpectatorTerrain);
      if(fog===0)continue;
      layer.fillStyle=`rgba(3,13,22,${fog})`;
      layer.fillRect(x*layerTileSize,y*layerTileSize,layerTileSize,layerTileSize);
    }
    fogLayerKey=key;return fogLayer;
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
    const layerTileSize=zoomGestureLayerTileSize??p.tileSize;
    const displayTerrain=(x:number,y:number)=>x>=0&&x<p.view.width&&y>=0&&y<p.view.height?
      observerTerrain(p.game,p.view,y*p.view.width+x,p.revealSpectatorTerrain):null;
    const concealedCityCells=new Set(revealMap?p.game.cities.filter(c=>
      !cellAt(c.position.x,c.position.y)?.city).map(c=>c.position.y*p.view.width+c.position.x):[]);
    const fitSize=Math.min(w/p.view.width,h/p.view.height);
    const fitWeight=Math.max(0,Math.min(1,(Math.max(30,fitSize+8)-p.tileSize)/(Math.max(30,fitSize+8)-fitSize)));
    const layer=ensureTerrainLayer(p,layerTileSize);
    blitWorldLayer(layer,layerTileSize,p.tileSize,p.cameraX,p.cameraY,w,h);
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
    const fog=ensureFogLayer(p,layerTileSize);
    if(fog)blitWorldLayer(fog,layerTileSize,p.tileSize,p.cameraX,p.cameraY,w,h);
    p.postPaint?.();
    mapPaintStats.lastPaintMs=performance.now()-paintStarted;
  }

  function commitZoomGestureLayers():void{
    if(zoomGestureCommitTimer!==null){clearTimeout(zoomGestureCommitTimer);zoomGestureCommitTimer=null;}
    if(zoomGestureLayerTileSize===null)return;
    zoomGestureLayerTileSize=null;
    if(lastParams)paintFrameWith(lastParams);
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
    beginZoomGesture(currentTileSize:number):void{
      if(zoomGestureLayerTileSize===null)zoomGestureLayerTileSize=currentTileSize;
      if(zoomGestureCommitTimer!==null)clearTimeout(zoomGestureCommitTimer);
      zoomGestureCommitTimer=setTimeout(commitZoomGestureLayers,150);
    },
    commitZoomGesture():void{commitZoomGestureLayers();},
    get mapPaintStats(){return {...mapPaintStats};},
    resetPaintStats():void{
      mapPaintStats.terrainRebuilds=0;mapPaintStats.lastEnsureMs=0;mapPaintStats.lastPaintMs=0;mapPaintStats.lastRebuild=false;
    },
  };
}

export type Renderer=ReturnType<typeof createRenderer>;
