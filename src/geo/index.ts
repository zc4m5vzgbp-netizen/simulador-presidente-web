/**
 * Cartografía estratégica (MAP-001): acceso tipado a los datos generados.
 *
 * Capa de DATOS: no depende de React ni del motor del juego, y el motor no
 * depende de ella (mover tropas no usa todavía pasos ni carreteras).
 * Organizado por tipo de elemento y país; las ampliaciones previstas
 * (provincias, puertos, aeropuertos) se añadirán como nuevos tipos aquí.
 */
import data from '../data/geo/geo.generated.json';
import type { CountryId } from '../engine/types';

type Pt = [number, number];

export type CityKind = 'capital' | 'seat' | 'city';

export interface City {
  id: string;
  name: string;
  country: CountryId;
  kind: CityKind;
  note: string | null;
  lonlat: Pt;
  xy: Pt;
  province: string | null;
  provinceType: string | null;
  region: string | null;
  /** Rango de Natural Earth (0 = más destacada). Se usa solo para el orden de visualización. */
  rank: number;
  source: string;
}

export type CrossingType = 'terrestre' | 'fluvial';

export interface Crossing {
  id: string;
  name: string;
  type: CrossingType;
  countries: [CountryId, CountryId];
  places: [string, string];
  precision: 'estructura' | 'localidad';
  detail: string | null;
  source: string[];
  lonlat: Pt;
  xy: Pt;
  terminals?: [Pt, Pt];
  terminalsXY?: [Pt, Pt];
  regions: [string | null, string | null];
  lengthKm?: number;
  check?: { kmToBorderA: number; kmToBorderB: number };
}

export interface Road {
  id: string;
  name: string;
  countries: CountryId[];
  from: string;
  to: string;
  lengthKm: number;
  straightKm: number;
  path: string;
  source: string;
}

interface GeoFile {
  cities: Record<string, City[]>;
  crossings: Record<string, Crossing[]>;
  roads: Record<string, Road[]>;
  roadNetwork?: string;
}

const geo = data as unknown as GeoFile;

/** Datos agrupados por país y tipo, tal como se generan. */
export const GEO_BY_COUNTRY = geo;

export const CITIES: City[] = Object.values(geo.cities).flat();
export const CROSSINGS: Crossing[] = Object.values(geo.crossings).flat();
export const ROADS: Road[] = Object.values(geo.roads).flat();
/** Red cartográfica completa; generada desde Natural Earth. */
export const ROAD_NETWORK = geo.roadNetwork ?? '';

const cityIndex = new Map(CITIES.map((c) => [c.id, c]));
const crossingIndex = new Map(CROSSINGS.map((c) => [c.id, c]));

export const cityById = (id: string) => cityIndex.get(id);
export const crossingById = (id: string) => crossingIndex.get(id);

export function citiesOf(c: CountryId): City[] {
  return geo.cities[c] ?? [];
}

export function crossingsOf(c: CountryId): Crossing[] {
  return CROSSINGS.filter((x) => x.countries.includes(c));
}

export function roadsOf(c: CountryId): Road[] {
  return ROADS.filter((r) => r.countries.includes(c));
}

export const CITY_KIND_LABEL: Record<CityKind, string> = {
  capital: 'Capital nacional',
  seat: 'Sede de gobierno',
  city: 'Ciudad principal',
};

/** Coordenadas legibles: 34,60° S · 58,40° O */
export function formatLonLat([lon, lat]: Pt): string {
  const f = (v: number) => Math.abs(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${f(lat)}° ${lat < 0 ? 'S' : 'N'} · ${f(lon)}° ${lon < 0 ? 'O' : 'E'}`;
}
