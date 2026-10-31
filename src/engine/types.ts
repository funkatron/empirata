export type FactionId = 'blue' | 'red' | 'green';
export type Terrain = 'land' | 'sea';
export type UnitType = 'army' | 'fighter' | 'destroyer' | 'transport' | 'submarine' | 'cruiser' | 'carrier' | 'battleship';
export type Coord = { x: number; y: number };
export type UnitOrder = { kind: 'none' | 'sentry' | 'skip' | 'load-ship' | 'unload-ship' } | {kind:'move-to'; destination:Coord} | {kind:'go-direction'; direction:Coord} | {kind:'patrol'; from:Coord; to:Coord; outbound:boolean} | {kind:'go-home'} | {kind:'escort'; targetId:string};
export type Player = { id: FactionId; label: string; productionEfficiency: 50; combatEfficiency: 50 };
export type City = {
  id: string; position: Coord; owner: FactionId | null;
  production: UnitType | null; progress: number; firstCycle: boolean;
};
export type Unit = {
  id: string; owner: FactionId; kind: UnitType; position: Coord;
  damage: number; spent: number; fuel: number | null; order: UnitOrder;
  aboard: string | null;
  aiMissionProgress?: {round:number; bestDistance:number; cargo:number};
  aiAvoidObjective?: {id:string; until:number};
  aiBeachhead?: string; // City objective attached to AI-delivered assault troops.
  aiAssembly?: {objective:string;startedRound:number;staging?:Coord;gathered?:boolean};
  aiObjective?: string; // Experimental AI city mission, independent of player orders.
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
export type Game = {
  schema: 1; ruleset: 'interstel-2.05'; mode: 'rules-lab';
  scenario?: 'classic-lab' | 'close-quarters' | 'ai-invasion' | 'ai-vs-ai';
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
