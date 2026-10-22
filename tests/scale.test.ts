/**
 * ATLAS-001: escalas del mapa (Continente / Nación / Región) y simbología militar.
 * Lógica pura: no necesita navegador.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { bandOf, BAND_K, DETAIL, nationView, viewForBand } from '../src/ui/map/scale';
import { MAX_W, MIN_W } from '../src/ui/map/bounds';
import { CATEGORIES, ECHELON_MARK, affiliationOf, frameFor, glyphFor, strengthLabel, unitCategory, type Affiliation, type Domain } from '../src/ui/military/symbology';
import { COUNTRY_IDS } from '../src/data/regionDefs';
import { createNewGame } from '../src/engine/setup';
import { AIRPORTS } from '../src/atlas';

const ASPECTS = [264 / 252, 324 / 496, 320 / 568, 380 / 814];

describe('Escalas del mapa', () => {
  test('bandas por densidad: contiguas y coherentes en iPhone SE, 15 Pro Max y pantalla ancha', () => {
    for (const sw of [252, 496, 814]) {
      assert.equal(bandOf(sw * (BAND_K.regionBelow - 0.01), sw), 'region');
      assert.equal(bandOf(sw * BAND_K.regionBelow, sw), 'nation');
      assert.equal(bandOf(Math.min(sw * BAND_K.continentFrom, BAND_K.continentW) - 1, sw), 'nation');
      assert.equal(bandOf(MAX_W, sw), 'continent');
    }
    assert.equal(bandOf(MIN_W, 252), 'region');
    assert.equal(bandOf(1300, 1400), 'continent'); // pantalla ancha: el continente entero sigue siendo Continente
  });

  test('cada botón del selector lleva a su propia banda, para los 12 países y varios tamaños de iPhone', () => {
    for (const c of COUNTRY_IDS) for (const a of ASPECTS) for (const sw of [252, 496, 814]) for (const band of ['continent', 'nation', 'region'] as const) {
      const v = viewForBand(band, c, a, sw);
      assert.equal(bandOf(v.w, sw), band, `${c} ${a.toFixed(2)} ${sw}px ${band}: w=${v.w}`);
    }
  });

  test('el encuadre inicial (nación) nunca cae en la banda continental', () => {
    for (const c of COUNTRY_IDS) for (const a of ASPECTS) for (const sw of [252, 496, 814, 1400]) assert.equal(bandOf(nationView(c, a, sw).w, sw), 'nation', `${c} ${sw}`);
  });

  test('menos detalle cuanto más lejos (jerarquía tipo Apple Maps)', () => {
    assert.deepEqual(DETAIL.continent.roads, []);
    assert.deepEqual(DETAIL.nation.roads, ['motorway', 'trunk']);
    assert.deepEqual(DETAIL.region.roads, ['motorway', 'trunk', 'secondary']);
    assert.ok(!DETAIL.continent.states && DETAIL.nation.states && DETAIL.region.states);
    const n = (b: keyof typeof DETAIL) => AIRPORTS.filter(DETAIL[b].facilities).length;
    assert.ok(n('continent') === 0 && n('nation') > 0 && n('nation') < n('region') && n('region') === AIRPORTS.length);
    assert.equal(DETAIL.continent.units, 'country');
    assert.ok(DETAIL.continent.riverRank < DETAIL.nation.riverRank && DETAIL.nation.riverRank < DETAIL.region.riverRank);
  });
});

describe('Simbología militar (preparada para el sistema futuro)', () => {
  test('todas las categorías pedidas existen; solo infantería y formación están hoy en el juego', () => {
    for (const id of ['infantry', 'armored', 'tank', 'artillery', 'air-defense', 'fighter', 'helicopter', 'drone', 'fleet', 'surface-ship', 'submarine', 'formation'] as const) assert.ok(CATEGORIES[id], id);
    assert.deepEqual(Object.values(CATEGORIES).filter((c) => c.inGame).map((c) => c.id).sort(), ['formation', 'infantry']);
  });

  test('cada bando y dominio tiene un marco distinto y cada categoría un glifo', () => {
    const affs: Affiliation[] = ['friend', 'hostile', 'neutral'];
    const doms: Domain[] = ['land', 'air', 'sea', 'subsurface'];
    for (const d of doms) {
      const shapes = affs.map((a) => frameFor(a, d).d);
      assert.equal(new Set(shapes).size, 3, `marcos repetidos en ${d}`);
      assert.equal(frameFor('ally', d).d, frameFor('friend', d).d, 'aliado = forma de amigo');
    }
    for (const c of Object.values(CATEGORIES)) {
      const g = glyphFor(c.id, frameFor('friend', c.domain).inner);
      assert.ok(g.stroke || g.fill, c.id);
    }
    assert.equal(ECHELON_MARK.battalion, 'II');
  });

  test('los batallones actuales se muestran como infantería, sin cambiar el motor', () => {
    const s = createNewGame('VEN', 1);
    for (const u of Object.values(s.units)) assert.equal(unitCategory(u), 'infantry');
    assert.equal(affiliationOf('mine'), 'friend');
    assert.equal(affiliationOf('enemy'), 'hostile');
    assert.equal(affiliationOf('other'), 'neutral');
    assert.equal(strengthLabel(850), '850');
    assert.equal(strengthLabel(4200), '4,2K');
    assert.equal(strengthLabel(12000), '12K');
  });
});
