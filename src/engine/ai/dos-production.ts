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
