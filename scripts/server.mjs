import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('dist');const port=Number(process.env.PORT??4173);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
http.createServer(async(req,res)=>{
  try{
    const route=decodeURIComponent(new URL(req.url??'/',`http://localhost:${port}`).pathname);
    const p=resolve(root,`.${route==='/'?'/index.html':route}`);
    if(p!==root&&!p.startsWith(root+sep)){res.writeHead(403);res.end('Forbidden');return;}
    if(!(await stat(p)).isFile())throw new Error('Not a file');
    res.writeHead(200,{'Content-Type':mime[extname(p)]??'application/octet-stream','Cache-Control':'no-store'});
    res.end(await readFile(p));
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Empirata rules lab: http://127.0.0.1:${port}/`));
