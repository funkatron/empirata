import {execFileSync} from 'node:child_process';
import {readFileSync,appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export function verificationScope(files){
 const displayOnly=p=>p.startsWith('src/ui/')||p.startsWith('public/')||p.startsWith('docs/')||
  ['README.md','DEPLOYMENT.md','src/engine/unit-names.ts','tests/unit-names.test.mjs','smoke/bundle.mjs','smoke/observer-batching.mjs'].includes(p);
 return files.length>0&&files.every(displayOnly)?'focused':'full';
}
export function selectScope(eventName,event,diff){
 if(!['pull_request','push'].includes(eventName))return 'full';
 const base=eventName==='pull_request'?event.pull_request?.base?.sha:event.before;
 if(!/^[a-f0-9]{40}$/.test(base??'')||/^0+$/.test(base))return 'full';
 try{return verificationScope(diff(base));}catch{return 'full';}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let scope='full';
 try{
  const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
  // HEAD is the tested PR merge commit or the pushed main commit. Compare the
  // complete change, not only its final commit; include both sides of renames.
  scope=selectScope(process.env.GITHUB_EVENT_NAME,event,base=>execFileSync('git',
   ['diff','--no-renames','--name-only','-z',base,'HEAD'],{encoding:'utf8'}).split('\0').filter(Boolean));
 }catch{/* Missing event or history must never silently reduce verification. */}
 console.log(`Verification scope: ${scope}`);
 if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`scope=${scope}\n`);
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  `### Verification scope: ${scope}\n${scope==='full'?'Full engine tests and coverage gates.':'Focused naming/result tests.'} TypeScript, standalone build and browser smoke checks always run.\n`);
}
