import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {resolve, join, extname} from 'node:path';

// Opt-in browser fixture: exercise the real compiled map renderer, not a mock.
// The eight-neighbor cases include cardinal and diagonal-only sea corners.
const fixture=`<!doctype html><html><head><meta charset="utf-8"><style>
body{background:#101c28;color:#e8e3c8;font:14px monospace;padding:16px}
section{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0}
canvas{display:block;image-rendering:pixelated;border:1px solid #64717a}
figcaption{padding:5px 0}
</style></head><body><h1>Coastline corner fixture</h1><section id="samples"></section>
<script type="module">
import {drawTerrain,drawCoast,isTerrainAtlasReady} from '/ui/map-art.js';
const cases=[['north+west',1,0,0,1],['north+east',1,1,0,0],
 ['south+east',0,1,1,0],['south+west',0,0,1,1],
 ['north-east diagonal',0,0,0,0,1,0,0,0],
 ['south-east diagonal',0,0,0,0,0,1,0,0],
 ['south-west diagonal',0,0,0,0,0,0,1,0],
 ['north-west diagonal',0,0,0,0,0,0,0,1],
 ['straight north',1,0,0,0],['straight east',0,1,0,0],
 ['straight south',0,0,1,0],['straight west',0,0,0,1]];
while(!isTerrainAtlasReady())await new Promise(r=>setTimeout(r,30));
for(const size of [16,32,64])for(const [name,...edges] of cases){
 const figure=document.createElement('figure');const canvas=document.createElement('canvas');
 canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');
 drawTerrain(ctx,'land',0,0,size,0,0);
 drawCoast(ctx,0,0,size,...edges.map(Boolean));
 figure.append(canvas);const caption=document.createElement('figcaption');
 caption.textContent=name+' / '+size+'px';figure.append(caption);
 document.querySelector('#samples').append(figure);
}
document.body.dataset.ready='true';
</script></body></html>`;
const server=createServer(async(req,res)=>{
  const path=req.url==='/'?null:resolve('dist','.'+decodeURIComponent(req.url||'/'));
  if(!path){res.setHeader('content-type','text/html');res.end(fixture);return;}
  if(!path.startsWith(resolve('dist')+'/')){res.writeHead(403);res.end();return;}
  try{const body=await readFile(path);res.setHeader('content-type',extname(path)==='.js'?'text/javascript':extname(path)==='.svg'?'image/svg+xml':'application/octet-stream');res.end(body);}
  catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
await mkdir('coastline-screenshots',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:960},deviceScaleFactor:1});
  page.on('pageerror',e=>{throw e;});
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.locator('body[data-ready="true"]').waitFor({timeout:10000});
  await page.screenshot({path:'coastline-screenshots/corner-fixture.png',fullPage:true});
  await page.close();
}finally{await browser.close();await new Promise(r=>server.close(r));}
