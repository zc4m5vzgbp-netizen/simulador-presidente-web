/** MIL Fase 2: pruebas de aceptación del combate terrestre, suministros, retirada, ocupación, ataque directo y guardado v3. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createNewGame } from '../src/engine/setup';
import { advanceDays, advanceHours, stepHour } from '../src/engine/time';
import { perform } from '../src/engine/actions';
import { etaHours, unitsIn, unitsOf } from '../src/engine/military';
import { atWar, hourlyCombat } from '../src/engine/war';
import { applyDamage, combatPower, dailySupplyAndRepair, marchSpeedFactor, powerBreakdown } from '../src/engine/combat';
import { equipmentLedger, initialEquipment, initialInventory } from '../src/engine/equipment';
import { getRelation } from '../src/engine/diplomacy';
import { COMBAT, SUPPLY } from '../src/data/military';
import { COUNTRY_IDS } from '../src/data/regionDefs';
import { MemoryStorage, loadGame, saveGame } from '../src/persistence/saves';
import { SAVE_VERSION, type CountryId, type GameState, type Unit } from '../src/engine/types';

const clone = (s: GameState): GameState => JSON.parse(JSON.stringify(s));
function calm(s: GameState) { for (const c of COUNTRY_IDS) s.ai[c].aggression = 0; return s; }
function stackIn(s: GameState, c: CountryId, regionId: string, n = Infinity) {
  for (const u of unitsOf(s, c).slice(0, n)) { u.regionId = regionId; u.path = []; u.status = 'idle'; u.destination = null; }
}
/** ARG ataca Uruguay: todos los batallones argentinos marchan contra los uruguayos. */
function battleScenario(seed: number) {
  const s = calm(createNewGame('ARG', seed));
  s.countries.ARG.autoReplenish = false; s.countries.URY.autoReplenish = false;
  perform(s, 'ARG', { type: 'declareWar', target: 'URY' });
  stackIn(s, 'ARG', 'AR_NE');
  stackIn(s, 'URY', 'UY');
  for (const u of unitsOf(s, 'ARG')) perform(s, 'ARG', { type: 'move', unitId: u.id, target: 'UY' });
  return s;
}
/** Ambos bandos ya en la misma región: el combate empieza en la primera hora. */
function faceOff(seed: number, region = 'UY') {
  const s = calm(createNewGame('ARG', seed));
  perform(s, 'ARG', { type: 'declareWar', target: 'URY' });
  stackIn(s, 'ARG', region, 2);
  stackIn(s, 'URY', region);
  return s;
}
const strip = (s: GameState) => JSON.stringify(s, (k, v) => (k === 'org' || k === 'morale' ? undefined : v));

describe('F2-001 A: sin bonificación defensiva', () => {
  test('mismo resultado sea quien sea el controlador de la región', () => {
    const a = faceOff(11), b = clone(a);
    b.regions.UY.controller = 'ARG'; // el atacante pasa a "defender" la región
    for (let h = 0; h < 12; h++) { hourlyCombat(a); hourlyCombat(b); }
    assert.deepEqual(a.battles.UY.losses, b.battles.UY.losses);
    assert.deepEqual(a.battles.UY.tally, b.battles.UY.tally);
    for (const id of Object.keys(a.units)) assert.equal(a.units[id].men, b.units[id].men);
  });
});

describe('F2-002 A: sin moral ni organización', () => {
  test('los batallones no tienen moral ni organización', () => {
    const s = createNewGame('PER', 1);
    for (const u of Object.values(s.units)) { assert.ok(!('org' in u)); assert.ok(!('morale' in u)); }
  });
  test('la estabilidad nacional no cambia la potencia, la marcha ni el combate', () => {
    const a = faceOff(5), b = clone(a);
    b.countries.ARG.stability = 3; b.countries.URY.stability = 99;
    const u = unitsOf(a, 'ARG')[0];
    assert.equal(combatPower(a, u), combatPower(b, b.units[u.id]));
    for (let h = 0; h < 24; h++) { hourlyCombat(a); hourlyCombat(b); }
    assert.deepEqual(a.battles.UY.losses, b.battles.UY.losses);
  });
  test('campos heredados de moral/organización inyectados no alteran la simulación', () => {
    const a = battleScenario(9), b = clone(a);
    for (const u of Object.values(b.units) as (Unit & { org?: number; morale?: number })[]) { u.org = 0; u.morale = 0; }
    advanceDays(a, 6); advanceDays(b, 6);
    assert.equal(strip(a), strip(b));
  });
});

