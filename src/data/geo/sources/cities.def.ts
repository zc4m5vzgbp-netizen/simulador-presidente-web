/**
 * Ciudades del mapa estratégico, agrupadas por país.
 *
 * Las coordenadas NO se escriben a mano: el generador (scripts/generate-geo.ts)
 * las toma de Natural Earth 1:10m Populated Places (dominio público) buscando
 * el nombre exacto (`ne`). La provincia/estado se obtiene cruzando el punto con
 * los límites de Natural Earth Admin-1. No se guardan estadísticas de población
 * ni economía.
 *
 * kind:
 *  - capital: capital nacional (una por país).
 *  - seat:    sede de gobierno distinta de la capital (La Paz, Bolivia).
 *  - city:    ciudad principal seleccionada para el juego.
 */
import type { CountryId } from '../../regionDefs';

export type CityKind = 'capital' | 'seat' | 'city';

export interface CityDef {
  /** Identificador estable (no cambiar: puede guardarse en el futuro). */
  id: string;
  /** Nombre exacto en Natural Earth. */
  ne: string;
  /** Nombre a mostrar (si difiere). */
  name?: string;
  kind: CityKind;
  /** Nota factual breve (opcional). */
  note?: string;
}

export const CITY_DEFS: Record<CountryId, CityDef[]> = {
  ARG: [
    { id: 'ar-buenos-aires', ne: 'Buenos Aires', kind: 'capital' },
    { id: 'ar-cordoba', ne: 'Córdoba', kind: 'city' },
    { id: 'ar-rosario', ne: 'Rosario', kind: 'city' },
    { id: 'ar-mendoza', ne: 'Mendoza', kind: 'city' },
  ],
  BOL: [
    { id: 'bo-sucre', ne: 'Sucre', kind: 'capital', note: 'Capital constitucional de Bolivia.' },
    { id: 'bo-la-paz', ne: 'La Paz', kind: 'seat', note: 'Sede de gobierno de Bolivia.' },
    { id: 'bo-santa-cruz', ne: 'Santa Cruz', name: 'Santa Cruz de la Sierra', kind: 'city' },
    { id: 'bo-cochabamba', ne: 'Cochabamba', kind: 'city' },
  ],
  BRA: [
    { id: 'br-brasilia', ne: 'Brasília', kind: 'capital' },
    { id: 'br-sao-paulo', ne: 'São Paulo', kind: 'city' },
    { id: 'br-rio-de-janeiro', ne: 'Rio de Janeiro', name: 'Río de Janeiro', kind: 'city' },
    { id: 'br-salvador', ne: 'Salvador', kind: 'city' },
    { id: 'br-porto-alegre', ne: 'Porto Alegre', kind: 'city' },
    { id: 'br-belem', ne: 'Belém', kind: 'city' },
    { id: 'br-manaus', ne: 'Manaus', kind: 'city' },
  ],
  CHL: [
    { id: 'cl-santiago', ne: 'Santiago', kind: 'capital' },
    { id: 'cl-valparaiso', ne: 'Valparaíso', kind: 'city', note: 'Sede del Congreso Nacional de Chile.' },
    { id: 'cl-antofagasta', ne: 'Antofagasta', kind: 'city' },
    { id: 'cl-concepcion', ne: 'Concepción', kind: 'city' },
    { id: 'cl-punta-arenas', ne: 'Punta Arenas', kind: 'city' },
  ],
  COL: [
    { id: 'co-bogota', ne: 'Bogota', name: 'Bogotá', kind: 'capital' },
    { id: 'co-medellin', ne: 'Medellín', kind: 'city' },
    { id: 'co-cali', ne: 'Cali', kind: 'city' },
    { id: 'co-barranquilla', ne: 'Barranquilla', kind: 'city' },
    { id: 'co-cucuta', ne: 'Cúcuta', kind: 'city' },
  ],
  ECU: [
    { id: 'ec-quito', ne: 'Quito', kind: 'capital' },
    { id: 'ec-guayaquil', ne: 'Guayaquil', kind: 'city' },
    { id: 'ec-cuenca', ne: 'Cuenca', kind: 'city' },
  ],
  GUY: [
    { id: 'gy-georgetown', ne: 'Georgetown', kind: 'capital' },
    { id: 'gy-linden', ne: 'Linden', kind: 'city' },
  ],
  PRY: [
    { id: 'py-asuncion', ne: 'Asunción', kind: 'capital' },
    { id: 'py-ciudad-del-este', ne: 'Ciudad del Este', kind: 'city' },
    { id: 'py-encarnacion', ne: 'Encarnación', kind: 'city' },
  ],
  PER: [
    { id: 'pe-lima', ne: 'Lima', kind: 'capital' },
    { id: 'pe-arequipa', ne: 'Arequipa', kind: 'city' },
    { id: 'pe-trujillo', ne: 'Trujillo', kind: 'city' },
    { id: 'pe-iquitos', ne: 'Iquitos', kind: 'city' },
  ],
  SUR: [
    { id: 'sr-paramaribo', ne: 'Paramaribo', kind: 'capital' },
    { id: 'sr-nieuw-nickerie', ne: 'Nieuw Nickerie', kind: 'city' },
  ],
  URY: [
    { id: 'uy-montevideo', ne: 'Montevideo', kind: 'capital' },
    { id: 'uy-salto', ne: 'Salto', kind: 'city' },
  ],
  VEN: [
    { id: 've-caracas', ne: 'Caracas', kind: 'capital' },
    { id: 've-maracaibo', ne: 'Maracaibo', kind: 'city' },
    { id: 've-valencia', ne: 'Valencia', kind: 'city' },
    { id: 've-ciudad-guayana', ne: 'Ciudad Guayana', kind: 'city' },
  ],
};
