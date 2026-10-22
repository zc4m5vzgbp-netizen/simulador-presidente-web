/**
 * MOBILE-001: interacción táctil del mapa en iPhone horizontal.
 * Gestos con toques reales de Chromium (ver touch.ts): arrastre, pellizco,
 * toque, límites del encuadre y disposición de controles y paneles.
 */
import { test, expect, type Page } from '@playwright/test';
import { regionPoint, startGame } from './helpers';
import { Fingers, frames, mapPointAt, mapRect, screenPointOf, viewBox, type Pt } from './touch';

const MIN_W = 120, MAX_W = 1450; // límites de zoom de MapView

test.skip(({ browserName }) => browserName !== 'chromium', 'Los toques reales usan el protocolo de Chromium');

/** Qué tarjeta de selección muestra el panel (o null si ninguna). */
async function selected(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    for (const c of ['region-card', 'units-card', 'city-card', 'crossing-card']) if (document.querySelector(`[data-testid="side"] .${c}`)) return c;
    return null;
  });
}

async function center(page: Page, selector: string): Promise<Pt> {
  const b = (await page.locator(selector).first().boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

const near = (a: Pt, b: Pt, tol: number) => Math.hypot(a.x - b.x, a.y - b.y) <= tol;

/** Fracción de puntos de una rejilla 9×9 sobre el mapa que caen en tierra (regiones o sus marcadores). */
async function landShare(page: Page) {
  return page.evaluate(() => {
    const r = document.querySelector('svg.map')!.getBoundingClientRect();
    let n = 0;
    for (let i = 1; i < 10; i++) for (let j = 1; j < 10; j++) {
      const el = document.elementFromPoint(r.left + (r.width * i) / 10, r.top + (r.height * j) / 10);
      if (el && (el.hasAttribute('data-region') || el.closest('[data-units],[data-city],[data-crossing]'))) n++;
    }
    return n / 81;
  });
}

test('Arrastrar con un dedo mueve el mapa bajo el dedo y no selecciona nada, aunque empiece sobre un marcador', async ({ page }) => {
  await startGame(page, 'ARG');
  const f = await Fingers.on(page);
  const start = await center(page, '[data-units="AR_BA"][data-owner="ARG"] .stack-box');
  const end = { x: start.x - 80, y: start.y - 50 };
  const v0 = await viewBox(page);
  const anchor = await mapPointAt(page, start);
  await f.drag(start, end, 12);
  await frames(page);
  const v1 = await viewBox(page);
  expect(v1.w).toBeCloseTo(v0.w, 6); // el arrastre no cambia el zoom
  // El punto del mapa que estaba bajo el dedo sigue bajo el dedo.
  const now = await screenPointOf(page, anchor);
  expect(near(now, end, 1.5), `ancla en ${JSON.stringify(now)}, dedo en ${JSON.stringify(end)}`).toBe(true);
  expect(await selected(page)).toBeNull();
});

test('Toque: un temblor pequeño del dedo selecciona; un desplazamiento mayor es un arrastre y no selecciona', async ({ page }) => {
  await startGame(page, 'CHL');
  const f = await Fingers.on(page);
  const p = await regionPoint(page, 'CL_NO');
  // 14 px: supera el margen del toque (10 px) → arrastre, sin selección.
  await f.down([p]); await f.move([{ x: p.x + 7, y: p.y }]); await f.move([{ x: p.x + 14, y: p.y }]); await f.up();
  await frames(page);
  expect(await selected(page)).toBeNull();
  // 6 px de temblor: sigue siendo un toque → selecciona la región bajo el dedo.
  const q = await regionPoint(page, 'CL_NO');
  const dx = await page.evaluate(({ x, y }) => (document.elementFromPoint(x + 6, y)?.getAttribute('data-region') === 'CL_NO' ? 6 : -6), q);
  await f.down([q]); await f.move([{ x: q.x + dx / 2, y: q.y + 1 }]); await f.move([{ x: q.x + dx, y: q.y }]); await f.up();
  await expect(page.getByTestId('side').locator('.region-card .rc-name')).toHaveText('Norte Grande');
});

test('Pellizco: zoom centrado en el gesto, el mapa sigue a los dedos y se respetan los límites de zoom', async ({ page }) => {
  await startGame(page, 'ARG');
  const f = await Fingers.on(page);
  const r = await mapRect(page);
  // Centro del gesto fuera del centro del mapa, para comprobar que no se usa el centro de la pantalla.
  const m = { x: r.left + r.width * 0.38, y: r.top + r.height * 0.42 };
  const v0 = await viewBox(page);
  let anchor = await mapPointAt(page, m);
  await f.down([{ x: m.x - 30, y: m.y }, { x: m.x + 30, y: m.y }]);
  await f.slide([{ x: m.x - 30, y: m.y }, { x: m.x + 30, y: m.y }], [{ x: m.x - 90, y: m.y }, { x: m.x + 90, y: m.y }], 10);
  await frames(page);
  const v1 = await viewBox(page);
  expect(v1.w / v0.w).toBeCloseTo(1 / 3, 2); // dedos 3 veces más separados → 3 veces más cerca
  expect(near(await screenPointOf(page, anchor), m, 2), 'el punto bajo el centro del gesto no se mueve').toBe(true);

  // Los dos dedos se desplazan juntos sin cambiar su separación: el mapa los acompaña.
  const m2 = { x: m.x + 50, y: m.y + 30 };
  await f.slide([{ x: m.x - 90, y: m.y }, { x: m.x + 90, y: m.y }], [{ x: m2.x - 90, y: m2.y }, { x: m2.x + 90, y: m2.y }], 10);
  await f.up();
  await frames(page);
  expect((await viewBox(page)).w).toBeCloseTo(v1.w, 3);
  expect(near(await screenPointOf(page, anchor), m2, 2), 'el mapa sigue al centro de los dedos').toBe(true);
  expect(await selected(page)).toBeNull();

  // Límites de zoom. Pellizco vertical: en el iPhone SE el mapa es estrecho y un
  // pellizco horizontal amplio empezaría sobre los botones del mapa.
  const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  const pinchOnce = async (from: number, to: number) => {
    await f.down([{ x: c.x, y: c.y - from }, { x: c.x, y: c.y + from }]);
    await f.slide([{ x: c.x, y: c.y - from }, { x: c.x, y: c.y + from }], [{ x: c.x, y: c.y - to }, { x: c.x, y: c.y + to }], 8);
    await f.up();
    await frames(page);
  };
  await pinchOnce(12, 110); await pinchOnce(12, 110);
  expect((await viewBox(page)).w).toBeCloseTo(MIN_W, 3);
  anchor = await mapPointAt(page, c);
  await pinchOnce(110, 12); await pinchOnce(110, 12); await pinchOnce(110, 12);
  const vMax = await viewBox(page);
  expect(vMax.w).toBeCloseTo(MAX_W, 3);
  expect(await landShare(page)).toBeGreaterThan(0.2); // alejado del todo, el continente sigue a la vista
  expect(await selected(page)).toBeNull();
});

test('De dos dedos a uno: se sigue arrastrando con el dedo que queda, sin saltos ni selección', async ({ page }) => {
  await startGame(page, 'PER');
  const f = await Fingers.on(page);
  const r = await mapRect(page);
  const a = { x: r.left + r.width * 0.4, y: r.top + r.height * 0.5 }, b = { x: a.x + 60, y: a.y };
  await f.down([a, b]);
  await f.slide([a, b], [a, { x: b.x + 40, y: b.y }], 6);
  await f.lift(1); // se levanta un dedo
  await frames(page);
  const anchor = await mapPointAt(page, a);
  const a2 = { x: a.x + 40, y: a.y + 25 };
  await f.slide([a], [a2], 8);
  await frames(page);
  expect(near(await screenPointOf(page, anchor), a2, 1.5), 'el mapa sigue al dedo restante sin saltar').toBe(true);
  await f.up();
  await frames(page);
  expect(await selected(page)).toBeNull();
});

test('Límites del encuadre: arrastres largos en cualquier dirección no pierden el mapa', async ({ page }) => {
  await startGame(page, 'COL');
  const f = await Fingers.on(page);
  const r = await mapRect(page);
  const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  const span = { x: r.width * 0.45, y: r.height * 0.45 };
  for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
    for (let i = 0; i < 6; i++) await f.drag({ x: c.x - sx * span.x, y: c.y - sy * span.y }, { x: c.x + sx * span.x, y: c.y + sy * span.y }, 6);
    await frames(page);
    // Criterio de src/ui/map/bounds.ts: siempre hay país en la zona central de la pantalla.
    const centralLand = await page.evaluate(() => {
      const r = document.querySelector('svg.map')!.getBoundingClientRect();
      for (let i = 4; i <= 16; i++) for (let j = 4; j <= 16; j++) { // 20 %–80 % de cada eje, cada 3 %
        const el = document.elementFromPoint(r.left + (r.width * i) / 20, r.top + (r.height * j) / 20);
        if (el && (el.hasAttribute('data-region') || el.closest('[data-units],[data-city],[data-crossing]'))) return true;
      }
      return false;
    });
    expect(centralLand, `tierra en la zona central tras arrastrar ${sx},${sy}`).toBe(true);
    expect(await landShare(page), `tierra visible tras arrastrar ${sx},${sy}`).toBeGreaterThan(0);
  }
  // En el límite (el último arrastre llevó el dedo hacia arriba a la izquierda),
  // arrastrar en sentido contrario mueve el mapa en el acto (sin "zona muerta").
  const before = await viewBox(page);
  await f.drag({ x: c.x, y: c.y }, { x: c.x + 60, y: c.y + 40 }, 6);
  await frames(page);
  const after = await viewBox(page);
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(20);
  expect(await selected(page)).toBeNull();
});

test('Gesto cancelado por el sistema: no selecciona y el siguiente toque funciona', async ({ page }) => {
  await startGame(page, 'CHL');
  const f = await Fingers.on(page);
  const p = await regionPoint(page, 'CL_NO');
  await f.down([p]);
  await f.cancel();
  await frames(page);
  expect(await selected(page)).toBeNull();
  await f.down([p]); await f.up();
  await expect(page.getByTestId('side').locator('.region-card .rc-name')).toHaveText('Norte Grande');
});

test('Marcadores: zona táctil de al menos 44 px; tocar su borde selecciona los batallones', async ({ page }) => {
  await startGame(page, 'BRA');
  const f = await Fingers.on(page);
  const hit = (await page.locator('[data-units="BR_CO"][data-owner="BRA"] .stack-hit').boundingBox())!;
  const box = (await page.locator('[data-units="BR_CO"][data-owner="BRA"] .stack-box').boundingBox())!;
  expect(Math.min(hit.width, hit.height)).toBeGreaterThanOrEqual(43.5);
  // Fuera del dibujo del marcador pero dentro de su zona táctil (encima de la caja).
  const p = { x: box.x + box.width / 2, y: box.y - 6 };
  const inStack = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-units]')?.getAttribute('data-units'), p);
  expect(inStack).toBe('BR_CO');
  await f.down([p]); await f.up();
  await expect(page.getByTestId('side').locator('.units-card .rc-owner')).toContainText('Brasil');
});