describe('Potencia y equipo', () => {
  test('el equipo sin tripulación no aporta potencia', () => {
    const s = createNewGame('CHL', 1);
    const u = unitsOf(s, 'CHL')[0];
    u.men = 80; u.equipment = { 'CHL-T1': 20 }; // 80 efectivos = tripulación justa para 20 tanques
    const withTanks = powerBreakdown(s, u);
    u.equipment = { 'CHL-T1': 40 }; // el doble de tanques, misma tripulación disponible
    assert.equal(powerBreakdown(s, u).vehicles, withTanks.vehicles);
  });
  test('los dañados no combaten: pasarlos a dañados reduce la potencia', () => {
    const s = createNewGame('BRA', 1);
    const u = unitsOf(s, 'BRA')[0];
    const p0 = combatPower(s, u);
    u.damaged = { ...u.equipment }; u.equipment = {};
    assert.ok(combatPower(s, u) < p0);
  });
  test('la calidad del país no interviene en la potencia (tecnología uniforme provisional)', () => {
    const s = createNewGame('BRA', 1), t = clone(s);
    t.countries.BRA.armyQuality = 0.1;
    const u = unitsOf(s, 'BRA')[0];
    assert.equal(combatPower(s, u), combatPower(t, t.units[u.id]));
  });
});

describe('Bajas humanas y materiales', () => {
  test('una batalla produce bajas humanas y vehículos dañados y destruidos, contados por separado', () => {
    const s = battleScenario(3);
    for (let h = 0; h < 24 * 12 && !s.battleReports.length; h++) stepHour(s);
    const r = s.battleReports[0] ?? s.battles.UY;
    assert.ok(r, 'hubo batalla');
    const sum = (o: object) => Object.values(o).reduce((x: number, y) => x + (y as number), 0);
    assert.ok((r.losses.ARG ?? 0) > 0 && (r.losses.URY ?? 0) > 0);
    const dmg = sum(r.tally.ARG!.damaged) + sum(r.tally.URY!.damaged);
    const des = sum(r.tally.ARG!.destroyed) + sum(r.tally.URY!.destroyed);
    assert.ok(dmg > 0 && des > 0, `dañados ${dmg}, destruidos ${des}`);
    assert.ok(r.tally.ARG!.ammo > 0 && r.tally.ARG!.fuel > 0, 'consumo registrado');
    assert.ok(r.timeline.length > 0, 'evolución registrada');
  });
});

describe('Contabilidad de equipo (invariantes por país y modelo)', () => {
  test('en una guerra larga con reposición, reparación, destrucción y desmovilización no se crea ni se pierde equipo sin registro', () => {
    const s = calm(createNewGame('ARG', 21));
    const before = Object.fromEntries(COUNTRY_IDS.map((c) => [c, equipmentLedger(s, c)]));
    perform(s, 'ARG', { type: 'declareWar', target: 'URY' });
    perform(s, 'BRA', { type: 'declareWar', target: 'PRY' });
    stackIn(s, 'ARG', 'AR_NE'); stackIn(s, 'URY', 'UY');
    for (const u of unitsOf(s, 'ARG')) perform(s, 'ARG', { type: 'move', unitId: u.id, target: 'UY' });
    for (let d = 0; d < 40; d++) {
      advanceDays(s, 1);
      if (d === 20) { const u = unitsOf(s, 'ARG')[0]; if (u) perform(s, 'ARG', { type: 'disband', unitId: u.id }); }
      for (const c of COUNTRY_IDS) assert.deepEqual(equipmentLedger(s, c), before[c], `día ${d} ${c}`);
    }
    assert.ok(Object.values(s.countries).some((c) => Object.keys(c.equipmentLost).length), 'hubo pérdidas registradas');
  });
  test('la reparación pasa vehículos de dañados a operativos sin crear ninguno', () => {
    const s = createNewGame('CHL', 1);
    const u = unitsOf(s, 'CHL')[0];
    u.damaged = { 'CHL-T1': 8 }; u.equipment['CHL-T1'] -= 8;
    const before = equipmentLedger(s, 'CHL');
    dailySupplyAndRepair(s);
    assert.ok(u.damaged['CHL-T1'] === undefined || u.damaged['CHL-T1'] < 8);
    assert.deepEqual(equipmentLedger(s, 'CHL'), before);
  });
  test('sin presupuesto suficiente no se repara', () => {
    const s = createNewGame('CHL', 1);
    const u = unitsOf(s, 'CHL')[0];
    u.damaged = { 'CHL-T1': 4 }; u.equipment['CHL-T1'] -= 4;
    s.countries.CHL.supplyRatio = 0.2;
    dailySupplyAndRepair(s);
    assert.equal(u.damaged['CHL-T1'], 4);
  });
});

