import type { CountryId } from '../data/regionDefs';
export type { CountryId };

/** Versión del formato de guardado. Incrementar al cambiar la forma del estado. */
export const SAVE_VERSION = 2;

export interface Policy {
  /** Impuestos: % del PIB recaudado. */
  taxRate: number;
  /** Gasto público corriente (social, administración): % del PIB. */
  publicSpending: number;
  /** Inversión pública (infraestructura, educación): % del PIB. */
  investment: number;
  /** Presupuesto militar: % del PIB. */
  militaryBudget: number;
}

export interface MonthlyReport {
  day: number;
  revenue: number;
  spending: number;
  interest: number;
  balance: number;
  growth: number;
  stability: number;
}

export interface CountryState {
  id: CountryId;
  /** PIB anual en miles de millones de USD (derivado de las regiones controladas). */
  gdp: number;
  /** Población en millones (derivada de las regiones controladas). */
  population: number;
  /** Reservas monetarias (tesoro), miles de millones USD. */
  reserves: number;
  /** Deuda pública, miles de millones USD. */
  debt: number;
  policy: Policy;
  /** Políticas de referencia (de partida); determinan la "normalidad" del país. */
  basePolicy: Policy;
  /** Crecimiento económico anual (%), calculado en el cierre mensual. */
  growth: number;
  baseGrowth: number;
  /** 0-100 */
  stability: number;
  /** Estabilidad de referencia a la que tiende el país en condiciones normales. */
  baseStability: number;
  /** Calidad de las tropas (multiplicador de combate). */
  armyQuality: number;
  /** Coste anual de mantenimiento de un batallón completo (miles de millones). */
  unitCost: number;
  /** Ingresos y gastos acumulados en el mes en curso. */
  monthRevenue: number;
  monthSpending: number;
  monthInterest: number;
  lastReport: MonthlyReport | null;
  /** Bajas militares acumuladas (efectivos). */
  casualties: number;
  /** Ratio de abastecimiento militar (gasto militar / mantenimiento necesario). */
  supplyRatio: number;
  eliminated: boolean;
  /** Reservas nacionales de equipo terrestre: modelo → unidades sin asignar (MIL-017). */
  inventory: Record<string, number>;
  /** Reposición automática de efectivos y equipo (pausable, MIL-019/038). */
  autoReplenish: boolean;
}

export interface RegionState {
  id: string;
  /** Propietario legal (de jure). */
  owner: CountryId;
  /** Quién controla la región ahora (de facto). */
  controller: CountryId;
  /** PIB de la región (miles de millones USD). */
  gdp: number;
  /** Población (millones). */
  population: number;
  /** Horas acumuladas de ocupación en curso. */
  occupationHours: number;
  /** País que está ocupando (si occupationHours > 0). */
  occupier: CountryId | null;
}

export type UnitStatus = 'idle' | 'moving' | 'combat' | 'retreating';

export interface Unit {
  id: string;
  owner: CountryId;
  name: string;
  /** Efectivos. Máximo UNIT_MAX_MEN. */
  men: number;
  /** Organización 0-100. */
  org: number;
  /** Moral 0-100. */
  morale: number;
  regionId: string;
  /** Destino final de la orden actual. */
  destination: string | null;
  /** Ruta pendiente (sin la región actual). */
  path: string[];
  /** Progreso 0-1 hacia path[0]. */
  progress: number;
  status: UnitStatus;
  /** Equipo asignado: modelo → cantidad (plantilla universal, MIL-001C/022–026). */
  equipment: Record<string, number>;
  /** Voluntarios ya reclutados (y pagados) que aún no se han incorporado (MIL-012). */
  recruitPending: number;
}

export type WarSide = 'attackers' | 'defenders';

export interface War {
  id: string;
  name: string;
  attackers: CountryId[];
  defenders: CountryId[];
  startHour: number;
  casualties: Partial<Record<CountryId, number>>;
}

export interface Battle {
  regionId: string;
  startHour: number;
  lastHour: number;
  losses: Partial<Record<CountryId, number>>;
  participants: CountryId[];
}

export interface TradeAgreement {
  a: CountryId;
  b: CountryId;
  sinceHour: number;
}

export type PeaceTerms = 'white' | 'status_quo';

export type ProposalKind = 'trade' | 'peace' | 'military_support';

export interface Proposal {
  id: string;
  kind: ProposalKind;
  from: CountryId;
  to: CountryId;
  createdHour: number;
  expiresHour: number;
  terms?: PeaceTerms;
  warId?: string;
}

export interface AIMemory {
  aggression: number;
  lastRecruitHour: number;
  lastWarCheckMonth: number;
  lastActionHour: number;
  /** Región objetivo actual en guerra. */
  target: string | null;
  /** Decisiones tomadas (contador para pruebas y depuración). */
  decisions: number;
}

export type LogKind = 'info' | 'economy' | 'diplomacy' | 'military' | 'war' | 'alert';

export interface LogEntry {
  hour: number;
  kind: LogKind;
  text: string;
  /** Países implicados (para filtrar). */
  countries: CountryId[];
}

export interface GameState {
  version: number;
  player: CountryId;
  /** Horas simuladas desde el inicio (01/01/2027 00:00). */
  hour: number;
  rng: number;
  nextId: number;
  countries: Record<CountryId, CountryState>;
  regions: Record<string, RegionState>;
  units: Record<string, Unit>;
  /** relations[a][b] -100..100 (simétrica). */
  relations: Record<CountryId, Record<CountryId, number>>;
  /** Momento hasta el cual no se puede repetir una acción diplomática: key "accion:a:b". */
  cooldowns: Record<string, number>;
  trades: TradeAgreement[];
  wars: War[];
  /** Treguas tras la paz: key "a:b" ordenado → hora de expiración. */
  truces: Record<string, number>;
  battles: Record<string, Battle>;
  proposals: Proposal[];
  ai: Record<CountryId, AIMemory>;
  log: LogEntry[];
  gameOver: null | { reason: string; hour: number };
}
