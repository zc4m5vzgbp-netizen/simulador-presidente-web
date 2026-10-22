/** MIL Fase 1: ficha ilustrada, totales, inventario por ramas, reclutamiento, reposición, reloj y pausa al cerrar. */
import { test, expect, type Page } from '@playwright/test';
import { fastTime, game, regionPoint, startGame } from './helpers';

/** Región con al menos `n` batallones del jugador y su lista de ids. */
async function stackWith(page: Page, n: number) {
  return game<{ region: string; ids: string[] }>(page, `(() => {
    const by = {};
    for (const u of Object.values(s.units)) if (u.owner === s.player) (by[u.regionId] ??= []).push(u.id);
    const [region, ids] = Object.entries(by).find(([, v]) => v.length >= ${n});
    return { region, ids };
  })()`);
}

test('Velocidades pausa, ×1, ×2 y ×4 y un día de 5 minutos', async ({ page }) => {
  await startGame(page, 'ARG');
  for (const [id, label] of [['1', 'Velocidad ×1'], ['2', 'Velocidad ×2'], ['3', 'Velocidad ×4']]) {
    await page.locator(`[data-speed="${id}"]`).tap();
    await expect(page.locator(`[data-speed="${id}"]`)).toHaveAttribute('aria-label', label);
  }
  await expect(page.getByLabel('Multiplicador de tiempo')).toHaveText('x4');
  // A ×4 sin acelerar: en 2 s reales no puede pasar ni una hora (1 h = 3,1 s).
  await page.waitForTimeout(2000);
  expect(await game<number>(page, 's.hour')).toBe(0);
  await page.locator('[data-speed="0"]').tap();
});

test('Al ocultar la app el juego se pausa y se autoguarda', async ({ page }) => {
  await startGame(page, 'CHL');
  await page.locator('[data-speed="1"]').tap();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => game<number>(page, 'g.clock.speed')).toBe(0);
  await expect.poll(() => game<boolean>(page, 'g.saves.some(x => x.slot === "auto")')).toBe(true);
});

test('Ficha ilustrada de un batallón: efectivos, equipo con siluetas y tripulación, sin barras de preparación', async ({ page }) => {
  await startGame(page, 'VEN');
  const { ids } = await stackWith(page, 1);
  // Seleccionar desde el panel Ejército (independiente de la posición en el mapa).
  await page.locator('[data-tab="army"]').tap();
  await page.locator(`.unit-card[data-unit-id="${ids[0]}"]`).tap();
  const card = page.locator('.unit-card.detail');
  await expect(card).toBeVisible();
  await expect(card.locator('.equip-row')).toHaveCount(6);
  const tanks = await game<number>(page, `Object.entries(s.units['${ids[0]}'].equipment).filter(([k]) => k.endsWith('-T1')).reduce((a, [, v]) => a + v, 0)`);
  await expect(card.getByTestId('equip-tank')).toHaveText(String(tanks));
  await expect(card.locator('.equip-row[data-equip="tank"] .equip-max')).toHaveText('/20');
  await expect(card.locator('.equip-row[data-equip="drone"] .equip-max')).toHaveText('/40');
  await expect(card.locator('svg.silhouette')).toHaveCount(6);
  await expect(card).toContainText('Tripulación asignada automáticamente');
  await expect(card).toContainText('provisional');
  await expect(card).not.toContainText('Org.');
  await expect(card).not.toContainText('Moral');
});