describe('Suministros y escasez', () => {
  test('sin munición la potencia cae al mínimo; sin combustible caen los vehículos y la marcha se ralentiza', () => {
    const s = calm(createNewGame('ARG', 2));
    const u = unitsOf(s, 'ARG').find((x) => x.regionId === 'AR_BA')!;
    const full = powerBreakdown(s, u);
    u.ammo = 0;
    assert.ok(Math.abs(combatPower(s, u) - full.total * SUPPLY.ammoFloor) < 1e-9);
    u.ammo = 1;
    perform(s, 'ARG', { type: 'move', unitId: u.id, target: 'AR_PA' });
    s.countries.ARG.supplyRatio = 0; // sin reabastecimiento durante la marcha
    const eta = etaHours(s, u);
    u.fuel = 0;
    assert.ok(powerBreakdown(s, u).total < full.total);
    assert.equal(marchSpeedFactor(u), SUPPLY.fuelSpeedFloor, 'sin combustible se marcha a pie, a la mitad de velocidad');
    assert.ok(etaHours(s, u) > eta, 'y la llegada se retrasa');
  });
  test('un presupuesto militar insuficiente reduce la potencia (mantenimiento)', () => {
    const s = createNewGame('ARG', 2);
    const u = unitsOf(s, 'ARG')[0];
    s.countries.ARG.supplyRatio = 1;
    const p = combatPower(s, u);
    s.countries.ARG.supplyRatio = 0.3;
    assert.ok(Math.abs(combatPower(s, u) - p * (COMBAT.maintenanceMin + (1 - COMBAT.maintenanceMin) * 0.3)) < 1e-9);
  });
  test('el combate consume munición y fuera de combate se reabastece', () => {
    const s = faceOff(4);
    for (let h = 0; h < 10; h++) hourlyCombat(s);
    const u = unitsIn(s, 'UY').find((x) => x.owner === 'ARG')!;
    assert.ok(u.ammo < 1);
    const a = u.ammo;
    u.status = 'idle';
    dailySupplyAndRepair(s);
    assert.ok(u.ammo > a);
  });
});

