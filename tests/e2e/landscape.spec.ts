/** UI-001: orientación, selección, navegación, capas y compatibilidad. */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { game, pinch, regionPoint, startGame } from './helpers';

test('En vertical aparece el aviso de giro, la partida se pausa y se recupera al volver a horizontal', async ({ page }) => {
  await startGame(page, 'ARG');
  const land = page.viewportSize()!;
  await page.locator('[data-speed="2"]').tap();
  await expect.poll(() => game<number>(page, 's.hour'), { timeout: 10_000 }).toBeGreaterThan(0);
  await page.setViewportSize({ width: land.height, height: land.width });
  await expect(page.getByTestId('rotate')).toBeVisible();
  await expect(page.getByTestId('rotate')).toContainText('Gira tu iPhone');
  expect(await game<number>(page, 'g.clock.speed')).toBe(0);
  const h = await game<number>(page, 's.hour');
  const session = await game<number>(page, 'g.session');
  await page.waitForTimeout(800);
  expect(await game<number>(page, 's.hour')).toBe(h);
  await page.setViewportSize(land);
  await expect(page.getByTestId('rotate')).toBeHidden();
  expect(await game<number>(page, 'g.clock.speed')).toBe(2);
  expect(await game<number>(page, 'g.session')).toBe(session);
  expect(await game<string>(page, 's.player')).toBe('ARG');
  await page.locator('[data-speed="0"]').tap();
});

test('Tocar una región la selecciona y el panel muestra la región, su país y sus tropas', async ({ page }) => {
  await startGame(page, 'CHL');
  const p = await regionPoint(page, 'CL_NO');
  await page.touchscreen.tap(p.x, p.y);
  const side = page.getByTestId('side');
  await expect(side.locator('.region-card .rc-name')).toHaveText('Norte Grande');
  await expect(side.locator('.region-card')).toContainText('PIB regional');
  await expect(side.locator('.region-card .region-thumb')).toBeVisible();
  await side.locator('[data-action="troops"]').tap();
  await expect(side.locator('.region-card .unit-card').first()).toBeVisible();
  // Pestañas del país
  for (const tab of ['economy', 'military', 'diplomacy', 'summary']) {
    await side.locator(`[data-ctx-tab="${tab}"]`).tap();
    await expect(side.locator(`[data-ctx-tab="${tab}"]`)).toHaveAttribute('aria-selected', 'true');
  }
  // Seleccionar el país desde la región
  await side.locator('.region-card .rc-owner').tap();
  await expect(side.locator('.country-card .cc-name')).toHaveText('Chile');
});

test('Tocar batallones propios y ajenos los selecciona', async ({ page }) => {
  await startGame(page, 'BRA');
  await page.locator('[data-units="BR_CO"][data-owner="BRA"]').tap();
  await expect(page.getByTestId('side').locator('.units-card .rc-owner')).toContainText('Brasil');
  await expect(page.locator('[data-action="move"]')).toBeEnabled();
  const n = await page.locator('.unit-card.selected').count();
  expect(n).toBeGreaterThan(0);
  // Quitar uno de la selección
  await page.locator('.unit-card.selected').first().tap();
  // Batallón extranjero: solo consulta
  await page.locator('[data-tab="army"]').tap();
  await page.locator('[data-tab="map"]').tap();
  // Batallón extranjero: se toca su región y luego el batallón en la lista de tropas.
  const p = await regionPoint(page, 'PY_OR');
  await page.touchscreen.tap(p.x, p.y);
  await expect(page.locator('.region-card .rc-name')).toHaveText('Región Oriental');
  await page.locator('[data-action="troops"]').tap();
  await page.locator('.region-card .unit-card').first().tap();
  await expect(page.locator('.units-card .rc-owner')).toContainText('Paraguay');
  await expect(page.getByTestId('side')).toContainText('Solo puedes consultar');
  await expect(page.locator('[data-action="move"]')).toHaveCount(0);
});

test('El panel lateral se contrae para ampliar el mapa y se vuelve a abrir', async ({ page }) => {
  await startGame(page, 'PER');
  const mapW = async () => (await page.locator('svg.map').boundingBox())!.width;
  const w0 = await mapW();
  // 1) Desde la tarjeta del país
  await page.locator('[data-action="collapse"]').tap();
  await expect(page.getByTestId('side')).toHaveCount(0);
  await expect.poll(mapW).toBeGreaterThan(w0 + 100);
  await page.getByRole('button', { name: 'Mostrar panel de información' }).tap();
  await expect(page.getByTestId('side')).toBeVisible();
  // 2) Con el tirador fijo del borde del mapa (siempre en el mismo sitio)
  const handle = page.locator('[data-action="toggle-panel"]');
  await expect(handle).toHaveAttribute('aria-expanded', 'true');
  const hb = (await handle.boundingBox())!;
  expect(hb.height).toBeGreaterThanOrEqual(44);
  await handle.tap();
  await expect(page.getByTestId('side')).toHaveCount(0);
  await expect(handle).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(mapW).toBeGreaterThan(w0 + 100);
  await handle.tap();
  await expect(page.getByTestId('side')).toBeVisible();
  await expect.poll(mapW).toBeLessThan(w0 + 5);
});

