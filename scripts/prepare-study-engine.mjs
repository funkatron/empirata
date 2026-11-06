// Evaluation-only probes in a separate compiled copy. Production source is untouched.
import {cpSync,readFileSync,writeFileSync} from 'node:fs';
cpSync('dist','study-engine',{recursive:true});
const emit=`const __study=(g,data)=>globalThis.__empirataStudy?.({...data,owner:data.owner==null?null:g.players.find(p=>p.id===data.owner)?.label.toLowerCase(),round:g.round});\n`;
for(const file of ['game','adjudication']){
 const path=`study-engine/engine/${file}.js`;let s=readFileSync(path,'utf8');
 const marker='    if (g.events.length > 300)';
 if(s.split(marker).length!==2)throw Error('Log probe anchor changed');
 s=emit+s.replace(marker,"    __study(g,{type:'event',...g.events.at(-1),owner:g.events.at(-1).recipient});\n"+marker);
 if(file==='game'){
  const move='    unit.position = { ...to };';
  if(s.split(move).length!==2)throw Error('Movement probe anchor changed');
  s=s.replace(move,"    if(unit.kind==='transport')__study(g,{type:'move',id:unit.id,owner:unit.owner,from:{...unit.position},to:{...to},port:departurePort?.id??null,cargo:g.units.filter(u=>u.aboard===unit.id).length,capacity:capacity(unit),objective:unit.aiObjective??null});\n"+move);
 }else{
  const dead='    g.units = g.units.filter(u => !doomed.has(u.id));';
  if(s.split(dead).length!==2)throw Error('Removal probe anchor changed');
  s=s.replace(dead,"    for(const unit of g.units.filter(u=>doomed.has(u.id)))__study(g,{type:'removed',id:unit.id,kind:unit.kind,owner:unit.owner,aboard:unit.aboard,cargo:g.units.filter(u=>u.aboard===unit.id).length});\n"+dead);
 }
 writeFileSync(path,s);
}
