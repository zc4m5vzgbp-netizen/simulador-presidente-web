import { test, expect } from '@playwright/test';
import { game, regionPoint, startGame } from './helpers';

test('Inicio, calendario y pausa con controles táctiles', async ({ page }) => {
  await startGame(page, 'CHL');
  expect(await game<string>(page, 's.player')).toBe('CHL');
  await page.waitForTimeout(1200);
  expect(await game<number>(page, 's.hour')).toBe(0);
  await page.locator('[data-speed="3"]').tap();
  await expect.poll(() => game<number>(page, 's.hour'), { timeout: 10_000 }).toBeGreaterThan(24);
  await expect(page.getByTestId('date')).not.toContainText('1 ene 2027');
  await page.locator('[data-speed="0"]').tap();
  const h = await game<number>(page, 's.hour');
  await page.waitForTimeout(1500);
  expect(await game<number>(page, 's.hour')).toBe(h);
});

test('Seleccionar un batallón, ordenar la marcha tocando el mapa y verlo llegar', async ({ page }) => {
  await startGame(page, 'ARG');
  await page.locator('[data-units="AR_BA"][data-owner="ARG"]').tap();
  await expect(page.getByTestId('side')).toContainText('Mover');
  await page.locator('[data-action="move"]').tap();
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

test('Cambiar la política económica desde su sección', async ({ page }) => {
  await startGame(page, 'BRA');
  await page.locator('[data-tab="economy"]').tap();
  await page.locator('#pol-taxRate').fill('38');
  await page.getByRole('button', { name: 'Aplicar cambios' }).tap();
  expect(await game<number>(page, 's.countries.BRA.policy.taxRate')).toBe(38);
});

test('Diplomacia: declarar la guerra con confirmación en la página', async ({ page }) => {
  await startGame(page, 'PER');
  await page.locator('[data-tab="diplomacy"]').tap();
  await page.locator('.country-row', { hasText: 'Ecuador' }).tap();
  await page.getByRole('button', { name: /Declarar la guerra/ }).tap();
  expect(await game<number>(page, 's.wars.length')).toBe(0);
  await page.getByRole('button', { name: 'Confirmar declaración de guerra' }).tap();
  expect(await game<number>(page, 's.wars.length')).toBe(1);
  await expect(page.locator('.topbar.wartime')).toBeVisible();
});

test('Guardar en IndexedDB, recargar la página y continuar', async ({ page }) => {
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
  await page.locator('.continue button').tap();
  await expect.poll(() => game<number>(page, 's ? s.hour : -1')).toBe(hour);
  expect(await game<string>(page, 's.player')).toBe('COL');
  expect(await game<string>(page, 'JSON.stringify(s.units)')).toBe(units);
});

test('Sin desbordamiento horizontal en ninguna sección', async ({ page }) => {
  await startGame(page, 'URY');
  for (const tab of ['economy', 'diplomacy', 'army', 'government', 'research', 'espionage', 'stats', 'game', 'map']) {
    await page.locator(`[data-tab="${tab}"]`).first().tap();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, tab).toBeLessThanOrEqual(0);
  }
});