describe('Retirada', () => {
  test('retirada automática por pérdidas graves, sin moral ni organización', () => {
    const s = faceOff(6);
    const weak = unitsIn(s, 'UY').find((x) => x.owner === 'URY')!;
    for (let h = 0; h < 24 * 6 && s.units[weak.id] && s.units[weak.id].status !== 'retreating'; h++) hourlyCombat(s);
    if (s.units[weak.id]) {
      assert.equal(s.units[weak.id].status, 'retreating');
      const entry = [...s.battleReports, ...Object.values(s.battles)].map((b) => b.entry[weak.id]).find(Boolean)!;
      const vehLoss = entry.vehicles >= COMBAT.retreatMinVehicles;
      assert.ok((entry.men - s.units[weak.id].men) / entry.men >= COMBAT.retreatMenLoss || vehLoss);
    } else {
      assert.ok(s.log.some((l) => /destruido|se rinde/.test(l.text)), 'si no se retira, fue destruido o se rindió');
    }
  });
  test('retirada manual en combate; fuera de combate se rechaza', () => {
    const s = calm(createNewGame('ARG', 8));
    perform(s, 'ARG', { type: 'declareWar', target: 'CHL' });
    stackIn(s, 'ARG', 'AR_PA', 1); stackIn(s, 'CHL', 'AR_PA', 1);
    const idle = unitsOf(s, 'ARG')[1];
    assert.equal(perform(s, 'ARG', { type: 'retreat', unitId: idle.id }).ok, false);
    hourlyCombat(s);
    const u = unitsOf(s, 'ARG')[0];
    assert.equal(u.status, 'combat');
    const res = perform(s, 'ARG', { type: 'retreat', unitId: u.id });
    assert.ok(res.ok, res.message);
    assert.equal(s.units[u.id].status, 'retreating');
  });
});

describe('Ocupación y economía', () => {
  test('el territorio ocupado rinde al 100 % para quien lo controla (MIL-085 A)', () => {
    const s = calm(createNewGame('ARG', 2));
    perform(s, 'ARG', { type: 'declareWar', target: 'CHL' });
    stackIn(s, 'CHL', 'CL_CE');
    const u = unitsOf(s, 'ARG')[0]; u.regionId = 'AR_PA';
    const gdp0 = s.countries.ARG.gdp, region = s.regions.CL_SU.gdp;
    perform(s, 'ARG', { type: 'move', unitId: u.id, target: 'CL_SU' });
    for (let h = 0; h < 24 * 30 && s.regions.CL_SU.controller !== 'ARG'; h++) stepHour(s);
    assert.equal(s.regions.CL_SU.controller, 'ARG');
    assert.equal(s.regions.CL_SU.owner, 'CHL');
    // El PIB de Argentina sube exactamente lo que rinde la región (más su propia evolución mensual, nula si no hubo cierre).
    const expected = Object.values(s.regions).filter((r) => r.controller === 'ARG').reduce((x, r) => x + r.gdp, 0);
    assert.ok(Math.abs(s.countries.ARG.gdp - expected) < 1e-6);
    assert.ok(s.countries.ARG.gdp >= gdp0 + region * 0.95);
  });
});

describe('Ataque directo (MIL-082 B)', () => {
  test('atacar sin declarar inicia la guerra, con más coste diplomático que una declaración', () => {
    const s = calm(createNewGame('ARG', 2)), d = clone(s);
    const ids = unitsOf(s, 'ARG').map((u) => u.id);
    const res = perform(s, 'ARG', { type: 'directAttack', unitIds: ids, target: 'UY' });
    assert.ok(res.ok, res.message);
    assert.ok(atWar(s, 'ARG', 'URY'));
    assert.match(s.wars[0].name, /Ataque/);
    assert.ok(unitsOf(s, 'ARG').some((u) => u.destination === 'UY'));
    perform(d, 'ARG', { type: 'declareWar', target: 'URY' });
    assert.ok(getRelation(s, 'BRA', 'ARG') < getRelation(d, 'BRA', 'ARG'));
    assert.ok(s.countries.ARG.stability < d.countries.ARG.stability);
  });
  test('no se puede atacar a quien ya está en guerra contigo ni durante una tregua', () => {
    const s = calm(createNewGame('ARG', 2));
    const ids = unitsOf(s, 'ARG').map((u) => u.id);
    perform(s, 'ARG', { type: 'declareWar', target: 'URY' });
    assert.equal(perform(s, 'ARG', { type: 'directAttack', unitIds: ids, target: 'UY' }).ok, false);
    s.truces['ARG:CHL'] = s.hour + 1000;
    assert.equal(perform(s, 'ARG', { type: 'directAttack', unitIds: ids, target: 'CL_SU' }).ok, false);
  });
});

