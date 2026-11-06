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

function terrainStamp(terrain:Terrain,variant:number):HTMLCanvasElement {
  const tile=document.createElement('canvas');
  tile.width=tile.height=32;
  const ctx=tile.getContext('2d')!;
  ctx.fillStyle=(terrain==='land'?['#607d47','#65824a','#5d7945','#68854c']:['#21486f','#234c75','#224a72','#254f79'])[variant]!;
  ctx.fillRect(0,0,32,32);
  for(let i=0;i<5;i++){
    const x=(variant*11+i*13)%25+2,y=(variant*7+i*9)%26+2;
    ctx.fillStyle=i%2?'#ffffff17':'#081b2633';
    if(terrain==='sea'){
      ctx.fillRect(x,y,5+i%3,1);
      ctx.fillRect(x+2,y+1,3,1);
    }else{
      ctx.fillRect(x,y,2,2);
      ctx.fillRect(x+2,y+2,2,1);
      ctx.fillRect(x+4,y-1,1,2);
    }
  }
  return tile;
}

const terrainArt={land:Array.from({length:4},(_,i)=>terrainStamp('land',i)),sea:Array.from({length:4},(_,i)=>terrainStamp('sea',i))};

export function drawTerrain(ctx:CanvasRenderingContext2D,terrain:Terrain|null,x:number,y:number,size:number,column:number,row:number):void {
  if(terrain){
    ctx.drawImage(terrainArt[terrain][(Math.imul(column,31)^Math.imul(row,17)^(column>>2)^(row>>1))&3]!,x,y,size+.25,size+.25);
  }else{
    ctx.fillStyle='#080e15';
    ctx.fillRect(x,y,size+.25,size+.25);
  }
}

export function drawCoast(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,north:boolean,east:boolean,south:boolean,west:boolean):void {
  if(!north&&!east&&!south&&!west)return;
  const bevel=size*.16;
  const corners=[
    [x,y,1,1,north&&west],
    [x+size,y,-1,1,north&&east],
    [x+size,y+size,-1,-1,south&&east],
    [x,y+size,1,-1,south&&west],
  ] as const;
  ctx.fillStyle='#234c75';
  for(const [cx,cy,dx,dy,cut] of corners){
    if(!cut)continue;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.lineTo(cx+dx*bevel,cy);
    ctx.lineTo(cx,cy+dy*bevel);
    ctx.fill();
  }
  const inset=Math.min(1,size*.06);
  const left=x+inset,right=x+size-inset,top=y+inset,bottom=y+size-inset;
  ctx.strokeStyle='#93ac6b';
  ctx.lineWidth=inset;
  ctx.beginPath();
  if(north){ctx.moveTo(left+(west?bevel:0),top);ctx.lineTo(right-(east?bevel:0),top);}
  if(east){ctx.moveTo(right,top+(north?bevel:0));ctx.lineTo(right,bottom-(south?bevel:0));}
  if(south){ctx.moveTo(right-(east?bevel:0),bottom);ctx.lineTo(left+(west?bevel:0),bottom);}
  if(west){ctx.moveTo(left,bottom-(south?bevel:0));ctx.lineTo(left,top+(north?bevel:0));}
  ctx.stroke();
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
