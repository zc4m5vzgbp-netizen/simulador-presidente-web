/**
 * Pasos fronterizos reales y documentados, agrupados por el primer país de
 * cada par. Todas las coordenadas proceden de la fuente indicada en `source`
 * (consultada el 22-10-2026). El generador comprueba automáticamente que cada
 * punto esté a menos de 15 km de la frontera entre los dos países según
 * Natural Earth; si no, la compilación de datos falla.
 *
 * type:
 *  - terrestre: paso por carretera (incluye puentes y pasos de montaña).
 *  - fluvial:   conexión por barco/transbordador entre dos terminales.
 *
 * precision:
 *  - estructura: coordenadas del puente, túnel o complejo fronterizo.
 *  - localidad:  la fuente solo da las coordenadas de la localidad fronteriza
 *                donde se cruza (ciudades gemelas o pueblo junto al puente).
 *
 * Estos pasos son informativos: todavía NO afectan al movimiento militar.
 */
import type { CountryId } from '../../regionDefs';

export type CrossingType = 'terrestre' | 'fluvial';

export interface CrossingDef {
  id: string;
  name: string;
  type: CrossingType;
  countries: [CountryId, CountryId];
  /** Localidad de cada lado, en el mismo orden que `countries`. */
  places: [string, string];
  /** [longitud, latitud] del cruce (terrestre). */
  coord?: [number, number];
  /** Terminales [lon, lat] de cada lado (fluvial), en el orden de `countries`. */
  terminals?: [[number, number], [number, number]];
  precision: 'estructura' | 'localidad';
  /** Detalle factual (río, ruta, estructura). */
  detail?: string;
  source: string[];
}