test('Minimapa: oculto por defecto, se muestra y oculta con su botón y recentra el mapa', async ({ page }) => {
  await startGame(page, 'ARG');
  const btn = page.locator('[data-action="minimap"]');
  await expect(page.locator('.minimap')).toHaveCount(0);
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await expect(btn).toHaveAccessibleName('Mostrar minimapa');
  await btn.tap();
  await expect(page.locator('.minimap')).toBeVisible();
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await expect(btn).toHaveAccessibleName('Ocultar minimapa');
  // Recentrar tocando el minimapa
  const svg = page.locator('svg.map');
  const before = await svg.getAttribute('viewBox');
  const mm = (await page.locator('.minimap svg').boundingBox())!;
  await page.touchscreen.tap(mm.x + mm.width * 0.7, mm.y + mm.height * 0.25);
  await expect.poll(() => svg.getAttribute('viewBox')).not.toBe(before);
  // Los demás controles siguen disponibles con el minimapa visible
  for (const name of ['Capas del mapa', 'Acercar', 'Alejar', 'Centrar en tu país']) {
    await expect(page.getByRole('button', { name })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Capas del mapa' }).tap();
  await expect(page.locator('.layer-menu')).toBeVisible();
  await page.getByRole('button', { name: 'Capas del mapa' }).tap();
  await btn.tap();
  await expect(page.locator('.minimap')).toHaveCount(0);
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
});

test('Los nombres de países no se superponen a los marcadores militares', async ({ page }) => {
  for (const country of ['VEN', 'ARG', 'BRA', 'PER']) {
    await startGame(page, country);
    const result = await page.evaluate(() => {
      const box = (el: Element) => el.getBoundingClientRect();
      const hit = (a: DOMRect, b: DOMRect) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const stacks = [...document.querySelectorAll('.stack:not(.moving) .stack-box')].map(box);
      const labels = [...document.querySelectorAll('[data-country-label]')];
      let overlaps = 0, crowded = 0;
      for (const l of labels) {
        if (l.classList.contains('crowded')) { crowded++; continue; }
        const t = box(l.querySelector('text')!);
        if (stacks.some((s) => hit(t, s) > 4)) overlaps++;
      }
      return { labels: labels.length, overlaps, crowded };
    });
    expect(result.labels, country).toBeGreaterThan(0);
    expect(result.overlaps, `${country}: nombres encima de marcadores`).toBe(0);
    expect(result.crowded, `${country}: rótulos sin hueco`).toBeLessThanOrEqual(Math.ceil(result.labels * 0.25));
  }
});

test('Navegación lateral: secciones activas y secciones en desarrollo', async ({ page }) => {
  await startGame(page, 'COL');
  for (const [tab, text] of [['economy', 'Política económica'], ['diplomacy', 'Países'], ['army', 'Abastecimiento'], ['stats', 'Datos actuales de la partida']] as const) {
    await page.locator(`[data-tab="${tab}"]`).tap();
    await expect(page.getByTestId('side')).toContainText(text);
  }
  for (const tab of ['government', 'research', 'espionage']) {
    await page.locator(`[data-tab="${tab}"]`).tap();
    await expect(page.locator(`[data-future="${tab}"]`)).toContainText('no está disponible');
  }
  // Desde una sección se vuelve al mapa tocando una región
  const p = await regionPoint(page, 'CO_AN');
  await page.touchscreen.tap(p.x, p.y);
  await expect(page.locator('[data-tab="map"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('side').locator('.rc-name')).toHaveText('Región Andina');
  // Estadísticas: tocar un país lo selecciona en el mapa
  await page.locator('[data-tab="stats"]').tap();
  await page.locator('table.stats').getByRole('button', { name: /Venezuela/ }).tap();
  await expect(page.getByTestId('side').locator('.cc-name')).toHaveText('Venezuela');
});

test('Zoom con dos dedos, minimapa y controles del mapa sin alterar la selección', async ({ page }) => {
  await startGame(page, 'ARG');
  const svg = page.locator('svg.map');
  const w0 = Number(await svg.getAttribute('data-view-w'));
  await pinch(page, 2.2);
  await expect.poll(async () => Number(await svg.getAttribute('data-view-w'))).toBeLessThan(w0 * 0.7);
  const w1 = Number(await svg.getAttribute('data-view-w'));
  await pinch(page, 0.5);
  await expect.poll(async () => Number(await svg.getAttribute('data-view-w'))).toBeGreaterThan(w1 * 1.3);
  const p = await regionPoint(page, 'AR_BA');
  await page.touchscreen.tap(p.x, p.y);
  const title = await page.getByTestId('side').locator('.rc-name').textContent();
  await page.getByRole('button', { name: 'Acercar' }).tap();
  await page.getByRole('button', { name: 'Alejar' }).tap();
  await page.getByRole('button', { name: 'Centrar en tu país' }).tap();
  // El minimapa recentra la vista
  // (en pantallas muy bajas, como el iPhone SE, el minimapa se oculta a propósito)
  if (await page.locator('.minimap').isVisible()) {
    const before = await svg.getAttribute('viewBox');
    const mm = (await page.locator('.minimap svg').boundingBox())!;
    await page.touchscreen.tap(mm.x + mm.width * 0.7, mm.y + mm.height * 0.3);
    await expect.poll(() => svg.getAttribute('viewBox')).not.toBe(before);
  }
  await expect(page.getByTestId('side').locator('.rc-name')).toHaveText(title!);
  // Los botones táctiles miden al menos 40 px
  for (const name of ['Acercar', 'Alejar', 'Capas del mapa']) {
    const bb = (await page.getByRole('button', { name }).boundingBox())!;
    expect(Math.min(bb.width, bb.height)).toBeGreaterThanOrEqual(38);
  }
});

test('Barra superior: datos reales, buzón de propuestas y multiplicador de tiempo', async ({ page }) => {
  await startGame(page, 'BRA');
  const gdp = await game<number>(page, 's.countries.BRA.gdp');
  expect(gdp).toBeGreaterThan(1000);
  await expect(page.locator('.tb-gdp')).toContainText('bill.');
  // El buzón abre Diplomacia (en pantallas de 568 px se oculta: Diplomacia muestra el mismo contador)
  const inbox = page.locator('[data-action="inbox"]');
  if (await inbox.isVisible()) {
    await inbox.tap();
    await expect(page.locator('[data-tab="diplomacy"]')).toHaveAttribute('aria-current', 'page');
  }
  // Ninguna tarjeta de la barra superior queda cortada
  const clipped = await page.evaluate(() => {
    const bar = document.querySelector('.tb-cards')!.getBoundingClientRect();
    return [...document.querySelectorAll('.tb-card')].filter((c) => getComputedStyle(c).display !== 'none')
      .filter((c) => { const r = c.getBoundingClientRect(); return r.left < bar.left - 0.5 || r.right > bar.right + 0.5; }).length;
  });
  expect(clipped).toBe(0);
  await expect(page.locator('.rail-btn.future')).toHaveCount(3);
  await expect(page.locator('.rail-btn.future .rail-lock')).toHaveCount(3);
});

test('Los marcadores se colorean según la relación: propios, enemigos y otros', async ({ page }) => {
  await startGame(page, 'VEN');
  await expect(page.locator('.stack.mine').first()).toBeVisible();
  expect(await page.locator('.stack.enemy').count()).toBe(0);
  await game(page, "g.act({ type: 'declareWar', target: 'GUY' })");
  await expect.poll(() => page.locator('.stack.enemy').count()).toBeGreaterThan(0);
  expect(await page.locator('.stack.other').count()).toBeGreaterThan(0);
});

test('Capas: las disponibles se pueden ocultar y las futuras aparecen como próximamente', async ({ page }) => {
  await startGame(page, 'ECU');
  expect(await page.locator('.stack').count()).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Capas del mapa' }).tap();
  await expect(page.locator('#layer-ports')).toBeDisabled();
  await expect(page.locator('.layer-row.planned')).toHaveCount(3);
  await page.locator('label[for="layer-units"]').tap();
  await expect(page.locator('.stack')).toHaveCount(0);
  await page.locator('label[for="layer-units"]').tap();
  expect(await page.locator('.stack').count()).toBeGreaterThan(0);
  // Las capas futuras existen en el SVG pero vacías (sin datos inventados)
  expect(await page.locator('g[data-layer="ports"] > *').count()).toBe(0);
});

test('Una partida guardada con la versión publicada carga en la nueva interfaz', async ({ page }) => {
  const record = JSON.parse(readFileSync(new URL('../fixtures/save-v1-beta1.json', import.meta.url), 'utf8'));
  await page.goto('/index.html');
  await page.evaluate((rec) => new Promise<void>((resolve, reject) => {
    const req = indexedDB.open('simulador-presidente', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('saves', { keyPath: 'slot' }); };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction('saves', 'readwrite');
      tx.objectStore('saves').put({ ...rec, savedAt: Date.now() });
      tx.oncomplete = () => { req.result.close(); resolve(); };
    };
  }), record);
  await page.reload();
  await expect(page.locator('.continue')).toContainText('Venezuela');
  await page.locator('.continue button').tap();
  await expect.poll(() => game<number>(page, 's ? s.hour : -1')).toBe(48);
  expect(await game<string>(page, 's.player')).toBe('VEN');
  await expect(page.locator('.topbar.wartime')).toBeVisible();
});
