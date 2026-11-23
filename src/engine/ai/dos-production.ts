import type {UnitType} from '../types.js';
import type {DosComputerGrade} from './classic-grades.js';

/** ALG-AI-002, recovered ship-mix pass at image 0x39A9.
 * A deliberately narrow, pure policy primitive. This is NOT the complete
 * city production chooser and must not be used as a substitute for it.
 * Inventory counts include living owned units, including embarked units.
 */
const TYPES:readonly UnitType[]=['army','fighter','destroyer','transport','submarine','cruiser','carrier','battleship'];
export type DosUnitInventory = Readonly<Record<UnitType,number>>;

export function dosShipMixChoice(inventory:DosUnitInventory,grade:DosComputerGrade):UnitType {
  if(grade!==1&&grade!==2)throw new Error('Unsupported DOS computer grade.');
  for(const kind of TYPES){
    if(!Number.isSafeInteger(inventory[kind])||inventory[kind]<0)
      throw new Error('Invalid DOS unit inventory.');
  }
  // The disassembly first defaults to battleship, then scans 6 down to 2,
  // replacing the candidate when the lower-index count is smaller.
  let candidate:UnitType='battleship';
  for(let type=6;type>=2;type--){
    if(inventory[TYPES[type]!] < inventory[TYPES[type+1]!])candidate=TYPES[type]!;
  }
  // Remaining branch priorities follow the recovered 0x39A9 sketch.
  if(inventory.battleship===0&&grade===2)return 'battleship';
  if(inventory.carrier===0)return 'carrier';
  if(inventory.transport<2)return 'transport';
  if(inventory.destroyer===0&&grade===2)return 'destroyer';
  return candidate;
}

/** ALG-AI-002 inventory block ES:1810, derived solely from the acting
 * player's own units in PlayerView. Embarked units remain living inventory.
 * This does not inspect enemy units, undiscovered terrain or hidden cities.
 */
export function dosOwnUnitInventory(view:Pick<import('../types.js').PlayerView,'ownUnits'>):DosUnitInventory {
  const counts:Record<UnitType,number>={army:0,fighter:0,destroyer:0,transport:0,submarine:0,cruiser:0,carrier:0,battleship:0};
  for(const unit of view.ownUnits){
    if(!Object.hasOwn(counts,unit.kind))throw new Error('Invalid unit type in DOS inventory.');
    counts[unit.kind]++;
  }
  return counts;
}
