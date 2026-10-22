/**
 * Atlas de mando (ATLAS-001): acceso tipado a la cartografía generada por
 * scripts/generate-atlas.ts (Natural Earth, dominio público).
 *
 * Capa de DATOS: no depende de React ni del motor, y el motor no depende de
 * ella. Nada aquí es una estadística del juego: son hechos geográficos.
 */
import data from '../data/atlas/atlas.generated.json';
import type { CountryId } from '../engine/types';

type Pt = [number, number];

/** Estado, departamento o provincia (división administrativa de primer nivel). */
export interface AdminState {
  id: string;
  name: string;
  /** Denominación en la fuente: Estado, Departamento, Provincia, Región… */
  type: string | null;
  country: CountryId;
  /** Trazado en coordenadas del mapa (codificación relativa). */
  path: string;
  /** Punto interior para el rótulo. */
  label: Pt;
  /** Superficie aproximada en unidades de mapa² (solo para ordenar rótulos). */
  area: number;
  /** Capital según Natural Earth; null si la fuente no la identifica con seguridad. */
  capital: string | null;
  /** Región del juego que ocupa la mayor parte del estado. */
  region: string | null;
  /** Todas las regiones del juego que toca, de mayor a menor presencia. */
  regions: string[];
}

export type FacilityKind = 'airport' | 'port';

/** Instalación cartográfica. Hoy: aeropuertos y puertos; preparada para bases y otras. */
export interface Facility {
  id: string;
  kind: FacilityKind;
  /** Nombre tal como figura en la fuente. */
  name: string;
  iata: string | null;
  /** Tipo según Natural Earth (major, mid, military…). */
  neType: string | null;
  /** Rango de Natural Earth (menor = más destacado). */
  rank: number;
  country: CountryId;
  state: string | null;
  region: string | null;
  lonlat: Pt;
  xy: Pt;
  wikidata: string | null;
  source: string;
}

export interface WaterFeature { name: string | null; rank: number; path: string }

interface AtlasFile {
  generatedFrom: { naturalEarth: string; notes: string[]; excludedStates: string[] };
  states: AdminState[];
  roads: { motorway: string; trunk: string; secondary: string };
  rivers: WaterFeature[];
  lakes: WaterFeature[];
  airports: Facility[];
  ports: Facility[];
}

const atlas = data as unknown as AtlasFile;

export const ATLAS_SOURCE = atlas.generatedFrom;
export const STATES: AdminState[] = atlas.states;
export const ROAD_TIERS = atlas.roads;
export const RIVERS = atlas.rivers;
export const LAKES = atlas.lakes;
export const AIRPORTS: Facility[] = atlas.airports;
export const PORTS: Facility[] = atlas.ports;
export const FACILITIES: Facility[] = [...AIRPORTS, ...PORTS];

const stateIndex = new Map(STATES.map((s) => [s.id, s]));
const facilityIndex = new Map(FACILITIES.map((f) => [f.id, f]));
export const stateById = (id: string) => stateIndex.get(id);
export const facilityById = (id: string) => facilityIndex.get(id);
export const statesOf = (c: CountryId) => STATES.filter((s) => s.country === c);
export const facilitiesInState = (stateId: string) => FACILITIES.filter((f) => f.state === stateId);

/** Nombre legible de una instalación: sin abreviaturas de la fuente ("Int'l"). */
export function facilityName(f: Facility): string {
  return f.name.replace(/\s*Int'?l\.?$/i, ' (internacional)').replace(/\s+Int\s*$/i, ' (internacional)').replace(/^Zim\s+/, '');
}

export const FACILITY_KIND_LABEL: Record<FacilityKind, string> = { airport: 'Aeropuerto', port: 'Puerto marítimo' };

/** Descripción del tipo según Natural Earth, en español. */
export function facilityTypeLabel(f: Facility): string {
  if (f.kind === 'port') return 'Puerto (Natural Earth)';
  const t = f.neType ?? '';
  if (/military/.test(t) && /mid|major/.test(t)) return 'Civil y militar';
  if (/military/.test(t)) return 'Militar';
  if (t === 'major') return 'Principal';
  if (t === 'mid') return 'Mediano';
  return 'Otro';
}
