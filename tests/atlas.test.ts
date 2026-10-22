/**
 * ATLAS-001: integridad de la cartografía del Atlas (datos reales, sin inventar).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ATLAS_SOURCE, AIRPORTS, PORTS, FACILITIES, STATES, ROAD_TIERS, RIVERS, LAKES, statesOf, stateById, facilityName } from '../src/atlas';
import { REGIONS, MAP } from '../src/engine/world';
import { COUNTRY_IDS } from '../src/data/regionDefs';

const src = (f: string) => JSON.parse(readFileSync(new URL(`../data-src/natural-earth/${f}`, import.meta.url), 'utf8')).features;

describe('Atlas: estados (Natural Earth admin-1)', () => {
  test('todos los estados de la fuente para los 12 países, con identificador único', () => {
    const fuente = src('admin1-sa.geojson').filter((f: any) => f.properties.name && f.geometry?.coordinates?.length);
    // Solo se excluyen, documentados, los que quedan fuera del mapa del juego (Galápagos).
    assert.deepEqual(ATLAS_SOURCE.excludedStates, ['Galápagos']);
    assert.equal(STATES.length, fuente.length - 1);
    assert.equal(new Set(STATES.map((s) => s.id)).size, STATES.length);
    for (const c of COUNTRY_IDS) assert.ok(statesOf(c).length >= 9, `${c}: ${statesOf(c).length}`);
  });

  test('cada estado tiene trazado, punto de rótulo dentro del mapa y región del juego de su propio país', () => {
    for (const s of STATES) {
      assert.match(s.path, /^M[-\d.]+,[-\d.]+/);
      assert.ok(s.label[0] > -50 && s.label[0] < MAP.width + 50 && s.label[1] > -50 && s.label[1] < MAP.height + 50, s.name);
      assert.ok(s.region && REGIONS[s.region], `${s.name}: sin región`);
      assert.equal(REGIONS[s.region!].country, s.country, `${s.name}: región de otro país`);
      for (const r of s.regions) assert.equal(REGIONS[r].country, s.country);
    }
  });

  test('las capitales asignadas existen en la tabla de ciudades de Natural Earth (o se dejan vacías)', () => {
    const nombres = new Set(src('populated-places-sa.geojson').map((f: any) => f.properties.name));
    const fix: Record<string, string> = { Bogotá: 'Bogota', 'San Juan de los Morros': 'San Juan De Los Morros' };
    for (const s of STATES) if (s.capital) assert.ok(nombres.has(fix[s.capital] ?? s.capital), `${s.name}: ${s.capital}`);
    assert.equal(STATES.find((s) => s.name === 'Distrito Capital')?.capital, 'Caracas');
    assert.equal(STATES.find((s) => s.name === 'Zulia')?.capital, 'Maracaibo');
  });
});

describe('Atlas: vías, agua e instalaciones', () => {
  test('tres jerarquías de vías, todas con datos', () => {
    for (const t of ['motorway', 'trunk', 'secondary'] as const) assert.ok(ROAD_TIERS[t].length > 1000, t);
  });

  test('ríos y lagos con trazado', () => {
    assert.ok(RIVERS.length > 50 && LAKES.length > 10);
    assert.ok(RIVERS.some((r) => /Orinoco/.test(r.name ?? '')) && RIVERS.some((r) => /Amazonas|Amazon/.test(r.name ?? '')));
  });

  test('aeropuertos y puertos: solo los de la fuente, dentro de un país jugable y con estado', () => {
    const iatas = new Set(src('airports-sa.geojson').map((f: any) => f.properties.iata_code));
    for (const a of AIRPORTS) assert.ok(!a.iata || iatas.has(a.iata), a.name);
    assert.ok(AIRPORTS.length > 40 && PORTS.length > 40);
    assert.equal(new Set(FACILITIES.map((f) => f.id)).size, FACILITIES.length);
    for (const f of FACILITIES) {
      assert.ok(COUNTRY_IDS.includes(f.country), f.name);
      assert.ok(f.state && stateById(f.state)?.country === f.country, `${f.name}: estado`);
      assert.ok(f.region && REGIONS[f.region].country === f.country, `${f.name}: región`);
    }
    // Venezuela: los de la fuente, sin añadidos.
    assert.deepEqual(AIRPORTS.filter((a) => a.country === 'VEN').map((a) => a.iata).sort(), ['BRM', 'CCS', 'MAR', 'VLN']);
  });

  test('los nombres visibles no inventan: solo quitan la abreviatura de la fuente', () => {
    const mar = AIRPORTS.find((a) => a.iata === 'MAR')!;
    assert.equal(facilityName(mar), 'La Chinita (internacional)');
  });
});
