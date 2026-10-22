/** Datos estáticos del mapa (geometría, vecinos, distancias) — no se guardan en la partida. */
import mapData from '../data/map.generated.json';
import { REGION_DEFS, COUNTRY_IDS, type RegionDef } from '../data/regionDefs';
import { COUNTRY_DEFS } from '../data/countries';
import type { CountryId } from './types';

export interface MapRegion {
  id: string;
  country: CountryId;
  name: string;
  path: string;
  anchor: [number, number];
  neighbors: string[];
  capital: boolean;
  def: RegionDef;
}

export const MAP = {
  width: mapData.width as number,
  height: mapData.height as number,
  countries: mapData.countries as Record<CountryId, string>,
  neutral: mapData.neutral as { name: string; path: string }[],
};

export const REGIONS: Record<string, MapRegion> = {};
for (const r of mapData.regions) {
  const def = REGION_DEFS.find((d) => d.id === r.id)!;
  REGIONS[r.id] = {
    id: r.id,
    country: r.country as CountryId,
    name: def.name,
    path: r.path,
    anchor: r.anchor as [number, number],
    neighbors: r.neighbors,
    capital: !!def.capital,
    def,
  };
}
export const REGION_IDS = Object.keys(REGIONS);

export function capitalOf(c: CountryId): string {
  return REGION_DEFS.find((d) => d.country === c && d.capital)!.id;
}

export function distance(a: string, b: string): number {
  const p = REGIONS[a].anchor, q = REGIONS[b].anchor;
  return Math.hypot(p[0] - q[0], p[1] - q[1]);
}

export function countryName(c: CountryId): string {
  return COUNTRY_DEFS[c].name;
}

/** Países con frontera terrestre. */
export function neighborCountries(c: CountryId): CountryId[] {
  const set = new Set<CountryId>();
  for (const r of Object.values(REGIONS)) {
    if (r.country !== c) continue;
    for (const n of r.neighbors) if (REGIONS[n].country !== c) set.add(REGIONS[n].country);
  }
  return [...set];
}

export { COUNTRY_IDS };
