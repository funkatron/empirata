import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import vm from 'node:vm';
import * as engine from '../dist/engine/index.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('Inspection and cargo controls render stable names while retaining type and identity',()=>{
  const source=readFileSync(new URL('../dist/ui/main.js',import.meta.url),'utf8');
  const game=engine.makeCloseQuartersLab(),view=engine.getPlayerView(game,'blue');
  const context=vm.createContext({...engine,game,view});
  vm.runInContext(source.slice(source.indexOf('function knownUnitName('),source.indexOf('function refresh(')),context);
  for(const unit of view.ownUnits){
    context.unit=unit;
    for(const block of ['selectedUnitBlock','spectatorUnitBlock']){
      const rendered=vm.runInContext(`${block}(unit)`,context);
      assert.ok(rendered.includes(engine.unitName(unit)));
      assert.ok(rendered.includes(engine.STATS[unit.kind].name));
      assert.ok(!rendered.includes(`#${unit.id}`));
    }
  }
  const ship=view.ownUnits.find(u=>u.kind==='transport'),cargo=view.ownUnits.find(u=>u.kind==='army');
  cargo.aboard=ship.id;context.unit=ship;
  const rendered=vm.runInContext('selectedUnitBlock(unit)',context);
  assert.ok(rendered.includes(`data-cargo="${cargo.id}"`),'Buttons keep the real order target ID');
  assert.ok(rendered.includes(`Select ${engine.unitName(cargo)}`));
});

test('Standalone browser build contains the map, styles and controls',()=>{
  assert.match(html,/<canvas id="map"/);
  assert.match(html,/<style>/);
  assert.doesNotMatch(html,/src="\.\/ui\/main\.js"/);
  assert.doesNotMatch(html,/href="\.\/styles\.css"/);
  assert.match(html,/loadShipButton/);
  assert.match(html,/unloadShipButton/);
});
test('Bundled application JavaScript is syntactically valid and self-contained',()=>{
  const match=html.match(/<script>\s*([\s\S]*?)<\/script>/);
  assert.ok(match,'Expected embedded bundle script');
  assert.doesNotThrow(()=>new Script(match[1],{filename:'empirata-standalone.js'}));
  assert.match(match[1],/__modules\["engine\/game\.js"\]/);
  assert.match(match[1],/__modules\["ui\/main\.js"\]/);
  assert.match(match[1],/__load\('ui\/main\.js'\)/);
});

test('AI spectator controls support automatic viewpoint alternation and dual scorecards',()=>{
  assert.match(html,/id="spectatorSide"/);
  assert.match(html,/<option value="alternate">Alternate each round<\/option>/);
  assert.match(html,/id="spectatorNow"/);
  assert.match(html,/id="spectatorBlue"/);
  assert.match(html,/id="spectatorRed"/);
  assert.match(html,/id="autoPlay"/);
  assert.match(html,/id="advanceRounds"/);
  assert.match(html,/id="roundSpeed"/);
  for(const speed of [1,10,50,100])assert.match(html,new RegExp(`<option value="${speed}">${speed} rounds?<\\/option>`));
  assert.match(html,/id="roundProgress"[^>]*role="status"[^>]*hidden/);
  assert.match(html,/spectatorMode\s*===\s*['"]alternate['"]/);
  assert.match(html,/spectatorBlue/);
  assert.match(html,/spectatorRed/);
});

test('Touch map supports pinch gestures without dispatching accidental taps',()=>{
  assert.match(html,/function beginPinch\(/);
  assert.match(html,/pinch\.scale\s*\*\s*p\.distance\s*\/\s*pinch\.distance/);
  assert.match(html,/pinch\.worldX\s*\*\s*tileSize/);
  assert.match(html,/pinch\.worldY\s*\*\s*tileSize/);
  assert.match(html,/if\s*\(pinch\s*\|\|\s*suppressTap\)/);
  assert.match(html,/id="fitWorld"/);
});

test('Endgame modal opens once, stays dismissed during inspection, and resets on load',async()=>{
  const {endgameModal}=await import('../dist/ui/endgame.js');
  class Control extends EventTarget{
    textContent='';focusCount=0;
    focus(){this.focusCount++;}
    click(){this.dispatchEvent(new Event('click'));}
  }
  class Dialog extends Control{
    open=false;opens=0;
    showModal(){this.open=true;this.opens++;}
    close(){this.open=false;this.dispatchEvent(new Event('close'));}
  }
  const dialog=new Dialog(),title=new Control(),detail=new Control(),inspect=new Control(),map=new Control();
  const modal=endgameModal(dialog,title,detail,inspect,map);
  modal.update(false,'','');assert.equal(dialog.open,false);
  for(const heading of ['You won','You lost','RED wins','Draw']){
    modal.reset();modal.update(true,heading,'Finished in round 12.');
    assert.equal(dialog.open,true);assert.equal(title.textContent,heading);assert.equal(detail.textContent,'Finished in round 12.');
    assert.ok(inspect.focusCount>0);
    inspect.click();assert.equal(dialog.open,false);assert.ok(map.focusCount>0);
    const opens=dialog.opens;modal.update(true,heading,'Finished in round 12.');
    assert.equal(dialog.opens,opens,'Inspection refresh must not reopen the modal');
    modal.show();assert.equal(dialog.open,true,'Result can be reopened');
    dialog.close(); // Native Escape dismissal also uses the close event.
    modal.update(true,heading,'Finished in round 12.');assert.equal(dialog.open,false);
  }
  modal.reset();modal.update(true,'BLUE wins','Imported finished game');assert.equal(dialog.open,true);
  modal.update(false,'','');assert.equal(dialog.open,false);
});

test('Endgame dialog has accessible labels and reuses save and restart actions',()=>{
  assert.match(html,/<dialog id="endgameDialog"[^>]*aria-labelledby="endgameTitle"[^>]*aria-describedby="endgameDetail"/);
  for(const id of ['endgameInspect','endgameExport','endgameNewGame','resultReview'])assert.ok(html.includes(`id="${id}"`));
  const source=readFileSync(new URL('../dist/ui/main.js',import.meta.url),'utf8');
  assert.match(source,/el\('endgameExport'\).*el\('exportSave'\)\.click\(\)/);
  assert.match(source,/el\('endgameNewGame'\).*el\('resultNewGame'\)\.click\(\)/);
});
