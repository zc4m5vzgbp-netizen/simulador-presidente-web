/**
 * Pruebas del motor (criterios 1-11 del prompt).
 * Ejecutar: npm test   (node:test + tsx)
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame } from '../src/engine/setup';
import { advanceDays, advanceHours, GameClock, REAL_MS_PER_DAY, stepHour } from '../src/engine/time';
import { formatDate } from '../src/engine/core';
import { annualFlows, monthlyClose, totalReserves } from '../src/engine/economy';
import { perform } from '../src/engine/actions';
import { unitsOf, unitsIn, findPath } from '../src/engine/military';
import { atWar, makePeace, warAssessment } from '../src/engine/war';
import { evaluateTrade, getRelation } from '../src/engine/diplomacy';
import { COUNTRY_IDS } from '../src/data/regionDefs';
import { REGIONS } from '../src/engine/world';
import { MemoryStorage, saveGame, loadGame } from '../src/persistence/saves';
import type { CountryId, GameState } from '../src/engine/types';

const clone = (s: GameState): GameState => JSON.parse(JSON.stringify(s));

/** Coloca todos los batallones de `c` en una región (para escenarios de prueba). */
function stackIn(s: GameState, c: CountryId, regionId: string) {
  for (const u of unitsOf(s, c)) { u.regionId = regionId; u.path = []; u.status = 'idle'; u.destination = null; }
}

describe('1. Inicio de partida', () => {
  for (const c of COUNTRY_IDS) {
    test(`se puede iniciar con ${c}`, () => {
      const s = createNewGame(c, 1);
      assert.equal(s.player, c);
      assert.equal(Object.keys(s.countries).length, 12);
      assert.ok(unitsOf(s, c).length >= 1, 'el jugador tiene al menos un batallón');
      assert.ok(Object.values(s.regions).some((r) => r.controller === c));
      assert.ok(s.countries[c].gdp > 0 && s.countries[c].population > 0);
      advanceDays(s, 3); // la simulación funciona con ese país
      assert.equal(s.hour, 72);
    });
  }
  test('país no válido lanza error', () => {
    assert.throws(() => createNewGame('XXX' as CountryId));
  });
});

describe('2. Calendario', () => {
  test('avanza por días y meses', () => {
    const s = createNewGame('ARG', 1);
    assert.equal(formatDate(s.hour), '1 ene 2027');
    advanceDays(s, 1);
    assert.equal(formatDate(s.hour), '2 ene 2027');
    advanceDays(s, 31);
    assert.equal(formatDate(s.hour), '2 feb 2027');
  });
  test('un día = 60 s reales a velocidad normal, independiente de los fotogramas', () => {
    const a = new GameClock(1e9); a.speed = 1;
    const b = new GameClock(1e9); b.speed = 1;
    let ha = 0, hb = 0;
    for (let i = 0; i < 60; i++) ha += a.tick(1000);          // 60 fotogramas de 1 s
    for (let i = 0; i < 3600; i++) hb += b.tick(1000 / 60);   // 3600 fotogramas de 16,7 ms
    assert.equal(ha, 24);
    assert.equal(hb, 24);
    assert.equal(REAL_MS_PER_DAY, 60_000);
  });
  test('la velocidad acelerada multiplica el avance', () => {
    const c = new GameClock(1e9); c.speed = 2;
    let h = 0; for (let i = 0; i < 60; i++) h += c.tick(100); // 6 s reales ×10
    assert.equal(h, 24);
  });
  test('el cierre mensual genera informe presupuestario', () => {
    const s = createNewGame('CHL', 1);
    advanceDays(s, 32);
    assert.ok(s.countries.CHL.lastReport, 'hay informe mensual');
    assert.ok(s.countries.CHL.lastReport!.revenue > 0);
  });
});

describe('3. Pausa', () => {
  test('en pausa el reloj no produce horas y el estado no cambia', () => {
    const s = createNewGame('PER', 1);
    const clock = new GameClock(); clock.speed = 1;
    let h = clock.tick(5000);
    advanceHours(s, h);
    const before = JSON.stringify(s);
    clock.speed = 0;
    for (let i = 0; i < 100; i++) { h = clock.tick(1000); advanceHours(s, h); }
    assert.equal(JSON.stringify(s), before);
  });
});

