export type FactionId = 'blue' | 'red' | 'green';
export type Terrain = 'land' | 'sea';
export type UnitType = 'army' | 'fighter' | 'destroyer' | 'transport' | 'submarine' | 'cruiser' | 'carrier' | 'battleship';
export type Coord = { x: number; y: number };
export type UnitOrder =
  | { kind: 'none' | 'sentry' | 'skip' | 'random' | 'load-ship' | 'unload-ship' }
  | { kind: 'move-to'; destination: Coord }
  | { kind: 'go-direction'; direction: Coord }
  | { kind: 'patrol'; from: Coord; to: Coord; outbound: boolean }
  | { kind: 'go-home' }
  | { kind: 'escort'; targetId: string };
export type Player = { id: FactionId; label: string; productionEfficiency: number; combatEfficiency: 50 };
export type City = {
  id: string; position: Coord; owner: FactionId | null;
  production: UnitType | null; progress: number; firstCycle: boolean;
};
export type Unit = {
  id: string; owner: FactionId; kind: UnitType; position: Coord;
  damage: number; spent: number; fuel: number | null; order: UnitOrder;
  aboard: string | null;
  /** Modern AI only — see docs/MODERN_AI_UNIT_FIELDS.md */
  aiMissionProgress?: {round:number; bestDistance:number; metric:'sea'|'city'; cargo:number};
  aiAvoidObjective?: {id:string; until:number};
  aiPickup?: {armies:string[];startedRound:number};
  aiBeachhead?: string;
  aiAssembly?: {objective:string;startedRound:number;staging?:Coord;gathered?:boolean};
  aiObjective?: string;
};
export type Sight = { id: string; kind: UnitType; owner: FactionId; position: Coord; observedRound: number };
export type CityIntel = { id: string; owner: FactionId | null; production: UnitType | null; productionKnown: boolean };
export type Knowledge = {
  terrain: Array<Terrain | null>;
  visible: number[];
  sightings: Sight[];
  freshEnemies: string[];
  cities: Record<string, CityIntel>;
};
export type GameEvent = {
  id: number; round: number; recipient: FactionId | null;
  kind: 'production' | 'movement' | 'system' | 'fuel' | 'repair' | 'combat'; message: string;
};
import type { AiPolicy } from './ai/classic-grades.js';
export type Game = {
  schema: 1; ruleset: 'interstel-2.05'; mode: 'rules-lab';
  scenario?: 'classic-lab' | 'close-quarters' | 'ai-invasion' | 'ai-vs-ai' | 'user-vs-computer';
  /** Staged policy selection; omitted saves continue to use the existing modern AI. */
  aiPolicy?: AiPolicy;
  /** Classic ALG-AI-004: resign dialog already offered per computer faction. */
  classicResignOffered?: Partial<Record<FactionId, boolean>>;
  /** Classic ALG-AI-004: awaiting human accept/decline (`human` responds for `computer`). */
  classicResignPending?: { computer: FactionId; human: FactionId; round: number };
  campaignMap?: {
    layout: 'continents' | 'islands' | 'archipelago';
    seed: number;
    algorithm?: 'ellipse-v1' | 'organic-v1';
    density?: 'sparse' | 'standard';
  };
  width: number; height: number; tiles: Terrain[];
  players: Player[]; active: FactionId; round: number;
  cities: City[]; units: Unit[]; knowledge: Record<FactionId, Knowledge>;
  rng: { seed: number; draws: number }; nextId: number; nextEventId: number;
  events: GameEvent[];
};
export type PlayerCell = { terrain: Terrain | null; visible: boolean; city: CityIntel | null };
export type PlayerView = {
  width: number; height: number; active: FactionId; round: number;
  cells: PlayerCell[];
  ownCities: City[]; ownUnits: Unit[]; enemies: Array<Sight & { stale: boolean }>;
  events: GameEvent[];
};
