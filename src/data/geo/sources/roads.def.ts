/**
 * Corredores viales principales, agrupados por país (los internacionales,
 * en el primer país del par).
 *
 * No se dibujan líneas rectas: el generador busca el camino más corto por la
 * red de carreteras de Natural Earth 1:10m Roads (dominio público) entre las
 * dos ciudades y usa ese trazado real. Si no existe un camino continuo, o si
 * el trazado resulta implausible (más de 2 veces la distancia en línea recta),
 * el corredor se descarta y se informa.
 *
 * Los nombres son descriptivos ("Corredor A – B"); no se asignan nombres de
 * ruta oficiales que la fuente no incluye. Todavía no hay transporte ni
 * logística asociados.
 */
import type { CountryId } from '../../regionDefs';

export interface RoadDef {
  id: string;
  /** Ciudades de origen y destino: nombres exactos en Natural Earth Populated Places. */
  from: string;
  to: string;
  /** Países que atraviesa (al menos el de origen). */
  countries: CountryId[];
}

export const ROAD_DEFS: Partial<Record<CountryId, RoadDef[]>> = {
  ARG: [
    { id: 'r-buenos-aires-cordoba', from: 'Buenos Aires', to: 'Córdoba', countries: ['ARG'] },
    { id: 'r-cordoba-mendoza', from: 'Córdoba', to: 'Mendoza', countries: ['ARG'] },
    { id: 'r-mendoza-santiago', from: 'Mendoza', to: 'Santiago', countries: ['ARG', 'CHL'] },
  ],
  BOL: [
    { id: 'r-la-paz-santa-cruz', from: 'La Paz', to: 'Santa Cruz', countries: ['BOL'] },
  ],
  BRA: [
    { id: 'r-sao-paulo-rio', from: 'São Paulo', to: 'Rio de Janeiro', countries: ['BRA'] },
    { id: 'r-brasilia-sao-paulo', from: 'Brasília', to: 'São Paulo', countries: ['BRA'] },
    { id: 'r-sao-paulo-porto-alegre', from: 'São Paulo', to: 'Porto Alegre', countries: ['BRA'] },
    { id: 'r-porto-alegre-montevideo', from: 'Porto Alegre', to: 'Montevideo', countries: ['BRA', 'URY'] },
    { id: 'r-manaus-boa-vista', from: 'Manaus', to: 'Boa Vista', countries: ['BRA'] },
  ],
  CHL: [
    { id: 'r-santiago-concepcion', from: 'Santiago', to: 'Concepción', countries: ['CHL'] },
    { id: 'r-santiago-valparaiso', from: 'Santiago', to: 'Valparaíso', countries: ['CHL'] },
  ],
  COL: [
    { id: 'r-bogota-medellin', from: 'Bogota', to: 'Medellín', countries: ['COL'] },
    { id: 'r-bogota-cali', from: 'Bogota', to: 'Cali', countries: ['COL'] },
    { id: 'r-medellin-barranquilla', from: 'Medellín', to: 'Barranquilla', countries: ['COL'] },
    { id: 'r-bogota-cucuta', from: 'Bogota', to: 'Cúcuta', countries: ['COL'] },
  ],
  ECU: [
    { id: 'r-quito-guayaquil', from: 'Quito', to: 'Guayaquil', countries: ['ECU'] },
  ],
  PER: [
    { id: 'r-lima-trujillo', from: 'Lima', to: 'Trujillo', countries: ['PER'] },
    { id: 'r-lima-arequipa', from: 'Lima', to: 'Arequipa', countries: ['PER'] },
  ],
  PRY: [
    { id: 'r-asuncion-ciudad-del-este', from: 'Asunción', to: 'Ciudad del Este', countries: ['PRY'] },
  ],
  VEN: [
    { id: 'r-caracas-maracaibo', from: 'Caracas', to: 'Maracaibo', countries: ['VEN'] },
    { id: 'r-caracas-ciudad-guayana', from: 'Caracas', to: 'Ciudad Guayana', countries: ['VEN'] },
  ],
};