describe('Combate conjunto', () => {
  test('varios batallones combaten juntos sin fusionarse: identidad, equipo y pérdidas propias', () => {
    const s = faceOff(12);
    const mine = unitsIn(s, 'UY').filter((u) => u.owner === 'ARG');
    assert.equal(mine.length, 2);
    for (let h = 0; h < 18; h++) hourlyCombat(s);
    const b = s.battles.UY ?? s.battleReports.at(-1)!;
    for (const u of mine) assert.ok(b.entry[u.id], 'cada batallón tiene su entrada');
    const alive = mine.filter((u) => s.units[u.id]);
    assert.ok(alive.length >= 1);
    if (alive.length === 2) assert.notEqual(JSON.stringify(alive[0].equipment) + alive[0].men, JSON.stringify(alive[1].equipment) + alive[1].men);
  });
});

describe('Determinismo y guardado durante la batalla', () => {
  test('misma semilla y mismas órdenes, mismo resultado', () => {
    const a = battleScenario(9), b = battleScenario(9);
    advanceDays(a, 10); advanceDays(b, 10);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });
  test('guardar y cargar a mitad de una batalla no cambia lo que sucede después', async () => {
    const a = battleScenario(13);
    for (let h = 0; h < 24 * 10 && !Object.keys(a.battles).length; h++) stepHour(a);
    advanceHours(a, 5);
    assert.ok(Object.keys(a.battles).length, 'hay una batalla en curso');
    const st = new MemoryStorage();
    await saveGame(st, a, '1');
    const b = await loadGame(st, '1');
    advanceHours(a, 72); advanceHours(b, 72);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });
});

describe('Guardado v3 y migraciones', () => {
  test('partida nueva: v3 con los campos de la Fase 2', () => {
    const s = createNewGame('ECU', 1);
    assert.equal(s.version, 3); assert.equal(SAVE_VERSION, 3);
    assert.deepEqual(s.battleReports, []);
    for (const u of Object.values(s.units)) { assert.deepEqual(u.damaged, {}); assert.equal(u.fuel, 1); assert.equal(u.ammo, 1); }
  });
  test('v2 de la Fase 1 con guerra, batalla y ocupaciones en curso: migra sin perder nada y sigue', async () => {
    const record = JSON.parse(readFileSync(new URL('./fixtures/save-v2-fase1-guerra.json', import.meta.url), 'utf8'));
    assert.equal(record.version, 2);
    const raw = JSON.parse(record.data);
    const st = new MemoryStorage();
    await st.put(record);
    const s = await loadGame(st, record.slot);
    assert.equal(s.version, 3);
    // Guerras, batallas, ocupaciones, economía, posiciones y órdenes intactas.
    assert.deepEqual(s.wars, raw.wars);
    assert.deepEqual(Object.keys(s.battles), Object.keys(raw.battles));
    for (const r of Object.values(raw.regions) as { id: string; owner: string; controller: string; gdp: number }[]) {
      assert.equal(s.regions[r.id].controller, r.controller); assert.equal(s.regions[r.id].owner, r.owner); assert.equal(s.regions[r.id].gdp, r.gdp);
    }
    for (const c of COUNTRY_IDS) { assert.equal(s.countries[c].reserves, raw.countries[c].reserves); assert.equal(s.countries[c].debt, raw.countries[c].debt); }
    for (const [id, u] of Object.entries(raw.units) as [string, Unit][]) {
      const m = s.units[id];
      assert.equal(m.men, u.men); assert.equal(m.regionId, u.regionId); assert.deepEqual(m.path, u.path); assert.equal(m.destination, u.destination);
      assert.deepEqual(m.equipment, u.equipment);
      assert.ok(!('org' in m) && !('morale' in m));
    }
    // La batalla en curso conoce a sus batallones.
    const b = Object.values(s.battles)[0];
    assert.ok(Object.keys(b.entry).length > 0);
    // Equipo por modelo: el mismo total antes y después.
    for (const c of COUNTRY_IDS) {
      const t: Record<string, number> = { ...raw.countries[c].inventory };
      for (const u of Object.values(raw.units) as Unit[]) if (u.owner === c) for (const [id, q] of Object.entries(u.equipment)) t[id] = (t[id] ?? 0) + q;
      for (const id of Object.keys(t)) if (!t[id]) delete t[id];
      assert.deepEqual(equipmentLedger(s, c), t, c);
    }
    assert.equal((await st.get(record.slot))!.version, 2, 'la ranura no se reescribe al cargar');
    advanceDays(s, 5);
    assert.equal(s.hour, raw.hour + 120);
  });
  test('v1 (beta 1.0) migra a v3 en cadena sin duplicar equipo', async () => {
    const record = JSON.parse(readFileSync(new URL('./fixtures/save-v1-beta1.json', import.meta.url), 'utf8'));
    const raw = JSON.parse(record.data);
    const st = new MemoryStorage();
    await st.put(record);
    const s = await loadGame(st, record.slot);
    assert.equal(s.version, 3);
    for (const c of COUNTRY_IDS) {
      const n = Object.values(raw.units as Record<string, Unit>).filter((u) => u.owner === c).length;
      const expect: Record<string, number> = { ...initialInventory(c, Math.max(1, n)) };
      for (const [id, q] of Object.entries(initialEquipment(c))) expect[id] = (expect[id] ?? 0) + q * n;
      for (const id of Object.keys(expect)) if (!expect[id]) delete expect[id];
      assert.deepEqual(equipmentLedger(s, c), expect, c);
    }
  });
});

