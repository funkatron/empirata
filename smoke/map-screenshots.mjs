// Reproducible, opt-in WebKit captures for reviewing map rendering changes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const {webkit}=await import(process.env.EMPIRATA_PLAYWRIGHT_MODULE??'playwright');
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const output=resolve(process.env.EMPIRATA_SCREENSHOT_DIR??'artifacts/map-screenshots');
const server=createServer(async(req,res)=>{
  try{
    const route=new URL(req.url??'/','http://localhost').pathname;
    const path=resolve(root,`.${route==='/'?'/index.html':route}`);
    if(!path.startsWith(root.endsWith(sep)?root:root+sep))throw Error('Invalid path');
    res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[extname(path)]??'application/octet-stream');
    res.end(await readFile(path));
  }catch{res.writeHead(404);res.end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
  browser=await webkit.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1024,height:768},deviceScaleFactor:1,reducedMotion:'reduce'});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#gameMenu summary').click();
  await page.locator('#campaignMode').selectOption('ai-vs-ai');
  await page.locator('#campaignMap').selectOption('continents:83');
  await page.locator('#startCampaign').click();
  await page.waitForFunction(()=>document.querySelector('#round')?.textContent==='ROUND 1');
  await mkdir(output,{recursive:true});
  const shots=[];
  async function capture(name){
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    const canvas=page.locator('#map');
    const size=await canvas.evaluate(el=>({width:el.width,height:el.height,cssWidth:el.clientWidth,cssHeight:el.clientHeight}));
    assert.ok(size.width>0&&size.height>0,'Map canvas must have dimensions');
    const file=`${name}.png`;
    await page.screenshot({path:resolve(output,file),animations:'disabled',fullPage:true});
    shots.push({file,...size});
  }
  await page.locator('#fitWorld').click();
  await capture('01-fit-world');
  await page.locator('#recenter').click();
  await capture('02-normal');
  for(let i=0;i<8;i++)await page.locator('#zoomIn').click();
  await capture('03-zoomed-in');
  // A staged invasion scenario adds a second useful, repeatable scene.
  await page.locator('#gameMenu summary').click();
  await page.locator('#invasionGame').click();
  await page.locator('#recenter').click();
  await capture('04-invasion');
  assert.deepEqual(errors,[],'Browser must not report uncaught errors');
  const metadata={
    purpose:'Human-reviewed screenshot baseline, not an automatic visual pass/fail',
    commit:process.env.GITHUB_SHA??null,
    browser:'Playwright WebKit',
    viewport:{width:1024,height:768},deviceScaleFactor:1,
    scenarios:['continents:83 / ai-vs-ai / round 1','AI Invasion staged test'],
    note:'Normal view uses the app recenter control; zoomed-in view adds eight zoom clicks.',
    shots
  };
  await writeFile(resolve(output,'manifest.json'),JSON.stringify(metadata,null,2)+'\n');
  console.log(`Saved ${shots.length} screenshots and manifest to ${output}`);
}finally{
  if(browser)await browser.close();
  await new Promise(done=>server.close(done));
}