export const CROSSING_DEFS: Partial<Record<CountryId, CrossingDef[]>> = {
  ARG: [
    {
      id: 'x-los-libertadores', name: 'Paso Internacional Los Libertadores', type: 'terrestre',
      countries: ['ARG', 'CHL'], places: ['Mendoza (Las Cuevas)', 'Valparaíso (Los Andes)'],
      coord: [-70.0921, -32.8272], precision: 'estructura',
      detail: 'Túnel Cristo Redentor; une la Ruta Nacional 7 (Argentina) y la Ruta 60 (Chile).',
      source: ['https://latitude.to/articles-by-country/cl/chile/49934/paso-internacional-los-libertadores', 'https://en.wikipedia.org/wiki/Paso_Internacional_Los_Libertadores'],
    },
    {
      id: 'x-la-quiaca-villazon', name: 'Puente Internacional Horacio Guzmán', type: 'terrestre',
      countries: ['ARG', 'BOL'], places: ['La Quiaca', 'Villazón'],
      coord: [-65.6, -22.1], precision: 'estructura',
      detail: 'Cruza el río La Quiaca. La fuente da coordenadas con precisión de minutos.',
      source: ['https://en.wikipedia.org/wiki/Horacio_Guzm%C3%A1n_International_Bridge'],
    },
    {
      id: 'x-posadas-encarnacion', name: 'Puente San Roque González de Santa Cruz', type: 'terrestre',
      countries: ['ARG', 'PRY'], places: ['Posadas', 'Encarnación'],
      coord: [-55.871916, -27.373139], precision: 'estructura', detail: 'Cruza el río Paraná.',
      source: ['https://en.wikipedia.org/wiki/San_Roque_Gonz%C3%A1lez_de_Santa_Cruz_Bridge'],
    },
    {
      id: 'x-iguazu-foz', name: 'Puente Tancredo Neves', type: 'terrestre',
      countries: ['ARG', 'BRA'], places: ['Puerto Iguazú', 'Foz do Iguaçu'],
      coord: [-54.56157, -25.588933], precision: 'estructura', detail: 'Cruza el río Iguazú.',
      source: ['https://en.wikipedia.org/wiki/Tancredo_Neves_Bridge'],
    },
    {
      id: 'x-libres-uruguaiana', name: 'Puente Internacional Paso de los Libres–Uruguaiana', type: 'terrestre',
      countries: ['ARG', 'BRA'], places: ['Paso de los Libres', 'Uruguaiana'],
      coord: [-57.0931, -29.7431], precision: 'estructura', detail: 'Cruza el río Uruguay.',
      source: ['https://en.wikipedia.org/wiki/Paso_de_los_Libres%E2%80%93Uruguaiana_International_Bridge'],
    },
    {
      id: 'x-gualeguaychu-fray-bentos', name: 'Puente Libertador General San Martín', type: 'terrestre',
      countries: ['ARG', 'URY'], places: ['Gualeguaychú (Puerto Unzué)', 'Fray Bentos'],
      coord: [-58.248694, -33.100556], precision: 'estructura', detail: 'Cruza el río Uruguay.',
      source: ['https://en.wikipedia.org/wiki/Libertador_General_San_Mart%C3%ADn_Bridge'],
    },
    {
      id: 'x-buenos-aires-colonia', name: 'Transbordador Buenos Aires–Colonia', type: 'fluvial',
      countries: ['ARG', 'URY'], places: ['Buenos Aires', 'Colonia del Sacramento'],
      terminals: [[-58.399477, -34.600556], [-57.84417, -34.47139]], precision: 'localidad',
      detail: 'Servicio de transbordadores a través del Río de la Plata (p. ej., Buquebus).',
      source: ['https://en.wikipedia.org/wiki/Buquebus', 'https://en.wikipedia.org/wiki/Colonia_del_Sacramento', 'Natural Earth Populated Places (Buenos Aires)'],
    },
  ],
  BOL: [
    {
      id: 'x-desaguadero', name: 'Desaguadero (puente binacional)', type: 'terrestre',
      countries: ['BOL', 'PER'], places: ['Desaguadero (Bolivia)', 'Desaguadero (Perú)'],
      coord: [-69.0, -16.567], precision: 'localidad', detail: 'Las dos partes de la localidad están unidas por un puente binacional.',
      source: ['https://en.wikipedia.org/wiki/Desaguadero,_Bolivia-Peru'],
    },
    {
      id: 'x-quijarro-corumba', name: 'Puerto Quijarro–Corumbá', type: 'terrestre',
      countries: ['BOL', 'BRA'], places: ['Puerto Quijarro', 'Corumbá'],
      coord: [-57.713757, -19.003873], precision: 'localidad',
      source: ['https://en.wikipedia.org/wiki/Puerto_Quijarro'],
    },
  ],
  BRA: [
    {
      id: 'x-foz-ciudad-del-este', name: 'Puente de la Amistad', type: 'terrestre',
      countries: ['BRA', 'PRY'], places: ['Foz do Iguaçu', 'Ciudad del Este'],
      coord: [-54.601111, -25.509583], precision: 'estructura', detail: 'Cruza el río Paraná.',
      source: ['https://en.wikipedia.org/wiki/Friendship_Bridge_(Brazil%E2%80%93Paraguay)'],
    },
    {
      id: 'x-bonfim-lethem', name: 'Puente del río Tacutu', type: 'terrestre',
      countries: ['BRA', 'GUY'], places: ['Bonfim', 'Lethem'],
      coord: [-59.81438, 3.38011], precision: 'estructura', detail: 'Cruza el río Tacutu.',
      source: ['https://en.wikipedia.org/wiki/Takutu_River_Bridge'],
    },
    {
      id: 'x-assis-inapari', name: 'Puente de la Integración Brasil–Perú', type: 'terrestre',
      countries: ['BRA', 'PER'], places: ['Assis Brasil', 'Iñapari'],
      coord: [-69.57694, -10.94139], precision: 'estructura', detail: 'Cruza el río Acre.',
      source: ['https://en.wikipedia.org/wiki/Brazil%E2%80%93Peru_Integration_Bridge'],
    },
    {
      id: 'x-pacaraima-santa-elena', name: 'Pacaraima–Santa Elena de Uairén', type: 'terrestre',
      countries: ['BRA', 'VEN'], places: ['Pacaraima', 'Santa Elena de Uairén'],
      coord: [-61.14611, 4.43111], precision: 'localidad',
      detail: 'Único paso por carretera en la frontera: une la BR-174 (Brasil) y la Troncal 10 (Venezuela).',
      source: ['https://en.wikipedia.org/wiki/Pacaraima', 'https://en.wikipedia.org/wiki/Brazil%E2%80%93Venezuela_border'],
    },
    {
      id: 'x-tabatinga-leticia', name: 'Tabatinga–Leticia', type: 'terrestre',
      countries: ['BRA', 'COL'], places: ['Tabatinga', 'Leticia'],
      coord: [-69.93278, -4.20528], precision: 'localidad', detail: 'Ciudades contiguas en la frontera.',
      source: ['https://en.wikipedia.org/wiki/Leticia,_Amazonas'],
    },
  ],
  CHL: [
    {
      id: 'x-chungara-tambo-quemado', name: 'Paso Chungará–Tambo Quemado', type: 'terrestre',
      countries: ['CHL', 'BOL'], places: ['Chungará (Arica)', 'Tambo Quemado'],
      coord: [-69.07139, -18.28472], precision: 'estructura', detail: 'Paso de alta montaña entre Arica y La Paz.',
      source: ['https://en.wikipedia.org/wiki/Chungara%E2%80%93Tambo_Quemado'],
    },
    {
      id: 'x-chacalluta-santa-rosa', name: 'Chacalluta–Santa Rosa', type: 'terrestre',
      countries: ['CHL', 'PER'], places: ['Arica', 'Tacna'],
      coord: [-70.314313, -18.307521], precision: 'estructura',
      source: ['https://d10.dlca.logcluster.org/node/3067'],
    },
  ],
  COL: [
    {
      id: 'x-simon-bolivar', name: 'Puente Internacional Simón Bolívar', type: 'terrestre',
      countries: ['COL', 'VEN'], places: ['La Parada (Villa del Rosario)', 'San Antonio del Táchira'],
      coord: [-72.4508, 7.8179], precision: 'estructura', detail: 'Cruza el río Táchira.',
      source: ['https://en.wikipedia.org/wiki/Sim%C3%B3n_Bol%C3%ADvar_International_Bridge'],
    },
    {
      id: 'x-rumichaca', name: 'Puente Internacional de Rumichaca', type: 'terrestre',
      countries: ['COL', 'ECU'], places: ['Ipiales', 'Tulcán'],
      coord: [-77.6649, 0.8153], precision: 'estructura',
      source: ['https://d10.dlca.logcluster.org/node/506'],
    },
  ],
  ECU: [
    {
      id: 'x-huaquillas-aguas-verdes', name: 'Puente Internacional Zarumilla', type: 'terrestre',
      countries: ['ECU', 'PER'], places: ['Huaquillas', 'Aguas Verdes'],
      coord: [-80.21829, -3.47504], precision: 'localidad', detail: 'Cruza el río Zarumilla.',
      source: ['https://en.wikipedia.org/wiki/Huaquillas'],
    },
  ],
  GUY: [
    {
      id: 'x-canawaima', name: 'Transbordador Canawaima', type: 'fluvial',
      countries: ['GUY', 'SUR'], places: ['Moleson Creek', 'South Drain'],
      terminals: [[-57.17083, 5.78694], [-57.135, 5.74917]], precision: 'localidad',
      detail: 'Cruza el río Corantijn (Corentyne). Única conexión legal entre ambos países.',
      source: ['https://en.wikipedia.org/wiki/Moleson_Creek', 'https://en.wikipedia.org/wiki/South_Drain,_Suriname'],
    },
  ],
  URY: [
    {
      id: 'x-chuy-chui', name: 'Chuy–Chuí', type: 'terrestre',
      countries: ['URY', 'BRA'], places: ['Chuy', 'Chuí'],
      coord: [-53.46, -33.69639], precision: 'localidad', detail: 'Ciudades gemelas; une la Ruta 9 (Uruguay) y la BR-471 (Brasil).',
      source: ['https://en.wikipedia.org/wiki/Chuy', 'https://en.wikipedia.org/wiki/Brazil%E2%80%93Uruguay_border'],
    },
    {
      id: 'x-rivera-livramento', name: 'Rivera–Santana do Livramento', type: 'terrestre',
      countries: ['URY', 'BRA'], places: ['Rivera', 'Santana do Livramento'],
      coord: [-55.55056, -30.9025], precision: 'localidad', detail: 'Ciudades gemelas con frontera abierta.',
      source: ['https://en.wikipedia.org/wiki/Rivera', 'https://en.wikipedia.org/wiki/Brazil%E2%80%93Uruguay_border'],
    },
  ],
};

/**
 * Fuentes revisadas y descartadas (documentado para no reintroducirlas):
 * - Guayaramerín–Guajará-Mirim: la fuente consultada no documenta el cruce fluvial.
 * - Leticia–Tabatinga según dlca.logcluster.org/node/1696: latitud con signo
 *   erróneo (4,11° N); se usa la de Wikipedia (Leticia).
 * - Guyana–Venezuela: no hay paso fronterizo oficial por carretera.
 */