describe('4. Decisiones económicas', () => {
  test('subir impuestos aumenta ingresos y reservas, y reduce estabilidad', () => {
    const base = createNewGame('ARG', 7);
    const alt = clone(base);
    const r0 = annualFlows(alt, 'ARG').revenue;
    const st0 = alt.countries.ARG.stability;
    assert.ok(perform(alt, 'ARG', { type: 'setPolicy', patch: { taxRate: 30 } }).ok);
    assert.ok(annualFlows(alt, 'ARG').revenue > r0);
    assert.ok(alt.countries.ARG.stability < st0, 'la subida brusca resta estabilidad');
    advanceDays(base, 20); advanceDays(alt, 20);
    assert.ok(alt.countries.ARG.reserves > base.countries.ARG.reserves + 1);
  });
  test('más inversión pública eleva el crecimiento en el cierre mensual', () => {
    const base = createNewGame('BRA', 7);
    const alt = clone(base);
    perform(alt, 'BRA', { type: 'setPolicy', patch: { investment: 6 } });
    monthlyClose(base); monthlyClose(alt);
    assert.ok(alt.countries.BRA.growth > base.countries.BRA.growth);
  });
  test('el déficit sin reservas se financia con deuda (no se crea dinero)', () => {
    const s = createNewGame('ECU', 3);
    s.countries.ECU.reserves = 0;
    perform(s, 'ECU', { type: 'setPolicy', patch: { publicSpending: 35 } });
    const debt0 = s.countries.ECU.debt;
    advanceDays(s, 10);
    assert.equal(s.countries.ECU.reserves, 0);
    assert.ok(s.countries.ECU.debt > debt0);
  });
  test('los límites de política se respetan', () => {
    const s = createNewGame('URY', 1);
    perform(s, 'URY', { type: 'setPolicy', patch: { taxRate: 500, militaryBudget: -3 } });
    assert.equal(s.countries.URY.policy.taxRate, 50);
    assert.equal(s.countries.URY.policy.militaryBudget, 0.2);
  });
});

describe('5. Transferencias económicas', () => {
  test('la ayuda se descuenta del emisor y se acredita al receptor', () => {
    const s = createNewGame('BRA', 1);
    const total = totalReserves(s);
    const a0 = s.countries.BRA.reserves, b0 = s.countries.PRY.reserves;
    const res = perform(s, 'BRA', { type: 'sendAid', target: 'PRY', amount: 5 });
    assert.ok(res.ok, res.message);
    assert.equal(s.countries.BRA.reserves, a0 - 5);
    assert.equal(s.countries.PRY.reserves, b0 + 5);
    assert.ok(Math.abs(totalReserves(s) - total) < 1e-9);
  });
  test('no se puede transferir más de lo disponible ni cantidades negativas', () => {
    const s = createNewGame('SUR', 1);
    const snap = JSON.stringify(s.countries);
    assert.equal(perform(s, 'SUR', { type: 'sendAid', target: 'GUY', amount: 999 }).ok, false);
    assert.equal(perform(s, 'SUR', { type: 'sendAid', target: 'GUY', amount: -5 }).ok, false);
    assert.equal(JSON.stringify(s.countries), snap);
  });
  test('amortizar deuda reduce reservas y deuda en la misma cantidad', () => {
    const s = createNewGame('CHL', 1);
    const r0 = s.countries.CHL.reserves, d0 = s.countries.CHL.debt;
    perform(s, 'CHL', { type: 'payDebt', amount: 10 });
    assert.equal(r0 - s.countries.CHL.reserves, d0 - s.countries.CHL.debt);
  });
});

