/**
 * Pruebas de la cartografía estratégica (MAP-001): datos geográficos, capas y
 * separación respecto al motor del juego.
 * Ejecutar: npm test
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CITIES, CROSSINGS, ROADS, GEO_BY_COUNTRY, citiesOf, crossingsOf, formatLonLat } from '../src/geo';
import { COUNTRY_IDS } from '../src/data/regionDefs';
import { REGIONS, MAP } from '../src/engine/world';
import { MAP_LAYERS, defaultVisibility } from '../src/ui/map/layers';

const inSouthAmerica = ([lon, lat]: [number, number]) => lon > -82 && lon < -34 && lat > -56 && lat < 13;
const pathVertices = (d: string) => d.split(/[ML]/).filter(Boolean).length;

describe('Ciudades', () => {
  test('una capital nacional por país (12) y La Paz como sede de gobierno de Bolivia', () => {
    for (const c of COUNTRY_IDS) {
      const caps = citiesOf(c).filter((x) => x.kind === 'capital');
      assert.equal(caps.length, 1, `capital de ${c}`);
    }
    assert.equal(CITIES.filter((x) => x.kind === 'capital').length, 12);
    assert.equal(CITIES.find((x) => x.kind === 'capital' && x.country === 'BOL')?.name, 'Sucre');
    const seat = CITIES.filter((x) => x.kind === 'seat');
    assert.deepEqual(seat.map((x) => x.name), ['La Paz']);
  });

  test('capitales esperadas', () => {
    const caps = Object.fromEntries(CITIES.filter((x) => x.kind === 'capital').map((x) => [x.country, x.name]));
    assert.deepEqual(caps, {
      ARG: 'Buenos Aires', BOL: 'Sucre', BRA: 'Brasília', CHL: 'Santiago', COL: 'Bogotá', ECU: 'Quito',
      GUY: 'Georgetown', PRY: 'Asunción', PER: 'Lima', SUR: 'Paramaribo', URY: 'Montevideo', VEN: 'Caracas',
    });
  });

  test('número limitado de ciudades estratégicas (≤ 7 por país)', () => {
    for (const c of COUNTRY_IDS) assert.ok(citiesOf(c).length >= 1 && citiesOf(c).length <= 7, c);
  });

  test('coordenadas, provincia y región del juego coherentes con el país', () => {
    for (const c of CITIES) {
      assert.ok(inSouthAmerica(c.lonlat), `${c.id} fuera de Sudamérica`);
      assert.ok(c.xy[0] > 0 && c.xy[0] < MAP.width && c.xy[1] > 0 && c.xy[1] < MAP.height, `${c.id} fuera del mapa`);
      assert.ok(c.province, `${c.id} sin provincia`);
      assert.ok(c.region && REGIONS[c.region], `${c.id} sin región válida`);
      assert.equal(REGIONS[c.region!].country, c.country, `${c.id} en región de otro país`);
      assert.match(c.source, /Natural Earth/);
    }
  });

  test('sin estadísticas inventadas: solo atributos geográficos', () => {
    const allowed = new Set(['id', 'name', 'country', 'kind', 'note', 'lonlat', 'xy', 'province', 'provinceType', 'region', 'rank', 'source']);
    for (const c of CITIES) for (const key of Object.keys(c)) assert.ok(allowed.has(key), `${c.id}: campo no permitido ${key}`);
  });
});

describe('Pasos fronterizos', () => {
  test('datos completos y con fuentes', () => {
    assert.ok(CROSSINGS.length >= 15);
    for (const x of CROSSINGS) {
      assert.equal(x.countries.length, 2);
      assert.notEqual(x.countries[0], x.countries[1]);
      for (const c of x.countries) assert.ok(COUNTRY_IDS.includes(c), `${x.id}: país ${c}`);
      assert.ok(x.places.every(Boolean), `${x.id}: localidades`);
      assert.ok(x.source.some((s) => /^https:\/\//.test(s)), `${x.id}: sin fuente enlazable`);
      assert.ok(inSouthAmerica(x.lonlat), `${x.id}: coordenadas`);
      assert.ok(['estructura', 'localidad'].includes(x.precision));
    }
  });

  test('los terrestres están junto a la frontera de ambos países (≤ 15 km)', () => {
    for (const x of CROSSINGS.filter((c) => c.type === 'terrestre')) {
      assert.ok(x.check, `${x.id}: sin verificación`);
      assert.ok(x.check!.kmToBorderA <= 15 && x.check!.kmToBorderB <= 15, `${x.id}: ${JSON.stringify(x.check)}`);
    }
  });

  test('terrestres y fluviales se distinguen; los fluviales tienen dos terminales', () => {
    const fl = CROSSINGS.filter((c) => c.type === 'fluvial');
    const land = CROSSINGS.filter((c) => c.type === 'terrestre');
    assert.ok(fl.length >= 1 && land.length >= 1);
    for (const x of fl) {
      assert.equal(x.terminals?.length, 2, x.id);
      assert.equal(x.terminalsXY?.length, 2, x.id);
      assert.ok((x.lengthKm ?? 0) > 0, x.id);
    }
    for (const x of land) assert.equal(x.terminals, undefined, x.id);
  });

  test('cada paso se asocia a regiones de los dos países', () => {
    for (const x of CROSSINGS) {
      x.regions.forEach((r, i) => {
        assert.ok(r && REGIONS[r], `${x.id}: región ${i}`);
        assert.equal(REGIONS[r!].country, x.countries[i], `${x.id}: región ${r}`);
      });
    }
  });

  test('cada país con vecinos de la lista tiene al menos un paso', () => {
    for (const c of COUNTRY_IDS) assert.ok(crossingsOf(c).length >= 1, c);
  });
});

describe('Carreteras principales', () => {
  test('trazados reales: varios vértices y recorrido plausible', () => {
    assert.ok(ROADS.length >= 10);
    for (const r of ROADS) {
      assert.match(r.path, /^M[\d.]+,[\d.]+L/, r.id);
      assert.ok(pathVertices(r.path) >= 4, `${r.id}: trazado recto`);
      assert.ok(r.lengthKm >= r.straightKm && r.lengthKm <= r.straightKm * 2, `${r.id}: ${r.lengthKm}/${r.straightKm}`);
      for (const c of r.countries) assert.ok(COUNTRY_IDS.includes(c));
      assert.match(r.source, /Natural Earth/);
    }
  });
});

describe('Organización y separación del motor', () => {
  test('identificadores únicos en todos los elementos', () => {
    const ids = [...CITIES, ...CROSSINGS, ...ROADS].map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test('datos agrupados por tipo y por país', () => {
    for (const kind of ['cities', 'crossings', 'roads'] as const) {
      for (const key of Object.keys(GEO_BY_COUNTRY[kind])) assert.ok(COUNTRY_IDS.includes(key as never), `${kind}.${key}`);
    }
    for (const [c, list] of Object.entries(GEO_BY_COUNTRY.cities)) for (const x of list) assert.equal(x.country, c);
  });

  test('el motor no importa la cartografía ni la interfaz', () => {
    const files: string[] = [];
    const walk = (d: string) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p); });
    walk('src/engine');
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      assert.doesNotMatch(src, /from ['"][^'"]*(\/geo|geo\.generated|\/atlas|\/ui\/)/, f);
    }
  });

  test('registro de capas (ATLAS-001): activas, parciales identificadas y previstas sin datos', () => {
    const st = Object.fromEntries(MAP_LAYERS.map((l) => [l.id, l.status]));
    for (const id of ['cities', 'crossings', 'roads', 'provinces', 'hydro']) assert.equal(st[id], 'active', id);
    // Datos reales pero no exhaustivos: nunca se presentan como completos.
    for (const id of ['ports', 'airports']) assert.equal(st[id], 'partial', id);
    assert.equal(st.bases, 'planned');
    const vis = defaultVisibility();
    assert.equal(vis.cities && vis.crossings && vis.roads && vis.provinces && vis.ports && vis.airports, true);
    assert.equal(vis.bases, false);
  });

  test('formato de coordenadas', () => {
    assert.equal(formatLonLat([-58.4, -34.6]), '34,60° S · 58,40° O');
    assert.equal(formatLonLat([-66.9, 10.5]), '10,50° N · 66,90° O');
  });
});
