/** MIL Fase 1: plantilla, tripulación, inventario, reclutamiento progresivo, reposición y guardado v2. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createNewGame } from '../src/engine/setup';
import { advanceDays } from '../src/engine/time';
import { perform } from '../src/engine/actions';
import { etaHours, unitsOf } from '../src/engine/military';
import {
  BATTALION_TEMPLATE, EQUIPMENT_MODELS, EQUIP_CATEGORIES, RECRUITMENT, categoryCount, crewReport, fillFromInventory,
  initialEquipment, nationalEquipment, unitsTotals,
} from '../src/engine/equipment';
import { COUNTRY_IDS } from '../src/data/regionDefs';
import { PROVISIONAL_CREW } from '../src/data/military';
import { MemoryStorage, loadGame, saveGame } from '../src/persistence/saves';
import { SAVE_VERSION, type CountryId, type GameState, type Unit } from '../src/engine/types';

/** Total de equipo de un país por modelo: en batallones + en reserva. */
function equipmentTotals(s: GameState, c: CountryId): Record<string, number> {
  const t: Record<string, number> = {};
  for (const { model, assigned, reserve } of nationalEquipment(s, c)) t[model.id] = assigned + reserve;
  return t;
}

describe('Plantilla universal de batallón', () => {
  test('máximos aprobados: 1.000 efectivos, 20 tanques, 30 blindados, 8 artillerías, 40 drones, 20 transportes', () => {
    assert.equal(BATTALION_TEMPLATE.maxMen, 1000);
    assert.deepEqual(BATTALION_TEMPLATE.slots, { tank: 20, armored: 30, artillery: 8, drone: 40, transport: 20 });
  });
  test('ningún batallón inicial de ningún país supera la plantilla y todos usan modelos de su país', () => {
    for (const c of COUNTRY_IDS) {
      const s = createNewGame(c, 7);
      for (const u of Object.values(s.units)) {
        assert.ok(u.men <= 1000);
        for (const cat of EQUIP_CATEGORIES) assert.ok(categoryCount(u, cat) <= BATTALION_TEMPLATE.slots[cat], `${u.id} ${cat}`);
        for (const id of Object.keys(u.equipment)) assert.equal(EQUIPMENT_MODELS[id].country, u.owner);
      }
    }
  });
  test('los modelos de prueba están marcados como provisionales y difieren entre países', () => {
    assert.ok(Object.values(EQUIPMENT_MODELS).every((m) => m.provisional));
    const chl = EQUIPMENT_MODELS['CHL-T1'].stats, bol = EQUIPMENT_MODELS['BOL-T1'].stats;
    assert.notDeepEqual(chl, bol);
  });
});

describe('Tripulación automática', () => {
  const unit = (men: number, equipment: Record<string, number>): Unit => ({
    id: 'x', owner: 'ARG', name: 'x', men, org: 100, morale: 70, regionId: 'AR_BA', destination: null, path: [], progress: 0, status: 'idle', equipment, recruitPending: 0,
  });
  test('batallón completo: todo el equipo tripulado y el resto infantería', () => {
    const u = unit(1000, { 'ARG-T1': 20, 'ARG-B1': 30, 'ARG-A1': 8, 'ARG-D1': 40, 'ARG-V1': 20 });
    const r = crewReport(u);
    const need = 20 * PROVISIONAL_CREW.tank + 30 * PROVISIONAL_CREW.armored + 8 * PROVISIONAL_CREW.artillery + 40 * PROVISIONAL_CREW.drone + 20 * PROVISIONAL_CREW.transport;
    assert.equal(r.crew, need);
    assert.equal(r.infantry, 1000 - need);
    for (const cat of EQUIP_CATEGORIES) assert.equal(r.byCategory[cat].active, r.byCategory[cat].total);
  });
  test('batallón incompleto: el equipo sin personal queda inactivo, por orden de prioridad (MIL-028 B)', () => {
    const u = unit(100, { 'ARG-T1': 20, 'ARG-B1': 30 });
    const r = crewReport(u);
    assert.equal(r.byCategory.tank.active, 20);       // 80 efectivos
    assert.equal(r.byCategory.armored.active, 6);     // 20 restantes / 3
    assert.equal(r.byCategory.armored.total, 30);
    assert.equal(r.infantry, 2);
    assert.equal(r.crew + r.infantry, u.men);
  });
  test('totales de varios batallones (multiselección)', () => {
    const a = unit(1000, { 'ARG-T1': 10 }), b = unit(500, { 'ARG-T1': 5, 'ARG-D1': 4 });
    const t = unitsTotals([a, b]);
    assert.equal(t.men, 1500);
    assert.equal(t.byCategory.tank.total, 15);
    assert.equal(t.byCategory.drone.total, 4);
  });
});

