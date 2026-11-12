// Optional WebKit regression: inspect real production panels after city capture.
// No gameplay code or production test hooks are introduced into the application.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const {webkit}=await import(process.env.EMPIRATA_PLAYWRIGHT_MODULE??'playwright');
const profiles={
  desktop:{width:1024,height:768,deviceScaleFactor:1},
  'ipad-portrait':{width:834,height:1194,deviceScaleFactor:2},
};
const selected=(process.env.EMPIRATA_CAPTURE_PROFILES??'desktop,ipad-portrait')
  .split(',').map(s=>s.trim()).filter(Boolean);
const output=resolve(process.env.EMPIRATA_CAPTURE_DIR??'artifacts/capture-production');
await mkdir(output,{recursive:true});
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const server=createServer(async(req,res)=>{
  try{
    const route=new URL(req.url??'/','http://localhost').pathname;
    const path=resolve(root,'.'+(route==='/'?'/index.html':route));
    if(!path.startsWith(root.endsWith(sep)?root:root+sep))throw Error('Invalid path');
    res.setHeader('Content-Type',({
      '.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'
    })[extname(path)]??'application/octet-stream');
    res.end(await readFile(path));
  }catch{res.writeHead(404);res.end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));

const observations=[];
async function inspectCity(page,position){
  await page.locator('#fitWorld').click();
  // "Fit World" clamps camera offsets to zero. A center-of-cell click uses
  // the same camera helper formula as the app, in CSS rather than device pixels.
  const click=await page.locator('#map').evaluate((canvas,p)=>{
    const tile=Math.min(canvas.clientWidth/100,canvas.clientHeight/60);
    return {x:(p.x+0.5)*tile,y:(p.y+0.5)*tile};
  },position);
  await page.locator('#map').click({position:click});
  if(await page.locator('#stackDialog').isVisible()){
    await page.locator('#stackChoices button').filter({hasText:'Inspect '}).first().click();
  }
  return await page.locator('#inspector').innerText();
}
async function shot(page,profile,name,detail){
  const file=profile+'-'+name+'.png';
  await page.screenshot({path:resolve(output,file),animations:'disabled',fullPage:true});
  observations.push({profile,checkpoint:name,file,...detail});
}

async function testComputer(page,profile,side){
  const setup=await page.evaluate(async faction=>{
    const engine=await import('/engine/index.js');
    let game=engine.makeRulesLab();
    game.scenario='ai-vs-ai';game.active=faction;
    const defender=faction==='blue'?'red':'blue';
    const city=game.cities.find(c=>c.owner===defender);
    const otherHome=game.cities.find(c=>c.id==='c8');
    otherHome.owner=defender; // Keep the campaign alive after conquest.
    const army=game.units.find(u=>u.owner===faction&&u.kind==='army');
    game.units=game.units.filter(u=>u.owner===faction);
    army.position={x:city.position.x+(faction==='blue'?-1:1),y:city.position.y};
    army.spent=0;
    engine.updateAllKnowledge(game);
    game=engine.adjudicateCityCapture(game,{
      armyId:army.id,cityId:city.id,outcome:'captured'
    });
    game=engine.playAiOpponent(game,faction);
    if(faction==='red')game=engine.endTurn(game); // UI accepts blue-turn saves.
    const captured=game.cities.find(c=>c.id===city.id);
    if(captured.owner!==faction||captured.production!=='army'||captured.progress!==0)
      throw Error('Prepared capture did not commission its factory');
    await engine.saveLocally(game);
    return {cityId:city.id,position:city.position,round:game.round};
  },side);
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#scenarioName')?.textContent?.includes('COMPUTER vs COMPUTER'));
  await page.locator('#spectatorSide').selectOption(side);
  assert.match(await page.locator('#spectatorNow').innerText(),new RegExp('Currently viewing '+side.toUpperCase()));
  async function checkpoint(name,progress,phase,hasProduct){
    const inspector=await inspectCity(page,setup.position);
    assert.match(inspector,/Production\s+army/i,'Captured factory must show its assigned unit');
    assert.match(inspector,new RegExp('Progress\\s+'+progress+'\\s*/\\s*'+(phase==='Setup'?6:5)),'Inspector must reflect real city progress');
    assert.match(inspector,/Spectator inspection only/);
    assert.equal(await page.locator('#productionSelect').count(),0,'Spectator must never receive factory orders');
    const snapshot=await page.evaluate(async target=>{
      const e=await import('/engine/index.js');
      const g=await e.loadLocal();
      const city=g.cities.find(c=>c.id===target);
      return {owner:city.owner,production:city.production,progress:city.progress,firstCycle:city.firstCycle,
        unitIds:g.units.filter(u=>u.owner===city.owner&&u.position.x===city.position.x&&
          u.position.y===city.position.y).map(u=>u.id)};
    },setup.cityId);
    assert.equal(snapshot.owner,side);
    assert.equal(snapshot.progress,progress);
    assert.equal(snapshot.firstCycle,phase==='Setup');
    assert.equal(snapshot.unitIds.length>0,hasProduct);
    await shot(page,profile,side+'-'+name,{side,city:setup.cityId,progress,phase,unitsAtCity:snapshot.unitIds.length});
  }
  await checkpoint('assigned',0,'Setup',false);
  for(const [name,turns,progress,phase,produced] of [
    ['mid-cycle',3,3,'Setup',false],['first-army',3,0,'Repeat',true]
  ]){
    await page.evaluate(async amount=>{
      const e=await import('/engine/index.js');
      let g=await e.loadLocal();
      for(let i=0;i<amount;i++)g=e.endTurn(e.endTurn(g));
      await e.saveLocally(g);
    },turns);
    await page.reload();
    await page.waitForFunction(()=>document.querySelector('#scenarioName')?.textContent?.includes('COMPUTER vs COMPUTER'));
    await page.locator('#spectatorSide').selectOption(side);
    await checkpoint(name,progress,phase,produced);
  }
}

async function testHuman(page,profile){
  const fixture=await page.evaluate(async()=>{
    const e=await import('/engine/index.js');
    let g=e.makeRulesLab();g.scenario='user-vs-computer';
    const city={id:'browser-captured',position:{x:10,y:25},owner:null,
      production:null,progress:0,firstCycle:true};
    g.cities.push(city);
    e.updateAllKnowledge(g);
    g=e.adjudicateCityCapture(g,{armyId:'u1',cityId:city.id,outcome:'captured'});
    await e.saveLocally(g);
    return {cityId:city.id,position:city.position};
  });
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#scenarioName')?.textContent?.includes('USER vs COMPUTER'));
  let inspector=await inspectCity(page,fixture.position);
  assert.match(inspector,/Factory progress\s+0\s*\/\s*—/i);
  assert.equal(await page.locator('#productionSelect').inputValue(),'','New human capture needs a production choice');
  await shot(page,profile,'human-needs-orders',{city:fixture.cityId,progress:0,production:null});
  await page.locator('#productionSelect').selectOption('army');
  assert.equal(await page.locator('#productionSelect').inputValue(),'army');
  inspector=await page.locator('#inspector').innerText();
  assert.match(inspector,/Factory progress\s+0\s*\/\s*6/);
  await page.waitForFunction(async target=>{
    const e=await import('/engine/index.js');const g=await e.loadLocal();
    return g?.cities.find(c=>c.id===target)?.production==='army';
  },fixture.cityId);
  await page.locator('#nextRound').click();
  await page.waitForFunction(()=>document.querySelector('#round')?.textContent==='ROUND 2');
  inspector=await page.locator('#inspector').innerText();
  assert.match(inspector,/Factory progress\s+1\s*\/\s*6/,'Human factory must visibly advance');
  await shot(page,profile,'human-production-progress',{city:fixture.cityId,progress:1,production:'army'});
}

let browser;
try{
  browser=await webkit.launch({headless:true});
  for(const profileName of selected){
    const profile=profiles[profileName];
    if(!profile)throw Error('Unknown browser profile: '+profileName);
    const page=await browser.newPage({viewport:{width:profile.width,height:profile.height},
      deviceScaleFactor:profile.deviceScaleFactor,reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror',err=>errors.push(err.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    page.on('requestfailed',request=>errors.push(request.url()+' '+request.failure()?.errorText));
    page.on('dialog',dialog=>dialog.accept());
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.waitForFunction(()=>document.querySelector('#toast')?.textContent?.length>0);
    for(const side of ['blue','red'])await testComputer(page,profileName,side);
    await testHuman(page,profileName);
    assert.deepEqual(errors,[],'Unexpected browser errors on '+profileName);
    await page.close();
  }
  await writeFile(resolve(output,'manifest.json'),JSON.stringify({
    purpose:'Captures and real inspector assertions after deterministic city conquest',
    commit:process.env.GITHUB_SHA??null,
    browser:'Playwright WebKit',
    profiles:selected,observations
  },null,2)+'\n');
  console.log('Verified '+observations.length+' captured-city inspector checkpoints in WebKit');
}finally{
  if(browser)await browser.close();
  await new Promise(done=>server.close(done));
}
