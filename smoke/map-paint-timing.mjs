// Optional WebKit timing probe for map geography cache vs fog overlay.
// Run on GitHub Actions only — this workstation does not host Playwright.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const {webkit}=await import(process.env.EMPIRATA_PLAYWRIGHT_MODULE??'playwright');
const outDir=process.env.EMPIRATA_MAP_PAINT_DIR
  ?resolve(process.env.EMPIRATA_MAP_PAINT_DIR)
  :null;

test('CvC map paint: warm reveal-on refresh skips geography rebuild',async()=>{
  const root=fileURLToPath(new URL('../dist/',import.meta.url));
  const server=createServer(async(req,res)=>{
    try{
      const route=new URL(req.url??'/','http://localhost').pathname;
      const path=resolve(root,`.${route==='/'?'/index.html':route}`);
      if(!path.startsWith(root.endsWith(sep)?root:root+sep))throw new Error('Invalid path');
      res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'})[extname(path)]??'application/octet-stream');
      res.end(await readFile(path));
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  let browser;
  try{
    browser=await webkit.launch({headless:true});
    const page=await browser.newPage({viewport:{width:1024,height:1366}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    page.on('dialog',dialog=>dialog.accept());
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(()=>document.querySelector('#toast').textContent.length>0);
    // Direct-child summary only — nested Test scenarios also uses <summary>.
    await page.locator('#gameMenu > summary').click();
    const testMenu=page.locator('#testScenariosMenu');
    if(!(await testMenu.evaluate(el=>el.open)))await page.locator('#testScenariosMenu > summary').click();
    await page.locator('#aiVsAiGame').click({force:true});
    await page.waitForFunction(()=>document.querySelector('#round').textContent==='ROUND 1');
    await page.waitForFunction(()=>window.empirataMapPaintProbe&&document.querySelector('#spectatorTerrain'));
    // Atlas load rebuilds the layer once; wait so cold/warm samples are stable.
    await page.waitForFunction(()=>document.querySelector('#toast').textContent.length>0,{timeout:15_000});
    await page.waitForTimeout(250);

    const sample=async(label,action)=>{
      await page.evaluate(async name=>{
        const probe=window.empirataMapPaintProbe;
        probe.reset();
        if(name==='cold-reveal-on'){probe.setReveal(true);probe.invalidateAndPaint();}
        else if(name==='warm-reveal-on'){probe.refreshOnce();}
        else if(name==='cold-reveal-off'){probe.setReveal(false);}
        else if(name==='warm-reveal-off'){probe.refreshOnce();}
      },label);
      return page.evaluate(name=>{
        const stats=window.empirataMapPaintProbe.stats();
        return {label:name,...stats};
      },label);
    };

    const coldOn=await sample('cold-reveal-on');
    const warmOn=await sample('warm-reveal-on');
    const coldOff=await sample('cold-reveal-off');
    const warmOff=await sample('warm-reveal-off');
    const report={
      measuredAt:new Date().toISOString(),
      viewport:{width:1024,height:1366},
      samples:[coldOn,warmOn,coldOff,warmOff],
      ratios:{
        warmOnPaintOverColdOn:coldOn.lastPaintMs>0?warmOn.lastPaintMs/coldOn.lastPaintMs:null,
        warmOnEnsureOverColdOn:coldOn.lastEnsureMs>0?warmOn.lastEnsureMs/coldOn.lastEnsureMs:null,
      },
    };
    console.log(JSON.stringify(report,null,2));
    if(outDir){
      await mkdir(outDir,{recursive:true});
      await writeFile(resolve(outDir,'map-paint-timing.json'),JSON.stringify(report,null,2));
    }

    assert.equal(coldOn.lastRebuild,true,'Cold reveal-on must stamp geography');
    assert.ok(coldOn.lastEnsureMs>0,'Cold ensure should take measurable time');
    assert.equal(warmOn.lastRebuild,false,'Warm reveal-on refresh must reuse geography cache');
    assert.equal(warmOn.lastEnsureMs,0,'Warm ensure should be a cache hit');
    assert.ok(warmOn.lastPaintMs<coldOn.lastPaintMs,
      `Warm paint (${warmOn.lastPaintMs.toFixed(1)}ms) should beat cold (${coldOn.lastPaintMs.toFixed(1)}ms)`);
    assert.equal(coldOff.lastRebuild,true,'Reveal-off still rebuilds knowledge stamps when toggled');
    assert.equal(warmOff.lastRebuild,true,'Reveal-off refresh still invalidates knowledge stamps');
    assert.deepEqual(errors,[]);
  }finally{
    if(browser)await browser.close();
    await new Promise(done=>server.close(done));
  }
});
