// Reproducible, opt-in WebKit captures for reviewing map rendering changes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const VIEWPORT_PROFILES={
  desktop:{width:1024,height:768,deviceScaleFactor:1,prefix:''},
  'ipad-portrait':{width:834,height:1194,deviceScaleFactor:2,prefix:'ipad-portrait-'},
  'ipad-landscape':{width:1194,height:834,deviceScaleFactor:2,prefix:'ipad-landscape-'},
};
const profileNames=(process.env.EMPIRATA_SCREENSHOT_PROFILES??'desktop').split(',').map(s=>s.trim()).filter(Boolean);

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

async function captureScenario(page,prefix){
  const shots=[];
  async function capture(name){
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    const canvas=page.locator('#map');
    const size=await canvas.evaluate(el=>({width:el.width,height:el.height,cssWidth:el.clientWidth,cssHeight:el.clientHeight}));
    assert.ok(size.width>0&&size.height>0,'Map canvas must have dimensions');
    const file=`${prefix}${name}.png`;
    await page.screenshot({path:resolve(output,file),animations:'disabled',fullPage:true});
    shots.push({file,...size});
  }
  await page.locator('#gameMenu summary').click();
  await page.locator('#campaignMode').selectOption('ai-vs-ai');
  await page.locator('#campaignMap').selectOption('continents:83');
  await page.locator('#startCampaign').click();
  await page.waitForFunction(()=>document.querySelector('#round')?.textContent==='ROUND 1');
  await page.locator('#fitWorld').click();
  await capture('01-fit-world');
  for(let i=0;i<6;i++)await page.locator('#zoomIn').click();
  await page.locator('#recenter').click();
  await capture('02-normal');
  for(let i=0;i<12;i++)await page.locator('#zoomIn').click();
  await capture('03-zoomed-in');
  // The ordinary zoomed-in frame is not the maximum. Capture the actual camera limit separately.
  // Each zoom-in click adds 4 CSS pixels; 220 steps cover the largest supported profile.
  await page.locator('#zoomIn').evaluate(button=>{for(let i=0;i<220;i++)button.click();});
  await capture('04-maximum-zoom');
  await page.locator('#gameMenu summary').click();
  await page.locator('#invasionGame').click();
  await page.locator('#recenter').click();
  await capture('05-invasion');
  return shots;
}

let browser;
try{
  browser=await webkit.launch({headless:true});
  const allShots=[];
  const profiles=[];
  for(const name of profileNames){
    const profile=VIEWPORT_PROFILES[name];
    if(!profile)throw new Error(`Unknown screenshot profile: ${name}`);
    profiles.push({name,...profile});
    const page=await browser.newPage({
      viewport:{width:profile.width,height:profile.height},
      deviceScaleFactor:profile.deviceScaleFactor,
      reducedMotion:'reduce',
    });
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('dialog',dialog=>dialog.accept());
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const shots=await captureScenario(page,profile.prefix);
    assert.deepEqual(errors,[],`Browser must not report uncaught errors (${name})`);
    allShots.push(...shots);
    // Fully revealed artwork showcase avoids fog-of-war obscuring the terrain review.
    await page.goto(`http://127.0.0.1:${server.address().port}/terrain-showcase.html`);
    await page.locator('#map').waitFor();
    await page.waitForFunction(()=>window.__terrainShowcaseReady===true,null,{timeout:15000}).catch(async error=>{throw new Error(`Terrain showcase did not initialize: ${JSON.stringify({url:page.url(),errors,ready:await page.evaluate(()=>window.__terrainShowcaseReady??null)})}`,{cause:error});});
    const showcaseFile=`${profile.prefix}06-terrain-showcase.png`;
    await page.screenshot({path:resolve(output,showcaseFile),animations:'disabled',fullPage:true});
    allShots.push({file:showcaseFile,scenario:'fully revealed synthetic island'});
    await page.close();
  }
  await mkdir(output,{recursive:true});
  const metadata={
    purpose:'Human-reviewed screenshot baseline, not an automatic visual pass/fail',
    commit:process.env.GITHUB_SHA??null,
    browser:'Playwright WebKit',
    profiles,
    scenarios:['continents:83 / ai-vs-ai / round 1','AI Invasion staged test'],
    note:'Set EMPIRATA_SCREENSHOT_PROFILES=desktop,ipad-portrait,ipad-landscape for full matrix. Normal view adds six zoom clicks after fit; zoomed-in adds twelve more; maximum zoom drives the zoom control to its viewport-aware cap.',
    shots:allShots,
  };
  await writeFile(resolve(output,'manifest.json'),JSON.stringify(metadata,null,2)+'\n');
  console.log(`Saved ${allShots.length} screenshots and manifest to ${output}`);
}finally{
  if(browser)await browser.close();
  await new Promise(done=>server.close(done));
}
