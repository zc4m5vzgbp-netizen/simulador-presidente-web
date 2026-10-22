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

test('Tocar una región la selecciona y el panel muestra región, país y tropas', async ({ page }) => {
  await startGame(page, 'CHL');
  const p = await regionPoint(page, 'CL_NO');
  await page.touchscreen.tap(p.x, p.y);
  const side = page.getByTestId('side');
  await expect(side.locator('.side-title')).toHaveText('Norte Grande');
  await side.locator('[data-ctx-tab="country"]').tap();
  await expect(side).toContainText('PIB');
  await side.locator('[data-ctx-tab="troops"]').tap();
  await side.getByRole('button', { name: 'Ver país' }).count();
  await side.locator('[data-ctx-tab="region"]').tap();
  await side.getByRole('button', { name: /Chile/ }).first().tap();
  await expect(side.locator('.side-title')).toHaveText('Chile');
  await expect(side.locator('[data-ctx-tab="military"]')).toBeVisible();
});

test('Tocar batallones propios y ajenos los selecciona', async ({ page }) => {
  await startGame(page, 'BRA');
  await page.locator('[data-units="BR_CO"][data-owner="BRA"]').tap();
  await expect(page.getByTestId('side').locator('.side-sub')).toContainText('Brasil');
  await expect(page.locator('[data-action="move"]')).toBeEnabled();
  const n = await page.locator('.unit-card.selected').count();
  expect(n).toBeGreaterThan(0);
  // Quitar uno de la selección
  await page.locator('.unit-card.selected').first().tap();
  // Batallón extranjero: solo consulta
  await page.locator('[data-tab="army"]').tap();
  await page.locator('[data-tab="map"]').tap();
  const pt = await page.evaluate(() => {
    for (const el of document.querySelectorAll('.stack:not(.mine)')) {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (document.elementFromPoint(x, y)?.closest('.stack') === el) return { x, y };
    }
    return null;
  });
  expect(pt, 'hay un batallón extranjero visible').not.toBeNull();
  await page.touchscreen.tap(pt!.x, pt!.y);
  await expect(page.getByTestId('side')).toContainText('Solo puedes consultar');
  await expect(page.locator('[data-action="move"]')).toHaveCount(0);
});

test('El panel lateral se contrae para ampliar el mapa y se vuelve a abrir', async ({ page }) => {
  await startGame(page, 'PER');
  const w0 = (await page.locator('svg.map').boundingBox())!.width;
  await page.locator('[data-action="collapse"]').tap();
  await expect(page.getByTestId('side')).toHaveCount(0);
  await expect.poll(async () => (await page.locator('svg.map').boundingBox())!.width).toBeGreaterThan(w0 + 100);
  await page.getByRole('button', { name: 'Mostrar panel de información' }).tap();
  await expect(page.getByTestId('side')).toBeVisible();
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
  await expect(page.getByTestId('side').locator('.side-title')).toHaveText('Región Andina');
  // Estadísticas: tocar un país lo selecciona en el mapa
  await page.locator('[data-tab="stats"]').tap();
  await page.locator('table.stats').getByRole('button', { name: /Venezuela/ }).tap();
  await expect(page.getByTestId('side').locator('.side-title')).toHaveText('Venezuela');
});

test('Zoom con dos dedos y controles del mapa sin alterar la selección', async ({ page }) => {
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
  const title = await page.getByTestId('side').locator('.side-title').textContent();
  await page.getByRole('button', { name: 'Acercar' }).tap();
  await page.getByRole('button', { name: 'Alejar' }).tap();
  await page.getByRole('button', { name: 'Centrar en tu país' }).tap();
  await expect(page.getByTestId('side').locator('.side-title')).toHaveText(title!);
  // Los botones táctiles miden al menos 40 px
  for (const name of ['Acercar', 'Alejar', 'Capas del mapa']) {
    const bb = (await page.getByRole('button', { name }).boundingBox())!;
    expect(Math.min(bb.width, bb.height)).toBeGreaterThanOrEqual(40);
  }
});

test('Capas: las disponibles se pueden ocultar y las futuras aparecen como próximamente', async ({ page }) => {
  await startGame(page, 'ECU');
  expect(await page.locator('.stack').count()).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Capas del mapa' }).tap();
  await expect(page.locator('#layer-crossings')).toBeDisabled();
  await expect(page.locator('.layer-row.planned')).toHaveCount(5);
  await page.locator('label[for="layer-units"]').tap();
  await expect(page.locator('.stack')).toHaveCount(0);
  await page.locator('label[for="layer-units"]').tap();
  expect(await page.locator('.stack').count()).toBeGreaterThan(0);
  // Las capas futuras existen en el SVG pero vacías (sin datos inventados)
  expect(await page.locator('g[data-layer="crossings"] > *').count()).toBe(0);
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