test('Varios batallones: totales y detalle individual', async ({ page }) => {
  await startGame(page, 'VEN');
  const { region, ids } = await stackWith(page, 2);
  await page.evaluate(([region]) => {
    const svg = document.querySelector('svg.map') as SVGSVGElement;
    const bb = (svg.querySelector(`path[data-region="${region}"]`) as SVGPathElement).getBBox();
    const w = 260, h = (w * svg.clientHeight) / svg.clientWidth;
    (window as unknown as { __setView: (v: { x: number; y: number; w: number }) => void }).__setView({ x: bb.x + bb.width / 2 - w / 2, y: bb.y + bb.height / 2 - h / 2, w });
  }, [region]);
  const tile = page.locator(`[data-units="${region}"][data-owner="VEN"] .stack-hit`);
  const box = (await tile.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  const totals = page.getByTestId('units-totals');
  await expect(totals).toBeVisible();
  await expect(totals).toContainText(`${ids.length} batallones`);
  const sum = await game<number>(page, `${JSON.stringify(ids)}.reduce((a, id) => a + Object.entries(s.units[id].equipment).filter(([k]) => k.endsWith('-B1')).reduce((x, [, v]) => x + v, 0), 0)`);
  await expect(totals.getByTestId('equip-armored')).toHaveText(String(sum));
  await expect(page.locator('.units-card .unit-card')).toHaveCount(ids.length);
  await expect(page.locator('.units-card .unit-card .equip-mini').first()).toBeVisible();
});

test('Inventario nacional por ramas: Tierra con modelos provisionales; Aire y Armada pendientes', async ({ page }) => {
  await startGame(page, 'BRA');
  await page.locator('[data-tab="army"]').tap();
  const inv = page.getByTestId('inventory-land');
  await expect(inv.locator('.inv-item')).toHaveCount(5);
  await expect(page.locator('.notice.prov')).toContainText('datos provisionales de prueba');
  const reserve = await game<number>(page, "s.countries.BRA.inventory['BRA-T1']");
  await expect(page.getByTestId('reserve-BRA-T1')).toHaveText(String(reserve));
  await page.locator('[data-branch="air"]').tap();
  await expect(page.getByTestId('branch-pending-air')).toContainText('fase 4');
  await page.locator('[data-branch="navy"]').tap();
  await expect(page.getByTestId('branch-pending-navy')).toContainText('fase 5');
});

test('Reclutar varios batallones: operativos al instante con el primer contingente; reposición pausable', async ({ page }) => {
  await startGame(page, 'COL');
  await page.locator('[data-tab="army"]').tap();
  const n0 = await game<number>(page, "Object.values(s.units).filter(u => u.owner === 'COL').length");
  await page.getByRole('button', { name: 'Más' }).tap();
  await expect(page.getByTestId('recruit-count')).toHaveText('2');
  await page.locator('[data-action="recruit"]').tap();
  await expect(page.locator('.toast').first()).toContainText('operativos con 250 voluntarios');
  const fresh = await game<{ men: number; status: string; pending: number }[]>(page, "Object.values(s.units).filter(u => u.owner === 'COL').slice(-2).map(u => ({ men: u.men, status: u.status, pending: u.recruitPending }))");
  expect(await game<number>(page, "Object.values(s.units).filter(u => u.owner === 'COL').length")).toBe(n0 + 2);
  for (const u of fresh) expect(u).toEqual({ men: 250, status: 'idle', pending: 750 });
  await page.locator('label.switch').tap();
  expect(await game<boolean>(page, 's.countries.COL.autoReplenish')).toBe(false);
  await expect(page.locator('label.switch')).toContainText('En pausa');
});

test('Orden de marcha: la ficha muestra cuánto falta para llegar', async ({ page }) => {
  await startGame(page, 'ARG');
  await page.locator('[data-units="AR_BA"][data-owner="ARG"]').tap();
  await page.locator('[data-action="move"]').tap();
  const p = await regionPoint(page, 'AR_PA');
  await page.touchscreen.tap(p.x, p.y);
  await expect(page.locator('.toast').first()).toContainText('en marcha');
  const id = await game<string>(page, "Object.values(s.units).find(u => u.owner === 'ARG' && u.destination === 'AR_PA').id");
  await page.locator('[data-tab="army"]').tap();
  await page.locator(`.unit-card[data-unit-id="${id}"]`).tap();
  await expect(page.locator('.unit-card.detail').getByTestId('unit-eta')).toContainText(/llega en \d+ d/);
  await fastTime(page);
  await page.locator('[data-speed="3"]').tap();
  await expect.poll(() => game<string>(page, `s.units['${id}'].regionId`), { timeout: 30_000 }).toBe('AR_PA');
  await page.locator('[data-speed="0"]').tap();
});
