/** MIL-MOV-001 (opción B): movimiento terrestre al 25 % del tiempo anterior. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createNewGame } from '../src/engine/setup';
import { advanceHours, stepHour, REAL_MS_PER_DAY, SPEEDS } from '../src/engine/time';
import { perform } from '../src/engine/actions';
import { BASE_SPEED, HOSTILE_SPEED_FACTOR, LAND_SPEED_MULTIPLIER, etaHours, travelHours, unitsOf } from '../src/engine/military';
import { hourlyCombat, joinWar } from '../src/engine/war';
import { REGIONS, distance } from '../src/engine/world';
import { COUNTRY_IDS } from '../src/data/regionDefs';
import { MemoryStorage, loadGame, saveGame } from '../src/persistence/saves';
import type { CountryId, GameState } from '../src/engine/types';

const calm = (s: GameState) => { for (const c of COUNTRY_IDS) s.ai[c].aggression = 0; return s; };
/** Horas hasta que el batallón está en `to` (o deja de existir). */
function hoursUntil(s: GameState, id: string, to: string, max = 3000): number {
  let h = 0;
  while (s.units[id] && s.units[id].regionId !== to && h < max) { stepHour(s); h++; }
  return h;
}
/** Duraciones medidas con el código ANTERIOR a MIL-MOV-001 (mismas partidas y órdenes). */
const BEFORE = { baUy: 132, baPatagonia: 190, noroestePatagonia: 355 };

