// Optional real-browser checks; normal CI needs no browser download.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const {webkit}=await import(process.env.EMPIRATA_PLAYWRIGHT_MODULE??'playwright');

test('Observer speed, progress and cancellation in WebKit',async t=>{
  const root=fileURLToPath(new URL('../dist/',import.meta.url));
  const server=createServer(async(req,res)=>{
    try{
      const route=new URL(req.url??'/','http://localhost').pathname;
      const path=resolve(root,`.${route==='/'?'/index.html':route}`);
      if(!path.startsWith(root.endsWith(sep)?root:root+sep))throw new Error('Invalid path');
      res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[extname(path)]??'application/octet-stream');
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
    const start=async()=>{
      await page.locator('#gameMenu summary').click();await page.locator('#aiVsAiGame').click();
      await page.waitForFunction(()=>document.querySelector('#round').textContent==='ROUND 1');
    };
    const round=async()=>Number((await page.locator('#round').textContent()).replace('ROUND ',''));
    await start();
    await t.test('All four options advance exactly the selected count and clear progress',async()=>{
      assert.equal(await page.locator('#roundSpeed').inputValue(),'1');
      assert.deepEqual(await page.locator('#roundSpeed option').evaluateAll(nodes=>nodes.map(n=>n.value)),['1','10','50','100']);
      for(const count of [1,10,50,100]){
        const before=await round();
        await page.locator('#roundSpeed').selectOption(String(count));
        await page.locator('#advanceRounds').click();
        if(count===100){
          assert.equal(await page.locator('#roundProgress').isVisible(),true);
          assert.equal(await page.locator('#nextRound').isDisabled(),true);
          if(process.env.EMPIRATA_SCREENSHOT_DIR){
            await mkdir(process.env.EMPIRATA_SCREENSHOT_DIR,{recursive:true});
            await page.screenshot({path:resolve(process.env.EMPIRATA_SCREENSHOT_DIR,'observer-progress-portrait.png')});
          }
        }
        await page.waitForFunction(expected=>document.querySelector('#round').textContent===`ROUND ${expected}`&&document.querySelector('#roundProgress').hidden,before+count);
        assert.equal(await page.locator('#advanceRounds').isEnabled(),true);
        assert.equal(await page.locator('#nextRound').isEnabled(),true);
      }
      const finalRound=await round();
      await page.waitForFunction(async expected=>{
        const engine=await import('/engine/index.js');
        return (await engine.loadLocal())?.round===expected;
      },finalRound);
      await page.reload();
      await page.waitForFunction(expected=>document.querySelector('#round').textContent===`ROUND ${expected}`,finalRound);
      assert.equal(await page.locator('#roundProgress').isHidden(),true);
    });
    await t.test('A 100-round manual advance can be paused between rounds',async()=>{
      await page.locator('#roundSpeed').selectOption('100');
      const before=await round();
      const paused=await page.evaluate(min=>new Promise(done=>{
        const node=document.querySelector('#round');
        const observer=new MutationObserver(()=>{
          const current=Number(node.textContent.replace('ROUND ',''));
          if(current>=min){
            const visible=!document.querySelector('#roundProgress').hidden;
            document.querySelector('#autoPlay').click();observer.disconnect();done({current,visible});
          }
        });observer.observe(node,{childList:true,subtree:true});document.querySelector('#advanceRounds').click();
      }),before+3);
      assert.equal(paused.visible,true);assert.ok(paused.current<before+100);
      await page.waitForTimeout(200);assert.equal(await round(),paused.current);
      assert.equal(await page.locator('#roundProgress').isHidden(),true);
    });
    await t.test('Playback uses a changed speed on its next advance and stops cleanly',async()=>{
      const before=await round();
      await page.locator('#roundSpeed').selectOption('1');
      const paused=await page.evaluate(base=>new Promise(done=>{
        const node=document.querySelector('#round');let changed=false;
        const observer=new MutationObserver(()=>{
          const current=Number(node.textContent.replace('ROUND ',''));
          if(current===base+1&&!changed){
            changed=true;const select=document.querySelector('#roundSpeed');select.value='10';select.dispatchEvent(new Event('change'));
          }
          if(current>=base+11){document.querySelector('#autoPlay').click();observer.disconnect();done(current);}
        });observer.observe(node,{childList:true,subtree:true});document.querySelector('#autoPlay').click();
      }),before);
      assert.equal(paused,before+11);
      await page.waitForTimeout(850);assert.equal(await round(),paused);
    });
    await t.test('Starting another scenario cancels pending round work',async()=>{
      await page.locator('#roundSpeed').selectOption('100');const before=await round();
      await page.evaluate(min=>new Promise(done=>{
        const node=document.querySelector('#round');
        const observer=new MutationObserver(()=>{
          if(Number(node.textContent.replace('ROUND ',''))>=min){observer.disconnect();document.querySelector('#classicGame').click();done();}
        });observer.observe(node,{childList:true,subtree:true});document.querySelector('#advanceRounds').click();
      }),before+3);
      await page.waitForTimeout(850);assert.equal(await round(),1);
      assert.equal(await page.locator('#spectatorCard').isHidden(),true);
      assert.equal(await page.locator('#roundProgress').isHidden(),true);
    });
    assert.deepEqual(errors,[]);
  }finally{
    if(browser)await browser.close();
    await new Promise(done=>server.close(done));
  }
});