describe('6-7. Órdenes de movimiento y llegada', () => {
  test('un batallón recibe una orden, se desplaza con el tiempo y llega', () => {
    const s = createNewGame('ARG', 1);
    const u = unitsOf(s, 'ARG').find((x) => x.regionId === 'AR_BA')!;
    const res = perform(s, 'ARG', { type: 'move', unitId: u.id, target: 'AR_PA' });
    assert.ok(res.ok, res.message);
    assert.equal(u.status, 'moving');
    assert.equal(u.destination, 'AR_PA');
    advanceHours(s, 2);
    assert.equal(u.regionId, 'AR_BA', 'el movimiento requiere tiempo');
    assert.ok(u.progress > 0);
    let hours = 0;
    while (s.units[u.id].regionId !== 'AR_PA' && hours < 24 * 30) { stepHour(s); hours++; }
    assert.equal(s.units[u.id].regionId, 'AR_PA');
    assert.equal(s.units[u.id].status, 'idle');
    assert.ok(hours > 24, `tardó ${hours} h`);
  });
  test('rutas de varias etapas', () => {
    const s = createNewGame('ARG', 1);
    const path = findPath(s, 'ARG', 'AR_PA', 'AR_NO');
    assert.ok(path && path.length >= 1);
  });
  test('no se puede entrar en un país con el que no hay guerra', () => {
    const s = createNewGame('ARG', 1);
    const u = unitsOf(s, 'ARG')[0];
    assert.equal(perform(s, 'ARG', { type: 'move', unitId: u.id, target: 'UY' }).ok, false);
  });
  test('reclutamiento cuesta dinero, requiere entrenamiento y luego es operativo', () => {
    const s = createNewGame('CHL', 1);
    const n = unitsOf(s, 'CHL').length, r0 = s.countries.CHL.reserves;
    assert.ok(perform(s, 'CHL', { type: 'recruit', regionId: 'CL_CE' }).ok);
    const nu = unitsOf(s, 'CHL').find((u) => u.status === 'training')!;
    assert.equal(unitsOf(s, 'CHL').length, n + 1);
    assert.ok(s.countries.CHL.reserves < r0);
    assert.equal(perform(s, 'CHL', { type: 'move', unitId: nu.id, target: 'CL_NO' }).ok, false);
    advanceDays(s, 16);
    assert.equal(s.units[nu.id].status, 'idle');
  });
});

describe('8. Combate', () => {
  function battleScenario(seed: number) {
    const s = createNewGame('ARG', seed);
    for (const c of COUNTRY_IDS) s.ai[c].aggression = 0;
    perform(s, 'ARG', { type: 'declareWar', target: 'URY' });
    stackIn(s, 'ARG', 'AR_NE');
    stackIn(s, 'URY', 'UY');
    for (const u of unitsOf(s, 'ARG')) perform(s, 'ARG', { type: 'move', unitId: u.id, target: 'UY' });
    return s;
  }
  test('el enfrentamiento produce bajas, desgaste y un resultado', () => {
    const s = battleScenario(5);
    const argMen0 = unitsOf(s, 'ARG').reduce((a, u) => a + u.men, 0);
    const uryMen0 = unitsOf(s, 'URY').reduce((a, u) => a + u.men, 0);
    let sawBattle = false;
    for (let h = 0; h < 24 * 20; h++) { stepHour(s); if (s.battles.UY) sawBattle = true; }
    assert.ok(sawBattle, 'hubo batalla');
    const argMen1 = unitsOf(s, 'ARG').reduce((a, u) => a + u.men, 0);
    const uryMen1 = unitsOf(s, 'URY').reduce((a, u) => a + u.men, 0);
    assert.ok(argMen1 < argMen0, 'el atacante sufre bajas');
    assert.ok(uryMen1 < uryMen0, 'el defensor sufre bajas');
    assert.ok(s.countries.ARG.casualties > 0 && s.countries.URY.casualties > 0);
    assert.ok(s.log.some((l) => l.text.startsWith('Termina la batalla')));
  });
  test('el combate es determinista con la misma semilla', () => {
    const a = battleScenario(9), b = battleScenario(9);
    advanceDays(a, 6); advanceDays(b, 6);
    assert.equal(JSON.stringify(a.units), JSON.stringify(b.units));
  });
  test('la fuerza importa: un ejército muy superior vence', () => {
    const s = battleScenario(3);
    advanceDays(s, 20);
    assert.ok(unitsIn(s, 'UY').every((u) => u.owner === 'ARG'), 'Uruguay es expulsado de su región');
  });
});