describe('Inventario nacional y reposición', () => {
  test('rellenar desde la reserva conserva el total de equipo y respeta la plantilla', () => {
    const s = createNewGame('BRA', 3);
    const before = equipmentTotals(s, 'BRA');
    const u = unitsOf(s, 'BRA')[0];
    u.equipment = {};
    // Lo que se quitó vuelve a contar como reserva para comparar totales.
    for (const [id, q] of Object.entries(initialEquipment('BRA'))) s.countries.BRA.inventory[id] += q;
    const moved = fillFromInventory(s, u);
    assert.ok(moved > 0);
    assert.deepEqual(equipmentTotals(s, 'BRA'), before);
    for (const cat of EQUIP_CATEGORIES) assert.ok(categoryCount(u, cat) <= BATTALION_TEMPLATE.slots[cat]);
  });
  test('la reposición automática se puede pausar (MIL-019 B, 038 B)', () => {
    const s = createNewGame('ARG', 5);
    for (const c of COUNTRY_IDS) s.ai[c].aggression = 0;
    const u = unitsOf(s, 'ARG')[0];
    assert.ok(perform(s, 'ARG', { type: 'setAutoReplenish', enabled: false }).ok);
    u.men = 600;
    advanceDays(s, 3);
    assert.equal(s.units[u.id].men, 600);
    assert.ok(perform(s, 'ARG', { type: 'setAutoReplenish', enabled: true }).ok);
    advanceDays(s, 3);
    assert.equal(s.units[u.id].men, 600 + 3 * RECRUITMENT.menPerDay);
  });
  test('desmovilizar en territorio propio devuelve el equipo a la reserva', () => {
    const s = createNewGame('CHL', 2);
    const before = equipmentTotals(s, 'CHL');
    const u = unitsOf(s, 'CHL')[0];
    assert.ok(perform(s, 'CHL', { type: 'disband', unitId: u.id }).ok);
    assert.deepEqual(equipmentTotals(s, 'CHL'), before);
  });
});

describe('Reclutamiento voluntario y progresivo', () => {
  test('nace operativo con el primer contingente, recibe equipo y se completa día a día', () => {
    const s = createNewGame('PER', 4);
    for (const c of COUNTRY_IDS) s.ai[c].aggression = 0;
    const before = new Set(unitsOf(s, 'PER').map((u) => u.id));
    const region = Object.values(s.regions).find((r) => r.owner === 'PER')!.id;
    assert.ok(perform(s, 'PER', { type: 'recruit', regionId: region }).ok);
    const u = unitsOf(s, 'PER').find((x) => !before.has(x.id))!;
    assert.equal(u.men, RECRUITMENT.initialMen);
    assert.equal(u.status, 'idle');
    assert.ok(Object.keys(u.equipment).length > 0, 'recibe equipo de la reserva');
    advanceDays(s, 2);
    assert.equal(s.units[u.id].men, RECRUITMENT.initialMen + 2 * RECRUITMENT.menPerDay);
    advanceDays(s, 20);
    assert.equal(s.units[u.id].men, 1000);
    assert.equal(s.units[u.id].recruitPending, 0);
  });
  test('se pueden reclutar varios batallones en una orden (MIL-030 B) y el coste escala', () => {
    const s = createNewGame('BRA', 4);
    const n = unitsOf(s, 'BRA').length, r0 = s.countries.BRA.reserves;
    const region = Object.values(s.regions).find((r) => r.owner === 'BRA')!.id;
    const one = createNewGame('BRA', 4);
    perform(one, 'BRA', { type: 'recruit', regionId: region });
    const costOne = r0 - one.countries.BRA.reserves;
    assert.ok(perform(s, 'BRA', { type: 'recruit', regionId: region, count: 3 }).ok);
    assert.equal(unitsOf(s, 'BRA').length, n + 3);
    assert.ok(Math.abs((r0 - s.countries.BRA.reserves) - 3 * costOne) < 1e-9);
    assert.equal(perform(s, 'BRA', { type: 'recruit', regionId: region, count: RECRUITMENT.maxPerOrder + 1 }).ok, false);
  });
});

