/**
 * MOBILE-001: límites del encuadre del mapa (src/ui/map/bounds.ts).
 * Lógica pura: no necesita navegador.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { clampView, clampW, landInView, MIN_W, MAX_W, type View } from '../src/ui/map/bounds';
import { MAP, REGIONS } from '../src/engine/world';

const ASPECTS = [264 / 252, 324 / 496, 320 / 568, 380 / 814]; // mapa del iPhone SE / 15 Pro Max, con y sin panel
const center = (v: View, a: number) => [v.x + v.w / 2, v.y + (v.w * a) / 2];

describe('Encuadre del mapa (MOBILE-001)', () => {
  test('el zoom queda entre MIN_W y MAX_W', () => {
    assert.equal(clampW(10), MIN_W);
    assert.equal(clampW(1e6), MAX_W);
    assert.equal(clampW(500), 500);
  });

  test('un encuadre sobre tierra no se modifica', () => {
    for (const a of ASPECTS) {
      for (const r of Object.values(REGIONS)) {
        for (const w of [MIN_W, 400, MAX_W]) {
          const v = { x: r.anchor[0] - w / 2, y: r.anchor[1] - (w * a) / 2, w };
          assert.deepEqual(clampView(v, a), v, `${r.id} w=${w}`);
        }
      }
    }
  });

  test('desde cualquier punto lejano, el resultado siempre muestra tierra en su zona central', () => {
    let n = 0;
    for (const a of ASPECTS) {
      for (const w of [MIN_W, 250, 500, 900, MAX_W]) {
        for (let gx = -3; gx <= 4; gx++) {
          for (let gy = -3; gy <= 4; gy++) {
            const cx = (gx * MAP.width) / 2, cy = (gy * MAP.height) / 2;
            const v = clampView({ x: cx - w / 2, y: cy - (w * a) / 2, w }, a);
            assert.ok(landInView(v, a), `sin tierra: a=${a.toFixed(2)} w=${w} desde ${cx},${cy}`);
            assert.equal(v.w, w);
            n++;
          }
        }
      }
    }
    assert.ok(n > 1000);
  });

  test('arrastre continuo: idempotente, sin saltos y sin zona muerta al invertir el sentido', () => {
    // Como en MapView: cada paso de arrastre parte del encuadre ya corregido.
    for (const a of ASPECTS) {
      for (const w of [MIN_W, 300, 700]) {
        for (const [dx, dy] of [[6, 0], [-6, 0], [0, 6], [0, -6], [5, 7], [-5, -7], [7, -5], [-7, 5]]) {
          const r = REGIONS.BR_CO.anchor;
          let v: View = { x: r[0] - w / 2, y: r[1] - (w * a) / 2, w };
          for (let i = 0; i < 600; i++) {
            const next = clampView({ ...v, x: v.x + dx, y: v.y + dy }, a);
            assert.deepEqual(clampView(next, a), next, 'idempotente');
            const [c0, c1] = [center(v, a), center(next, a)];
            // Contra una costa inclinada el encuadre se desliza a lo largo de ella: puede avanzar
            // algo más que el paso, pero nunca da un salto (límite: el doble del paso).
            assert.ok(Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) <= 2 * Math.hypot(dx, dy), `salto: a=${a.toFixed(2)} w=${w} paso ${i}`);
            assert.ok(landInView(next, a), 'tierra a la vista');
            v = next;
          }
          // En el límite: un paso en sentido contrario mueve el encuadre exactamente ese paso.
          const back = clampView({ ...v, x: v.x - dx, y: v.y - dy }, a);
          assert.ok(Math.abs(back.x - (v.x - dx)) < 1e-6 && Math.abs(back.y - (v.y - dy)) < 1e-6, `zona muerta: a=${a.toFixed(2)} w=${w} ${dx},${dy}`);
        }
      }
    }
  });
});
