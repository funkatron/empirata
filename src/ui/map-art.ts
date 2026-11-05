import type {Terrain,UnitType} from '../engine/index.js';

const silhouettes:Record<UnitType,string>={
  army:'M3 9H21V15H3Z M6 7H16L19 10H5Z M12 7V5H22V7Z M4 16H20V19H4Z',
  fighter:'M12 2L14 5V9L22 14V17L14 14V18L18 21V23L12 21L6 23V21L10 18V14L2 17V14L10 9V5Z',
  transport:'M2 15H22L18 20H5Z M5 10H10V14H5Z M11 10H16V14H11Z M17 7H20V14H17Z',
  destroyer:'M1 15H23L18 19H5Z M6 13H10V15H6Z M11 10H16V15H11Z M13 6H14V10H13Z M17 12H21V14H17Z',
  submarine:'M1 15Q5 12 9 13V9H15V13Q20 12 23 15Q20 19 12 19Q4 19 1 15Z M12 6H16V8H12Z',
  cruiser:'M1 15H23L18 20H5Z M4 11H9V14H4Z M10 9H16V15H10Z M12 5H14V9H12Z M17 10H22V14H17Z',
  carrier:'M2 9H19L23 13L19 17H4L1 14Z M5 18H18L16 20H6Z M12 5H17V8H12Z',
  battleship:'M1 15H23L18 21H5Z M3 11H8V14H3Z M9 8H15V15H9Z M11 4H13V8H11Z M16 10H22V14H16Z M17 8H22V9H17Z',
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

function drawSymbol(ctx:CanvasRenderingContext2D,path:Path2D,x:number,y:number,size:number,ink:string):void {
  ctx.save();
  ctx.translate(x,y);
  ctx.scale(size/24,size/24);
  ctx.strokeStyle='#0b1b25';
  ctx.lineWidth=2.6;
  ctx.lineJoin='round';
  ctx.stroke(path);
  ctx.fillStyle=ink;
  ctx.fill(path);
  ctx.restore();
}

const unitStamps=new Map<string,HTMLCanvasElement>();

export function drawUnit(ctx:CanvasRenderingContext2D,kind:UnitType,x:number,y:number,size:number,ink:string,loaded=false):void {
  const key=`${kind}:${ink}:${loaded}`;
  let stamp=unitStamps.get(key);
  if(!stamp){
    stamp=document.createElement('canvas');
    stamp.width=stamp.height=24;
    const pixels=stamp.getContext('2d')!;
    drawSymbol(pixels,paths.get(kind)!,0,0,24,ink);
    const bitmap=pixels.getImageData(0,0,24,24);
    for(let i=3;i<bitmap.data.length;i+=4) bitmap.data[i]=bitmap.data[i]!>=128?255:0;
    pixels.putImageData(bitmap,0,0);
    if(loaded){
      pixels.fillStyle='#0b1b25';
      pixels.fillRect(1,1,7,6);
      pixels.fillStyle='#ffe49a';
      pixels.fillRect(2,2,2,4);
      pixels.fillRect(5,2,2,4);
    }
    unitStamps.set(key,stamp);
  }
  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(stamp,x,y,size,size);
  ctx.restore();
}

export function drawCity(ctx:CanvasRenderingContext2D,coastal:boolean,x:number,y:number,size:number,ink:string):void {
  drawSymbol(ctx,coastal?harbor:city,x,y,size,ink);
}