describe('Movimiento con duración', () => {
  test('la duración estimada coincide con la llegada real', () => {
    const s = createNewGame('ARG', 9);
    for (const c of COUNTRY_IDS) s.ai[c].aggression = 0;
    const u = unitsOf(s, 'ARG').find((x) => x.regionId === 'AR_BA')!;
    assert.ok(perform(s, 'ARG', { type: 'move', unitId: u.id, target: 'AR_PA' }).ok);
    const eta = etaHours(s, u);
    assert.ok(eta > 24);
    advanceDays(s, Math.ceil(eta / 24) + 1);
    assert.equal(s.units[u.id].regionId, 'AR_PA');
  });
});

describe('Guardado v2 y migración', () => {
  test('la versión actual es 2 y una partida nueva guarda y carga con su equipo intacto', async () => {
    assert.equal(SAVE_VERSION, 2);
    const s = createNewGame('COL', 11);
    const st = new MemoryStorage();
    await saveGame(st, s, '1');
    const l = await loadGame(st, '1');
    assert.equal(l.version, 2);
    assert.deepEqual(l.units, s.units);
    assert.deepEqual(l.countries.COL.inventory, s.countries.COL.inventory);
  });
  test('la partida real de la beta 1.0 (v1) migra de forma determinista y sigue simulando', async () => {
    const record = JSON.parse(readFileSync(new URL('./fixtures/save-v1-beta1.json', import.meta.url), 'utf8'));
    assert.equal(record.version, 1);
    const st = new MemoryStorage();
    await st.put(record);
    const a = await loadGame(st, record.slot);
    const b = await loadGame(st, record.slot);
    assert.equal(a.version, 2);
    assert.deepEqual(a, b, 'misma entrada, mismo resultado');
    // Se conservan efectivos, posiciones, guerras y economía; se añaden equipo e inventario.
    const raw = JSON.parse(record.data);
    for (const [id, u] of Object.entries(raw.units) as [string, { men: number; regionId: string }][]) {
      assert.equal(a.units[id].men, u.men);
      assert.equal(a.units[id].regionId, u.regionId);
      assert.ok(Object.keys(a.units[id].equipment).length > 0 || a.units[id].owner === 'GUY' || a.units[id].owner === 'SUR');
      assert.ok(!('trainingHours' in a.units[id]));
      assert.notEqual(a.units[id].status as string, 'training');
    }
    assert.equal(a.countries.VEN.reserves, raw.countries.VEN.reserves);
    assert.ok(Object.keys(a.countries.VEN.inventory).length > 0);
    assert.equal(a.countries.VEN.autoReplenish, true);
    // El registro guardado no se reescribe al cargar.
    assert.equal((await st.get(record.slot))!.version, 1);
    advanceDays(a, 5);
    assert.equal(a.hour, 48 + 120);
  });
  test('un guardado de una versión futura se rechaza con un mensaje claro', async () => {
    const st = new MemoryStorage();
    await st.put({ slot: 'f', label: 'f', player: 'ARG', hour: 0, savedAt: 0, version: SAVE_VERSION + 1, data: '{"countries":{},"regions":{},"units":{}}' });
    await assert.rejects(loadGame(st, 'f'), /más reciente/);
  });
});