describe('MIL-MOV-001: tiempo de desplazamiento al 25 %', () => {
  test('constante única: cada tramo dura exactamente la cuarta parte (todas las conexiones del mapa)', () => {
    assert.equal(LAND_SPEED_MULTIPLIER, 4);
    const s = createNewGame('ARG', 1);
    for (const [id, r] of Object.entries(REGIONS)) for (const n of r.neighbors) {
      const owner = s.regions[id].controller;
      const hostile = s.regions[n].controller !== owner;
      const before = distance(id, n) / (BASE_SPEED * (hostile ? HOSTILE_SPEED_FACTOR : 1));
      assert.ok(Math.abs(travelHours(s, owner, id, n) - before / 4) < 1e-9, `${id}→${n}`);
    }
  });

  test('Buenos Aires → Uruguay (ataque directo): de 132 h a ≈ 33 h, y la estimación coincide con la llegada', () => {
    const s = calm(createNewGame('ARG', 7));
    const u = unitsOf(s, 'ARG')[0]; u.regionId = 'AR_BA';
    assert.ok(perform(s, 'ARG', { type: 'directAttack', unitIds: [u.id], target: 'UY' }).ok);
    const eta = etaHours(s, u);
    const real = hoursUntil(s, u.id, 'UY');
    assert.equal(real, eta);
    assert.ok(Math.abs(real - BEFORE.baUy / 4) <= 1, `${real} h frente a ${BEFORE.baUy / 4}`);
  });

  test('rutas de una y varias regiones en territorio propio: ≈ 25 % del tiempo anterior', () => {
    for (const [from, to, before, legs] of [['AR_BA', 'AR_PA', BEFORE.baPatagonia, 1], ['AR_NO', 'AR_PA', BEFORE.noroestePatagonia, 2]] as const) {
      const s = calm(createNewGame('ARG', 7));
      const u = unitsOf(s, 'ARG')[0]; u.regionId = from;
      perform(s, 'ARG', { type: 'move', unitId: u.id, target: to });
      assert.equal(u.path.length, legs);
      const eta = etaHours(s, u);
      const real = hoursUntil(s, u.id, to);
      assert.equal(real, eta, `${from}→${to}`);
      // Hasta 1 hora de redondeo por tramo.
      assert.ok(Math.abs(real - before / 4) <= legs, `${from}→${to}: ${real} h frente a ${before / 4}`);
    }
  });

  test('territorio propio, aliado y hostil: el aliado como el propio y el hostil al 65 % (sin cambios en esas reglas)', () => {
    const s = calm(createNewGame('ARG', 3));
    perform(s, 'ARG', { type: 'declareWar', target: 'CHL' });
    const war = s.wars[0];
    assert.ok(joinWar(s, 'BOL', war.id, 'attackers').ok);
    const [from, to] = ['AR_NO', REGIONS.AR_NO.neighbors.find((n) => REGIONS[n].country === 'ARG')!];
    const at = (controller: CountryId) => { s.regions[to].controller = controller; return travelHours(s, 'ARG', from, to); };
    const own = at('ARG'), ally = at('BOL'), hostile = at('CHL');
    assert.equal(ally, own);
    assert.ok(Math.abs(hostile - own / HOSTILE_SPEED_FACTOR) < 1e-9);
  });

  test('jugador e IA: mismas reglas y mismas duraciones', () => {
    // Misma orden de Chile, en una partida donde Chile es el jugador y en otra donde lo maneja la IA.
    const a = calm(createNewGame('CHL', 4)), b = calm(createNewGame('ARG', 4));
    const ua = unitsOf(a, 'CHL')[0], ub = unitsOf(b, 'CHL')[0];
    ua.regionId = ub.regionId = 'CL_NO';
    ua.path = ub.path = []; ua.status = ub.status = 'idle';
    b.ai.CHL.lastActionHour = 1e9; // que la IA no dé otra orden a ese batallón durante la prueba
    perform(a, 'CHL', { type: 'move', unitId: ua.id, target: 'CL_SU' });
    perform(b, 'CHL', { type: 'move', unitId: ub.id, target: 'CL_SU' });
    assert.equal(etaHours(a, ua), etaHours(b, ub));
    assert.deepEqual(ua.path, ub.path);
  });

  test('combustible completo, bajo y agotado: la llegada real coincide con la estimación; con poco o sin combustible se tarda más', () => {
    const results: number[] = [];
    for (const fuel of [1, 0.25, 0]) {
      const s = calm(createNewGame('ARG', 31));
      perform(s, 'ARG', { type: 'setPolicy', patch: { militaryBudget: 0.2 } });
      advanceHours(s, 24);
      const u = unitsOf(s, 'ARG').find((x) => x.regionId === 'AR_BA')!;
      u.fuel = fuel;
      perform(s, 'ARG', { type: 'move', unitId: u.id, target: 'AR_PA' });
      const eta = etaHours(s, u);
      const real = hoursUntil(s, u.id, 'AR_PA');
      assert.equal(real, eta, `combustible ${fuel}`);
      results.push(real);
    }
    // Sin combustible se marcha a pie a mitad de velocidad hasta el reabastecimiento diario.
    assert.ok(results[2] > results[0], `agotado ${results[2]} h frente a lleno ${results[0]} h`);
    assert.ok(results[1] >= results[0]);
  });

  test('el combustible se sigue consumiendo por HORA de marcha (regla sin cambios); un viaje 4 veces más corto gasta 4 veces menos', () => {
    const s = calm(createNewGame('ARG', 9));
    const u = unitsOf(s, 'ARG').find((x) => x.regionId === 'AR_BA')!;
    perform(s, 'ARG', { type: 'move', unitId: u.id, target: 'AR_PA' });
    // 20 horas dentro del mismo día (sin el reabastecimiento de medianoche).
    for (let i = 0; i < 20; i++) stepHour(s);
    assert.ok(Math.abs((1 - s.units[u.id].fuel) - 20 / 144) < 1e-9, 'consumo por hora igual que antes');
    assert.ok(s.units[u.id].progress > 0);
  });

  test('órdenes de varios batallones: todos llegan a la vez si salen juntos', () => {
    const s = calm(createNewGame('BRA', 2));
    const us = unitsOf(s, 'BRA').slice(0, 3);
    for (const u of us) { u.regionId = us[0].regionId; u.path = []; u.status = 'idle'; }
    const target = Object.values(s.regions).find((r) => r.owner === 'BRA' && r.id !== us[0].regionId)!.id;
    for (const u of us) assert.ok(perform(s, 'BRA', { type: 'move', unitId: u.id, target }).ok);
    const etas = us.map((u) => etaHours(s, u));
    assert.ok(etas.every((e) => e === etas[0]));
    const real = hoursUntil(s, us[0].id, target);
    assert.equal(real, etas[0]);
    for (const u of us) assert.equal(s.units[u.id].regionId, target);
  });

  test('retirada manual: el regreso usa la misma velocidad y su estimación se cumple', () => {
    const s = calm(createNewGame('ARG', 8));
    perform(s, 'ARG', { type: 'declareWar', target: 'URY' });
    const u = unitsOf(s, 'ARG')[0];
    u.regionId = 'UY'; u.path = []; u.status = 'idle';
    for (const e of unitsOf(s, 'URY')) { e.regionId = 'UY'; e.path = []; e.status = 'idle'; }
    hourlyCombat(s);
    assert.ok(perform(s, 'ARG', { type: 'retreat', unitId: u.id }).ok);
    const to = s.units[u.id].path[0];
    const eta = etaHours(s, s.units[u.id]);
    assert.ok(Math.abs(eta - Math.ceil(travelHours(s, 'ARG', 'UY', to))) <= 1);
    const real = hoursUntil(s, u.id, to);
    if (s.units[u.id]) assert.equal(real, eta);
  });
});

