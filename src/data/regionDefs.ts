/**
 * Definición de regiones estratégicas.
 *
 * Cada país se divide en pocas regiones. La geometría se calcula a partir de
 * las fronteras reales (Natural Earth) recortadas con celdas de Voronoi
 * alrededor de cada `seed` (lon, lat). Para añadir provincias en el futuro
 * basta con añadir entradas aquí (opcionalmente con `parentId`) y volver a
 * ejecutar `npm run gen:map`; el motor no asume un número fijo de regiones.
 *
 * gdpShare / popShare: fracción ESTIMADA del PIB y la población del país.
 * Son valores simplificados para el juego, no estadísticas oficiales.
 */
export interface RegionDef {
  id: string;
  country: CountryId;
  name: string;
  seed: [number, number];
  gdpShare: number;
  popShare: number;
  capital?: boolean;
  parentId?: string;
}

export type CountryId =
  | 'ARG' | 'BOL' | 'BRA' | 'CHL' | 'COL' | 'ECU'
  | 'GUY' | 'PRY' | 'PER' | 'SUR' | 'URY' | 'VEN';

export const COUNTRY_IDS: CountryId[] = [
  'ARG', 'BOL', 'BRA', 'CHL', 'COL', 'ECU', 'GUY', 'PRY', 'PER', 'SUR', 'URY', 'VEN',
];

export const REGION_DEFS: RegionDef[] = [
  // Argentina
  { id: 'AR_BA', country: 'ARG', name: 'Buenos Aires y Pampa', seed: [-60.5, -36], gdpShare: 0.55, popShare: 0.5, capital: true },
  { id: 'AR_NO', country: 'ARG', name: 'Noroeste y Cuyo', seed: [-66.5, -28], gdpShare: 0.17, popShare: 0.22 },
  { id: 'AR_NE', country: 'ARG', name: 'Litoral y Noreste', seed: [-59, -28.5], gdpShare: 0.15, popShare: 0.18 },
  { id: 'AR_PA', country: 'ARG', name: 'Patagonia', seed: [-68, -44], gdpShare: 0.13, popShare: 0.1 },
  // Bolivia
  { id: 'BO_AL', country: 'BOL', name: 'Altiplano', seed: [-67.8, -17.5], gdpShare: 0.45, popShare: 0.5, capital: true },
  { id: 'BO_OR', country: 'BOL', name: 'Oriente', seed: [-62.5, -16], gdpShare: 0.55, popShare: 0.5 },
  // Brasil
  { id: 'BR_CO', country: 'BRA', name: 'Centro-Oeste', seed: [-52, -14], gdpShare: 0.1, popShare: 0.08, capital: true },
  { id: 'BR_SE', country: 'BRA', name: 'Sudeste', seed: [-45.5, -20.5], gdpShare: 0.53, popShare: 0.42 },
  { id: 'BR_SU', country: 'BRA', name: 'Sur', seed: [-52, -27], gdpShare: 0.17, popShare: 0.15 },
  { id: 'BR_NE', country: 'BRA', name: 'Nordeste', seed: [-40, -8], gdpShare: 0.14, popShare: 0.27 },
  { id: 'BR_NO', country: 'BRA', name: 'Norte (Amazonía)', seed: [-60, -4], gdpShare: 0.06, popShare: 0.08 },
  // Chile
  { id: 'CL_NO', country: 'CHL', name: 'Norte Grande', seed: [-69.5, -22.5], gdpShare: 0.2, popShare: 0.1 },
  { id: 'CL_CE', country: 'CHL', name: 'Zona Central', seed: [-71, -34], gdpShare: 0.7, popShare: 0.75, capital: true },
  { id: 'CL_SU', country: 'CHL', name: 'Sur y Austral', seed: [-72.5, -45], gdpShare: 0.1, popShare: 0.15 },
  // Colombia
  { id: 'CO_AN', country: 'COL', name: 'Región Andina', seed: [-74.5, 5], gdpShare: 0.65, popShare: 0.6, capital: true },
  { id: 'CO_CA', country: 'COL', name: 'Caribe', seed: [-74.8, 9.5], gdpShare: 0.2, popShare: 0.22 },
  { id: 'CO_OR', country: 'COL', name: 'Orinoquía y Amazonía', seed: [-71, 2], gdpShare: 0.15, popShare: 0.18 },
  // Ecuador
  { id: 'EC_CO', country: 'ECU', name: 'Costa', seed: [-80.1, -1.5], gdpShare: 0.55, popShare: 0.5 },
  { id: 'EC_SI', country: 'ECU', name: 'Sierra y Oriente', seed: [-77.5, -1], gdpShare: 0.45, popShare: 0.5, capital: true },
  // Guyana
  { id: 'GY', country: 'GUY', name: 'Guyana', seed: [-58.8, 5.5], gdpShare: 1, popShare: 1, capital: true },
  // Paraguay
  { id: 'PY_OR', country: 'PRY', name: 'Región Oriental', seed: [-56, -25.8], gdpShare: 0.85, popShare: 0.97, capital: true },
  { id: 'PY_CH', country: 'PRY', name: 'Chaco', seed: [-60.5, -22], gdpShare: 0.15, popShare: 0.03 },
  // Perú
  { id: 'PE_NO', country: 'PER', name: 'Norte y Amazonía', seed: [-77.5, -5.5], gdpShare: 0.25, popShare: 0.3 },
  { id: 'PE_CE', country: 'PER', name: 'Lima y Centro', seed: [-76.3, -11.5], gdpShare: 0.55, popShare: 0.5, capital: true },
  { id: 'PE_SU', country: 'PER', name: 'Sur', seed: [-71.5, -15.5], gdpShare: 0.2, popShare: 0.2 },
  // Surinam
  { id: 'SR', country: 'SUR', name: 'Surinam', seed: [-55.8, 4.3], gdpShare: 1, popShare: 1, capital: true },
  // Uruguay
  { id: 'UY', country: 'URY', name: 'Uruguay', seed: [-56, -33], gdpShare: 1, popShare: 1, capital: true },
  // Venezuela
  { id: 'VE_CA', country: 'VEN', name: 'Capital y Centro', seed: [-66.8, 9.6], gdpShare: 0.5, popShare: 0.5, capital: true },
  { id: 'VE_OC', country: 'VEN', name: 'Occidente y Zulia', seed: [-71.5, 9], gdpShare: 0.25, popShare: 0.3 },
  { id: 'VE_GU', country: 'VEN', name: 'Guayana y Llanos', seed: [-64, 6], gdpShare: 0.25, popShare: 0.2 },
];
