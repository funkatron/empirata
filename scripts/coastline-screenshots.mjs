import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

// Opt-in real Chromium capture, separate from fast required CI.
// The existing standalone app is opened as a local file to avoid a server.
await mkdir('coastline-screenshots',{recursive:true});
const browser=await chromium.launch({headless:true});
try {
  for(const viewport of [{width:1440,height:900},{width:1024,height:768}]){
    const page=await browser.newPage({viewport,deviceScaleFactor:1});
    await page.goto('file://'+resolve('index.html'));
    await page.waitForTimeout(1200);
    await page.screenshot({path:`coastline-screenshots/empirata-${viewport.width}x${viewport.height}.png`,fullPage:true});
    await page.close();
  }
} finally {await browser.close();}
