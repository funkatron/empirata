// Evaluation observes full states only to measure outcomes; it never supplies
// this information to an opponent. Losses count removed hulls, not captures.
export function roundOutcomes(before,after,faction){
  const surviving=new Set(after.units.map(u=>u.id));
  const lost=before.units.filter(u=>u.owner===faction&&u.kind==='transport'&&!surviving.has(u.id));
  const cargo=before.units.filter(u=>u.owner===faction&&u.aboard&&lost.some(t=>t.id===u.aboard)&&!surviving.has(u.id));
  const previous=new Map(before.cities.map(c=>[c.id,c.owner]));
  return {
    captures:after.cities.filter(c=>c.owner===faction&&previous.has(c.id)&&previous.get(c.id)!==faction).length,
    citiesLost:after.cities.filter(c=>c.owner!==faction&&previous.get(c.id)===faction).length,
    transportsLost:lost.length,
    loadedTransportsLost:lost.filter(t=>cargo.some(u=>u.aboard===t.id)).length,
    embarkedUnitsLost:cargo.length,
  };
}