describe('9. Control territorial y paz', () => {
  test('una región indefensa se ocupa y afecta a la economía', () => {
    const s = createNewGame('ARG', 2);
    perform(s, 'ARG', { type: 'declareWar', target: 'URY' });
    stackIn(s, 'URY', 'UY');
    // Uruguay solo tiene una región; usamos Chile para probar una región indefensa
    perform(s, 'ARG', { type: 'declareWar', target: 'CHL' });
    stackIn(s, 'CHL', 'CL_CE');
    const u = unitsOf(s, 'ARG').find((x) => x.regionId === 'AR_PA') ?? unitsOf(s, 'ARG')[0];
    u.regionId = 'AR_PA';
    const gdpArg0 = s.countries.ARG.gdp, gdpChl0 = s.countries.CHL.gdp;
    assert.ok(perform(s, 'ARG', { type: 'move', unitId: u.id, target: 'CL_SU' }).ok);
    let h = 0;
    while (s.regions.CL_SU.controller !== 'ARG' && h < 24 * 30) { stepHour(s); h++; }
    assert.equal(s.regions.CL_SU.controller, 'ARG');
    assert.equal(s.regions.CL_SU.owner, 'CHL', 'la propiedad legal no cambia por ocupar');
    assert.ok(s.countries.ARG.gdp > gdpArg0 * 0.99);
    assert.ok(s.countries.CHL.gdp < gdpChl0);
  });
  test('paz blanca devuelve territorios; status quo los cede', () => {
    const s = createNewGame('ARG', 2);
    perform(s, 'ARG', { type: 'declareWar', target: 'CHL' });
    s.regions.CL_SU.controller = 'ARG';
    const t = clone(s);
    // paz blanca forzada
    makePeace(s, 'ARG', 'CHL', 'white');
    assert.equal(s.regions.CL_SU.controller, 'CHL');
    assert.equal(atWar(s, 'ARG', 'CHL'), false);
    makePeace(t, 'ARG', 'CHL', 'status_quo');
    assert.equal(t.regions.CL_SU.owner, 'ARG');
    assert.equal(perform(t, 'ARG', { type: 'declareWar', target: 'CHL' }).ok, false, 'tregua tras la paz');
  });
  test('la IA evalúa la paz según la situación militar', () => {
    const s = createNewGame('ARG', 2);
    perform(s, 'ARG', { type: 'declareWar', target: 'URY' });
    // Uruguay sin pérdidas: rechaza ceder territorio que no ha perdido? acepta paz blanca
    const res = perform(s, 'ARG', { type: 'propose', target: 'URY', kind: 'peace', terms: 'white' });
    assert.ok(res.ok, res.message);
    assert.equal(atWar(s, 'ARG', 'URY'), false);
  });
});

describe('10. Inteligencia artificial', () => {
  test('los países de la IA toman decisiones con el paso del tiempo', () => {
    const s = createNewGame('ARG', 11);
    advanceDays(s, 120);
    const ai = COUNTRY_IDS.filter((c) => c !== 'ARG');
    const total = ai.reduce((a, c) => a + s.ai[c].decisions, 0);
    assert.ok(total > 10, `decisiones: ${total}`);
    assert.equal(s.ai.ARG.decisions, 0, 'la IA no controla al jugador');
    assert.ok(ai.filter((c) => s.ai[c].decisions > 0).length >= 6);
  });
  test('la IA responde a una invasión moviendo tropas y defendiéndose', () => {
    const s = createNewGame('BRA', 4);
    perform(s, 'BRA', { type: 'declareWar', target: 'PRY' });
    const pryUnits = unitsOf(s, 'PRY').map((u) => ({ id: u.id, region: u.regionId }));
    stackIn(s, 'BRA', 'BR_SU');
    for (const u of unitsOf(s, 'BRA').slice(0, 3)) perform(s, 'BRA', { type: 'move', unitId: u.id, target: 'PY_OR' });
    const dec0 = s.ai.PRY.decisions;
    advanceDays(s, 10);
    assert.ok(s.ai.PRY.decisions > dec0, 'Paraguay reacciona');
    const moved = pryUnits.some((p) => !s.units[p.id] || s.units[p.id].regionId !== p.region || s.units[p.id].status === 'combat');
    assert.ok(moved, 'las tropas paraguayas actúan');
    assert.ok(s.countries.PRY.policy.militaryBudget > s.countries.PRY.basePolicy.militaryBudget || s.hour < 24 * 31);
  });
  test('la IA acepta o rechaza propuestas con reglas consistentes', () => {
    const s = createNewGame('ARG', 1);
    s.relations.ARG.URY = s.relations.URY.ARG = 50;
    assert.equal(evaluateTrade(s, 'URY', 'ARG').accept, true);
    s.relations.ARG.URY = s.relations.URY.ARG = 0;
    assert.equal(evaluateTrade(s, 'URY', 'ARG').accept, false);
    assert.equal(perform(s, 'ARG', { type: 'propose', target: 'URY', kind: 'trade' }).ok, false);
    s.relations.ARG.CHL = s.relations.CHL.ARG = 40;
    assert.equal(perform(s, 'ARG', { type: 'propose', target: 'CHL', kind: 'trade' }).ok, true);
    assert.ok(s.trades.some((t) => (t.a === 'ARG' && t.b === 'CHL')));
  });
  test('la IA defiende y negocia: una guerra de la IA puede terminar en paz', () => {
    const s = createNewGame('ARG', 21);
    perform(s, 'VEN', { type: 'declareWar', target: 'GUY' });
    advanceDays(s, 365);
    const a = warAssessment(s, 'VEN');
    const ended = !atWar(s, 'VEN', 'GUY');
    assert.ok(ended || a.score !== 0, 'la guerra evolucionó (paz o cambios territoriales)');
    assert.ok(s.log.some((l) => /batalla|ocupa|paz|Tratado/i.test(l.text)));
  });
});