describe('Revisión F2 (incidencia F2-INC-01 y observaciones)', () => {
  test('ETA exacta: coincide hora a hora con la llegada real, también con poco combustible', () => {
    // Presupuesto militar real (política): el abastecimiento lo calcula la economía cada día.
    for (const [fuel, militaryBudget] of [[1, undefined], [0.25, 0.2], [0.05, 0.2]] as const) {
      const s = calm(createNewGame('ARG', 31));
      if (militaryBudget !== undefined) perform(s, 'ARG', { type: 'setPolicy', patch: { militaryBudget } });
      advanceHours(s, 24); // el cierre diario aplica el nuevo presupuesto al abastecimiento
      const u = unitsOf(s, 'ARG').find((x) => x.regionId === 'AR_BA')!;
      u.fuel = fuel;
      assert.ok(perform(s, 'ARG', { type: 'move', unitId: u.id, target: 'AR_PA' }).ok);
      const eta = etaHours(s, u);
      let h = 0;
      while (s.units[u.id].regionId !== 'AR_PA' && h < 24 * 60) { stepHour(s); h++; }
      assert.equal(h, eta, `combustible ${fuel}, presupuesto ${militaryBudget ?? 'inicial'}`);
    }
  });
  test('la ETA tiene en cuenta que el combustible se agota durante la marcha', () => {
    const s = calm(createNewGame('ARG', 31));
    const u = unitsOf(s, 'ARG').find((x) => x.regionId === 'AR_BA')!;
    perform(s, 'ARG', { type: 'move', unitId: u.id, target: 'AR_PA' });
    s.countries.ARG.supplyRatio = 0;
    const full = etaHours(s, u);
    u.fuel = 0.21; // empieza justo por encima de la escasez y se agota por el camino
    assert.ok(etaHours(s, u) > full);
  });
  test('los impactos solo alcanzan a vehículos operativos y tripulados', () => {
    const s = createNewGame('CHL', 3);
    const u = unitsOf(s, 'CHL')[0];
    u.men = 3; // sin tripulación para ningún vehículo: todo el equipo está inactivo
    const before = JSON.stringify([u.equipment, u.damaged]);
    for (let i = 0; i < 50; i++) { u.men = 3; applyDamage(s, u, 30); }
    assert.equal(JSON.stringify([u.equipment, u.damaged]), before, 'el equipo sin tripulación no recibe impactos');
    const v = unitsOf(s, 'CHL')[1];
    for (let i = 0; i < 40; i++) { v.men = 1000; applyDamage(s, v, 30); }
    assert.ok(Object.keys(v.damaged).length + Object.keys(s.countries.CHL.equipmentLost).length > 0, 'el equipo tripulado sí');
  });
});
