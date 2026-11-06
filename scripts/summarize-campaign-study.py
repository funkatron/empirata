"""Summarize immutable campaign observations; never infer hidden AI knowledge."""
import json,pathlib,statistics,collections,gzip,os
root=pathlib.Path(os.environ.get('STUDY_OUT','docs/evaluation/strategy-baseline'))
files=sorted((root/'runs').glob('*.json'))
files+=sorted(p for p in (root/'runs').glob('*.json.gz') if not p.with_suffix('').exists())
runs=[json.loads(gzip.decompress(p.read_bytes()) if p.suffix=='.gz' else p.read_bytes()) for p in files]
rows=[]
for r in runs:
 if r['status']=='running':continue
 initial={c['id']:c['owner'] for c in r.get('world',{}).get('cities',[])}
 neutral=collections.Counter();hostile=collections.Counter();consumed={};hostileCities=collections.defaultdict(set)
 for e in r['captures']:
  (neutral if initial.get(e['city']) is None else hostile)[e['owner']]+=1
  if initial.get(e['city']) is not None:hostileCities[e['owner']].add(e['city'])
  initial[e['city']]=e['owner']
  import re
  a=re.search(r'captured\. (u\d+)',e['message'])
  if a:consumed[a[1]]=e
 for f in ['blue','red']:
  final=r['checkpoints'][-1]['factions'][f];m=r['metrics'][f]
  moves=[e for e in r['moves'] if e['owner']==f]
  loaded=[e for e in moves if e['cargo']>0];departures=[e for e in loaded if e['port']]
  landed=[e for e in r['landings'] if e['owner']==f];landedIds={e['army'] for e in landed if e['army']}
  lostShips=[e for e in r['removed'] if e['owner']==f and e['kind']=='transport']
  peak5=max([sum(t['round']>=e['round'] and t['round']<e['round']+5 for t in landed) for e in landed] or [0])
  row=dict(id=r['id'],layout=r['layout'],seed=r['seed'],swap=r['swap'],density=r['cities'],profile=r.get('profile','distant'),faction=f,status=r['status'],rounds=r.get('completedRounds',0),finalCities=final['cities'],ports=final['ports'],ashore=final['ashore'],guards=final['guards'],transports=final['byType']['transport'],fighters=final['byType']['fighter'],carriers=final['byType']['carrier'],otherCombatShips=sum(final['byType'][k] for k in ['submarine','cruiser','battleship']),knownNeutral=final['knownNeutral'],knownHostile=final['knownHostile'],neutralCaptures=neutral[f],hostileCaptures=hostile[f],landed=m['landed'],uniqueLanded=len(landedIds),landedCaptureArmies=len(landedIds&consumed.keys()),maxLandingsIn5Rounds=peak5,loadedSteps=len(loaded),emptySteps=len(moves)-len(loaded),loadedPortDepartures=len(departures),meanPortDepartureLoad=statistics.mean(e['cargo'] for e in departures) if departures else None,fullPortDepartures=sum(e['cargo']==e['capacity'] for e in departures),maxMoveLoad=max([e['cargo'] for e in moves] or [0]),transportsLost=len(lostShips),loadedTransportsLost=sum(e['cargo']>0 for e in lostShips),cargoLost=sum(e['cargo'] for e in lostShips),meanRoundMs=r.get('timing',{}).get('meanMs'))
  row['hostileUniqueCities']=len(hostileCities[f])
  classified=[]
  starts={c['id']:c['owner'] for c in r['world']['cities']}
  for departure in departures:
   owner=starts.get(departure['objective']);ambiguous=False
   for capture in r['captures']:
    if capture['city']!=departure['objective']:continue
    if capture['round']<departure['round']:owner=capture['owner']
    elif capture['round']==departure['round']:ambiguous=True
   if not ambiguous and owner is not None and owner!=f:classified.append(departure)
  row['hostilePortDepartures']=len(classified)
  row['hostilePortDepartureLoads']=[e['cargo'] for e in classified]
  row['hostileFullPortDepartures']=sum(e['cargo']==e['capacity'] for e in classified)
  row['hostileCitiesRetained']=sum(initial.get(city)==f for city in hostileCities[f])
  row['repeatLandingEvents']=len(landed)-len(landedIds)
  row['maxLandingsPerArmy']=max(collections.Counter(e['army'] for e in landed).values(),default=0)
  row.update(m)
  rows.append(row)
groups=[]
for layout in ['continents','islands','archipelago']:
 for density in [12,64]:
  selection=[r for r in rows if r['layout']==layout and r['density']==density and r['profile']=='distant']
  group=dict(layout=layout,density=density,factionSamples=len(selection))
  for k in ['rounds','finalCities','ashore','transports','landed','neutralCaptures','hostileCaptures','loadedPortDepartures','maxLandingsIn5Rounds','meanRoundMs']:
   values=[r[k] for r in selection if r[k] is not None];group[k]={'median':statistics.median(values),'min':min(values),'max':max(values)} if values else None
  group['noLanding']=sum(r['landed']==0 for r in selection);groups.append(group)
common=[]
for r in runs:
 for cp in r.get('checkpoints',[]):
  if cp['round']!=101:continue
  for f,d in cp['factions'].items():common.append(dict(id=r['id'],layout=r['layout'],seed=r['seed'],swap=r['swap'],density=r['cities'],profile=r.get('profile','distant'),faction=f,cities=d['cities'],ports=d['ports'],ashore=d['ashore'],guards=d['guards'],transports=d['byType']['transport'],fighters=d['byType']['fighter'],knownNeutral=d['knownNeutral'],knownHostile=d['knownHostile'],landings=sum(e['owner']==f and e['round']<=100 for e in r['landings']),captures=sum(e['owner']==f and e['round']<=100 for e in r['captures'])))
summary={'runs':len([r for r in runs if r['status']!='running']),'rounds':sum(r.get('completedRounds',0) for r in runs if r['status']!='running'),'statuses':dict(collections.Counter(r['status'] for r in runs)),'rows':rows,'groups':groups,'common100':common}
(root/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k not in ['rows','common100']},indent=2))