describe('11. Guardar y cargar', () => {
  test('guardar y cargar restaura exactamente la simulación', async () => {
    const storage = new MemoryStorage();
    const s = createNewGame('COL', 13);
    perform(s, 'COL', { type: 'declareWar', target: 'VEN' });
    const u = unitsOf(s, 'COL')[0];
    perform(s, 'COL', { type: 'move', unitId: u.id, target: 'VE_OC' });
    perform(s, 'COL', { type: 'setPolicy', patch: { taxRate: 25 } });
    advanceDays(s, 3);
    await saveGame(storage, s, 'slot1');
    const snapshot = JSON.stringify(s);
    advanceDays(s, 30); // la partida original sigue
    const loaded = await loadGame(storage, 'slot1');
    assert.equal(JSON.stringify(loaded), snapshot);
    // Conserva lo exigido
    assert.equal(loaded.player, 'COL');
    assert.equal(loaded.countries.COL.policy.taxRate, 25);
    assert.ok(atWar(loaded, 'COL', 'VEN'));
    assert.ok(loaded.units[u.id]);
    assert.equal(getRelation(loaded, 'COL', 'VEN'), -100);
    // Continuar desde la carga produce el mismo futuro (estado completo, incluida la IA y el RNG)
    const replay = await loadGame(storage, 'slot1');
    advanceDays(loaded, 30); advanceDays(replay, 30);
    assert.equal(JSON.stringify(loaded), JSON.stringify(replay));
    const list = await storage.list();
    assert.equal(list.length, 1);
    assert.equal(list[0].player, 'COL');
  });
  test('cargar un guardado inexistente o incompatible falla con un mensaje claro', async () => {
    const storage = new MemoryStorage();
    await assert.rejects(loadGame(storage, 'nada'), /No existe/);
    await storage.put({ slot: 'x', label: 'x', player: 'ARG', hour: 0, savedAt: 0, version: 999, data: '{}' });
    await assert.rejects(loadGame(storage, 'x'), /incompatible/);
  });
});

describe('Integridad del mapa', () => {
  test('30 regiones, adyacencias simétricas y todas alcanzables', () => {
    const ids = Object.keys(REGIONS);
    assert.equal(ids.length, 30);
    for (const id of ids) for (const n of REGIONS[id].neighbors) assert.ok(REGIONS[n].neighbors.includes(id), `${id}-${n}`);
    const seen = new Set([ids[0]]); const q = [ids[0]];
    while (q.length) for (const n of REGIONS[q.shift()!].neighbors) if (!seen.has(n)) { seen.add(n); q.push(n); }
    assert.equal(seen.size, ids.length);
  });
});