describe('MIL-MOV-001: partidas guardadas', () => {
  test('una marcha guardada en v3 ANTES del cambio conserva destino, ruta y progreso, y termina en ≈ 25 % del tiempo restante', async () => {
    const record = JSON.parse(readFileSync(new URL('./fixtures/save-v3-marcha.json', import.meta.url), 'utf8'));
    const before = JSON.parse(readFileSync(new URL('./fixtures/save-v3-marcha.before.json', import.meta.url), 'utf8')) as {
      hour: number; marches: Record<string, { regionId: string; path: string[]; destination: string; progress: number; etaBefore: number }>;
    };
    assert.equal(record.version, 3, 'formato v3: no hace falta migración');
    const st = new MemoryStorage();
    await st.put(record);
    const s = await loadGame(st, record.slot);
    assert.equal(s.hour, before.hour);
    for (const [id, m] of Object.entries(before.marches)) {
      const u = s.units[id];
      assert.equal(u.regionId, m.regionId);
      assert.deepEqual(u.path, m.path);
      assert.equal(u.destination, m.destination);
      assert.equal(u.progress, m.progress, 'el progreso acumulado no se reinicia');
      const eta = etaHours(s, u);
      assert.ok(Math.abs(eta - m.etaBefore / 4) <= m.path.length + 1, `${id}: ${eta} h frente a ${m.etaBefore / 4}`);
      const c = JSON.parse(JSON.stringify(s)) as GameState;
      assert.equal(hoursUntil(c, id, m.destination!), eta);
    }
  });
  test('guardar y cargar a mitad de una marcha no cambia la llegada', async () => {
    const a = calm(createNewGame('ARG', 12));
    const u = unitsOf(a, 'ARG').find((x) => x.regionId === 'AR_BA')!;
    perform(a, 'ARG', { type: 'move', unitId: u.id, target: 'AR_PA' });
    advanceHours(a, 10);
    const st = new MemoryStorage();
    await saveGame(st, a, '1');
    const b = await loadGame(st, '1');
    assert.equal(b.units[u.id].progress, a.units[u.id].progress);
    assert.equal(hoursUntil(a, u.id, 'AR_PA'), hoursUntil(b, u.id, 'AR_PA'));
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });
});

describe('MIL-MOV-001: sin cambios en reloj, economía ni combate', () => {
  test('mismos resultados que antes del cambio (instantánea tomada con el código anterior)', () => {
    const snap = JSON.parse(readFileSync(new URL('./fixtures/mov001-invariantes-antes.json', import.meta.url), 'utf8'));
    assert.deepEqual({ REAL_MS_PER_DAY, speeds: SPEEDS.map((x) => x.multiplier) }, snap.clock);
    // Economía: 60 días sin guerras.
    const e = calm(createNewGame('BRA', 5));
    advanceHours(e, 60 * 24);
    const econ = Object.fromEntries(COUNTRY_IDS.map((c) => [c, { gdp: +e.countries[c].gdp.toFixed(6), reserves: +e.countries[c].reserves.toFixed(6), debt: +e.countries[c].debt.toFixed(6) }]));
    assert.deepEqual(econ, snap.econ);
    // Combate: 24 intervalos horarios con los bandos ya enfrentados.
    const s = calm(createNewGame('ARG', 11));
    perform(s, 'ARG', { type: 'declareWar', target: 'URY' });
    for (const u of unitsOf(s, 'ARG').slice(0, 2)) { u.regionId = 'UY'; u.path = []; u.status = 'idle'; }
    for (const u of unitsOf(s, 'URY')) { u.regionId = 'UY'; u.path = []; u.status = 'idle'; }
    for (let h = 0; h < 24; h++) hourlyCombat(s);
    const b = s.battles.UY;
    assert.deepEqual({ losses: b.losses, tally: b.tally, men: Object.fromEntries(Object.values(s.units).filter((u) => u.regionId === 'UY').map((u) => [u.id, u.men])) }, snap.combat);
  });
});