/** Comprueba que el centro de cada elemento recibe el toque (nada lo tapa). */
async function uncovered(page: Page, selector: string) {
  return page.evaluate((sel) => [...document.querySelectorAll(sel)].map((el) => {
    const b = el.getBoundingClientRect();
    const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return { name: el.getAttribute('aria-label') ?? el.className.toString(), ok: !!top && (top === el || el.contains(top)) };
  }), selector);
}

type R = { left: number; top: number; right: number; bottom: number };
const rect = (page: Page, sel: string) => page.evaluate((s) => {
  const e = document.querySelector(s);
  if (!e) return null;
  const b = e.getBoundingClientRect();
  return { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
}, sel) as Promise<R | null>;
const intersects = (a: R, b: R) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
const inside = (a: R, b: R) => a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5;

async function expectCriticalUsable(page: Page, label: string) {
  for (const u of await uncovered(page, '.map-ctl button, [data-action="toggle-panel"], .order-banner button')) expect(u.ok, `${label}: "${u.name}" tapado`).toBe(true);
  const stage = (await rect(page, '.stage'))!;
  const handle = (await rect(page, '[data-action="toggle-panel"]'))!;
  const handleZone = { ...handle, left: handle.left - 14 }; // zona táctil ampliada del tirador
  const ctl = (await rect(page, '.map-ctl'))!;
  expect(inside(ctl, stage), `${label}: controles dentro del mapa`).toBe(true);
  const side = await rect(page, '[data-testid="side"]');
  if (side) expect(intersects(side, stage), `${label}: el panel no se superpone al mapa`).toBe(false);
  for (const sel of ['.layer-menu', '.order-banner', '.minimap']) {
    const b = await rect(page, sel);
    if (!b) continue;
    expect(inside(b, stage), `${label}: ${sel} entero dentro del mapa`).toBe(true);
    expect(intersects(b, handleZone), `${label}: ${sel} no tapa el tirador del panel`).toBe(false);
    expect(intersects(b, ctl), `${label}: ${sel} no tapa los controles`).toBe(false);
  }
  const menu = page.locator('.layer-menu');
  if (await menu.count()) {
    const clip = await menu.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(clip, `${label}: contenido del menú de capas sin cortar`).toBeLessThanOrEqual(1);
    const mini = await rect(page, '.minimap');
    if (mini) expect(intersects(mini, (await rect(page, '.layer-menu'))!), `${label}: menú y minimapa no se tapan`).toBe(false);
  }
}

test('Horizontal: controles, menú de capas, minimapa y aviso de orden no tapan elementos críticos', async ({ page }) => {
  await startGame(page, 'ARG');
  await expectCriticalUsable(page, 'inicio');
  await page.getByRole('button', { name: 'Capas del mapa' }).tap();
  await expect(page.locator('.layer-menu')).toBeVisible();
  await expectCriticalUsable(page, 'menú de capas');
  // Las casillas del menú siguen siendo utilizables.
  await page.locator('label[for="layer-cities"]').tap();
  await expect(page.locator('#layer-cities')).not.toBeChecked();
  await page.locator('label[for="layer-cities"]').tap();
  await expect(page.locator('#layer-cities')).toBeChecked();
  await page.locator('[data-action="minimap"]').tap();
  await expectCriticalUsable(page, 'menú de capas + minimapa');
  await page.getByRole('button', { name: 'Capas del mapa' }).tap();
  await expect(page.locator('.layer-menu')).toHaveCount(0);
  await expect(page.locator('.minimap')).toBeVisible(); // el minimapa vuelve al cerrar el menú
  await expectCriticalUsable(page, 'minimapa');
  await page.locator('[data-action="minimap"]').tap();
  // Aviso de orden de marcha.
  await page.locator('[data-units="AR_BA"][data-owner="ARG"]').tap();
  await page.locator('[data-action="move"]').tap();
  await expect(page.locator('.order-banner')).toBeVisible();
  await expectCriticalUsable(page, 'orden de marcha');
  await page.locator('.order-banner button').tap();
  await expect(page.locator('.order-banner')).toHaveCount(0);
  // Panel contraído.
  await page.locator('[data-action="toggle-panel"]').tap();
  await expect(page.getByTestId('side')).toHaveCount(0);
  await expectCriticalUsable(page, 'panel contraído');
});

test('Panel: se cierra con el tirador, un toque en el mapa lo reabre y el tirador evita la zona insegura (margen simulado)', async ({ page }) => {
  await startGame(page, 'CHL');
  const f = await Fingers.on(page);
  // iOS informa ~59 px de margen seguro lateral en un iPhone 15 Pro Max horizontal.
  // La emulación no lo aplica, así que se simula fijando la variable CSS que usa la interfaz.
  await page.evaluate(() => document.documentElement.style.setProperty('--safe-r', '59px'));
  const handle = page.locator('[data-action="toggle-panel"]');
  await handle.tap();
  await expect(page.getByTestId('side')).toHaveCount(0);
  const vw = page.viewportSize()!.width;
  const hb = (await handle.boundingBox())!;
  expect(hb.x + hb.width, 'tirador fuera del margen seguro').toBeLessThanOrEqual(vw - 59 + 0.5);
  expect((await uncovered(page, '[data-action="toggle-panel"]'))[0].ok).toBe(true);
  // Un toque real sobre una región reabre el panel con su tarjeta.
  const p = await regionPoint(page, 'CL_NO');
  await f.down([p]); await f.up();
  await expect(page.getByTestId('side').locator('.region-card .rc-name')).toHaveText('Norte Grande');
  await handle.tap();
  await expect(page.getByTestId('side')).toHaveCount(0);
  await handle.tap();
  await expect(page.getByTestId('side')).toBeVisible();
});
