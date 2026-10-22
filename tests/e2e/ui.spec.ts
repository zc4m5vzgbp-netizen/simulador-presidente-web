import { test, expect, type Page } from '@playwright/test';

/** Lee datos del estado real del juego (expuesto en window.__game para pruebas). */
async function game<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(`(() => { const g = window.__game; const s = g.state; return (${fn}); })()`) as Promise<T>;
}

/** Coordenadas de pantalla del ancla de una región del mapa. */
async function regionPoint(page: Page, regionId: string) {
  return page.evaluate((id) => {
    const svg = document.querySelector('svg.map') as SVGSVGElement;
    const path = svg.querySelector(`[data-region="${id}"] .region-fill`) as SVGPathElement;
    // Buscar un punto interior del trazado que no tape un marcador
    const bb = path.getBBox();
    const m = svg.getScreenCTM()!;
    for (let fy = 0.5; fy < 0.95; fy += 0.07) {
      for (let fx = 0.5; fx < 0.95; fx += 0.07) {
        for (const [sx, sy] of [[fx, fy], [1 - fx, fy], [fx, 1 - fy], [1 - fx, 1 - fy]]) {
          const pt = svg.createSVGPoint();
          pt.x = bb.x + bb.width * sx; pt.y = bb.y + bb.height * sy;
          const p = pt.matrixTransform(m);
          const el = document.elementFromPoint(p.x, p.y);
          if (el && el.closest('[data-region]')?.getAttribute('data-region') === id && !el.closest('[data-units]')) return { x: p.x, y: p.y };
        }
      }
    }
    throw new Error('Región no visible: ' + id);
  }, regionId);
}

async function startGame(page: Page, country: string) {
  await page.goto('/index.html');
  await page.locator(`[data-country="${country}"]`).tap();
  await page.getByTestId('start').tap();
  await expect(page.getByTestId('date')).toContainText('1 ene 2027');
}

test('12. Inicio, calendario y pausa con controles táctiles', async ({ page }) => {
  await startGame(page, 'CHL');
  expect(await game<string>(page, 's.player')).toBe('CHL');
  // Pausa por defecto: la fecha no cambia
  await page.waitForTimeout(1200);
  expect(await game<number>(page, 's.hour')).toBe(0);
  // Velocidad máxima: el calendario avanza
  await page.locator('[data-speed="3"]').tap();
  await expect.poll(() => game<number>(page, 's.hour'), { timeout: 10_000 }).toBeGreaterThan(24);
  await expect(page.getByTestId('date')).not.toContainText('1 ene 2027');
  // Pausa: la simulación se detiene
  await page.locator('[data-speed="0"]').tap();
  const h = await game<number>(page, 's.hour');
  await page.waitForTimeout(1500);
  expect(await game<number>(page, 's.hour')).toBe(h);
});

test('12. Dar una orden de marcha tocando el mapa y ver llegar la unidad', async ({ page }) => {
  await startGame(page, 'ARG');
  // Tocar un batallón propio en Buenos Aires y Pampa
  const stack = page.locator('[data-units="AR_BA"][data-owner="ARG"]');
  await stack.tap();
  await expect(page.locator('.order-banner')).toBeVisible();
  const p = await regionPoint(page, 'AR_PA');
  await page.touchscreen.tap(p.x, p.y);
  await expect(page.locator('.toast').first()).toContainText('en marcha');
  const moving = await game<string[]>(page, "Object.values(s.units).filter(u => u.owner === 'ARG' && u.destination === 'AR_PA').map(u => u.id)");
  expect(moving.length).toBeGreaterThan(0);
  await page.locator('[data-speed="3"]').tap();
  await expect.poll(() => game<string>(page, `s.units['${moving[0]}'].regionId`), { timeout: 30_000 }).toBe('AR_PA');
  await page.locator('[data-speed="0"]').tap();
});

test('12. Cambiar la política económica desde el panel', async ({ page }) => {
  await startGame(page, 'BRA');
  await page.locator('[data-tab="economy"]').tap();
  const slider = page.locator('#pol-taxRate');
  await slider.fill('38');
  await page.getByRole('button', { name: 'Aplicar cambios' }).tap();
  expect(await game<number>(page, 's.countries.BRA.policy.taxRate')).toBe(38);
});

test('12. Diplomacia: declarar la guerra con confirmación en la página', async ({ page }) => {
  await startGame(page, 'PER');
  await page.locator('[data-tab="diplomacy"]').tap();
  await page.locator('.country-row', { hasText: 'Ecuador' }).tap();
  await page.getByRole('button', { name: /Declarar la guerra/ }).tap();
  expect(await game<number>(page, 's.wars.length')).toBe(0); // aún no confirmado
  await page.getByRole('button', { name: 'Confirmar declaración de guerra' }).tap();
  expect(await game<number>(page, 's.wars.length')).toBe(1);
  await expect(page.locator('.game.wartime')).toBeVisible();
});

test('11/12. Guardar en IndexedDB, recargar la página y continuar', async ({ page }) => {
  await startGame(page, 'COL');
  await page.locator('[data-speed="3"]').tap();
  await expect.poll(() => game<number>(page, 's.hour'), { timeout: 10_000 }).toBeGreaterThan(48);
  await page.locator('[data-speed="0"]').tap();
  const hour = await game<number>(page, 's.hour');
  const units = await game<string>(page, 'JSON.stringify(s.units)');
  await page.locator('[data-tab="game"]').tap();
  await page.locator('[data-slot="1"]').tap();
  await expect(page.locator('.toast', { hasText: 'Partida guardada' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.continue')).toBeVisible();
  await page.locator('.continue button').tap();
  await expect.poll(() => game<number>(page, 's ? s.hour : -1')).toBe(hour);
  expect(await game<string>(page, 's.player')).toBe('COL');
  expect(await game<string>(page, 'JSON.stringify(s.units)')).toBe(units);
});

test('12. Sin desbordamiento horizontal en pantalla de iPhone', async ({ page }) => {
  await startGame(page, 'URY');
  for (const tab of ['economy', 'diplomacy', 'army', 'game']) {
    await page.locator(`[data-tab="${tab}"]`).tap();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, tab).toBeLessThanOrEqual(0);
  }
});
