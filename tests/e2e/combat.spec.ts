/** MIL Fase 2: batalla en Atlas, panel de batalla, retirada manual, ataque directo, ficha con daños y suministros, informes, guardado. */
import { test, expect, type Page } from '@playwright/test';
import { fastTime, game, regionPoint, startGame } from './helpers';

async function focus(page: Page, regionId: string, w = 200) {
  await page.evaluate(([id, w]) => {
    const svg = document.querySelector('svg.map') as SVGSVGElement;
    const bb = (svg.querySelector(`path[data-region="${id}"]`) as SVGPathElement).getBBox();
    const h = ((w as number) * svg.clientHeight) / svg.clientWidth;
    (window as unknown as { __setView: (v: { x: number; y: number; w: number }) => void }).__setView({ x: bb.x + bb.width / 2 - (w as number) / 2, y: bb.y + bb.height / 2 - h / 2, w: w as number });
  }, [regionId, w] as const);
  await page.waitForTimeout(150);
}

/** Argentina en guerra con Uruguay y dos batallones argentinos ya en Uruguay: la batalla empieza enseguida. */
async function setupBattle(page: Page) {
  await startGame(page, 'ARG');
  await page.evaluate(() => {
    const g = (window as unknown as { __game: { state: any; act: (a: unknown) => unknown; emit: () => void } }).__game;
    for (const c of Object.keys(g.state.ai)) g.state.ai[c].aggression = 0;
    g.act({ type: 'declareWar', target: 'URY' });
    const mine = Object.values(g.state.units).filter((u: any) => u.owner === 'ARG').slice(0, 2) as any[];
    for (const u of mine) { u.regionId = 'UY'; u.path = []; u.status = 'idle'; u.destination = null; }
    g.emit();
  });
  await fastTime(page, 100);
  await page.locator('[data-speed="1"]').tap();
  await expect.poll(() => game<number>(page, 'Object.keys(s.battles).length'), { timeout: 20_000 }).toBeGreaterThan(0);
  await page.locator('[data-speed="0"]').tap();
}

test('Batalla: el marcador de Atlas abre el panel con bajas, vehículos, consumos y evolución', async ({ page }) => {
  await setupBattle(page);
  await page.locator('[data-speed="1"]').tap();
  await expect.poll(() => game<number>(page, 's.battles.UY ? s.battles.UY.timeline.length : 0'), { timeout: 20_000 }).toBeGreaterThan(3);
  await page.locator('[data-speed="0"]').tap();
  await focus(page, 'UY');
  const marker = page.locator('[data-battle] .battle-dot').first();
  await expect(marker).toBeVisible();
  const box = (await marker.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  const card = page.locator('.battle-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Batalla de Uruguay');
  await expect(card.locator('[data-battle-country]')).toHaveCount(2);
  const losses = await game<number>(page, 's.battles.UY.losses.ARG ?? 0');
  expect(losses).toBeGreaterThan(0);
  await expect(card.getByTestId('losses-ARG')).not.toHaveText('0');
  await expect(card.locator('.battle-chart polyline')).toHaveCount(2);
  await expect(card).toContainText('cargas de munición');
  await expect(card).toContainText('Sin terreno, fortificaciones, bonificación defensiva ni moral');
});

test('Retirada manual desde la ficha de los batallones en combate', async ({ page }) => {
  await setupBattle(page);
  await page.locator('[data-tab="army"]').tap();
  const id = await game<string>(page, "Object.values(s.units).find(u => u.owner === 'ARG' && u.status === 'combat').id");
  await page.locator(`.unit-card[data-unit-id="${id}"]`).tap();
  await page.locator('[data-action="retreat"]').tap();
  await expect.poll(() => game<string>(page, `s.units['${id}'] ? s.units['${id}'].status : 'gone'`)).toBe('retreating');
  await expect(page.locator('.toast').first()).toContainText('en retirada');
});

test('Ataque directo: tocar territorio de un país en paz pide confirmación; cancelar no inicia guerra', async ({ page }) => {
  await startGame(page, 'ARG');
  await page.locator('[data-units="AR_BA"][data-owner="ARG"]').tap();
  await page.locator('[data-action="move"]').tap();
  let p = await regionPoint(page, 'UY');
  await page.touchscreen.tap(p.x, p.y);
  const dialog = page.getByRole('alertdialog', { name: 'Confirmar ataque directo' });
  await expect(dialog).toContainText('sin declarar la guerra');
  // El mismo toque que abre la confirmación no debe confirmarla (botones armados tras 400 ms).
  await page.waitForTimeout(600);
  expect(await game<number>(page, 's.wars.length')).toBe(0);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar' }).tap();
  expect(await game<number>(page, 's.wars.length')).toBe(0);
  await page.locator('[data-units="AR_BA"][data-owner="ARG"]').tap();
  await page.locator('[data-action="move"]').tap();
  p = await regionPoint(page, 'UY');
  await page.touchscreen.tap(p.x, p.y);
  await page.locator('[data-action="confirm-attack"]').tap();
  expect(await game<number>(page, 's.wars.length')).toBe(1);
  expect(await game<string>(page, 's.wars[0].name')).toContain('Ataque');
  expect(await game<number>(page, "Object.values(s.units).filter(u => u.owner === 'ARG' && u.destination === 'UY').length")).toBeGreaterThan(0);
  await expect(page.locator('.topbar.wartime')).toBeVisible();
});

test('Ficha del batallón: potencia, munición y combustible discretos, vehículos dañados', async ({ page }) => {
  await setupBattle(page);
  await page.locator('[data-speed="1"]').tap();
  await expect.poll(() => game<number>(page, "Object.values(s.units).filter(u => u.owner === 'ARG').reduce((a, u) => a + Object.values(u.damaged).reduce((x, y) => x + y, 0), 0)"), { timeout: 30_000 }).toBeGreaterThan(0);
  await page.locator('[data-speed="0"]').tap();
  const id = await game<string>(page, "Object.values(s.units).find(u => u.owner === 'ARG' && Object.keys(u.damaged).length).id");
  await page.locator('[data-tab="army"]').tap();
  await page.locator(`.unit-card[data-unit-id="${id}"]`).tap();
  const card = page.locator('.unit-card.detail');
  await expect(card.getByTestId('unit-power')).not.toHaveText('0,0');
  await expect(card.getByTestId('ammo').locator('.pip')).toHaveCount(5);
  await expect(card.getByTestId('fuel').locator('.pip')).toHaveCount(5);
  const ammo = await game<number>(page, `s.units['${id}'].ammo`);
  expect(ammo).toBeLessThan(1);
  await expect(card.locator('[data-testid^="damaged-"]').first()).toBeVisible();
  await expect(card).not.toContainText('Moral');
});

test('Informe de batalla terminada en Ejército y guardado durante una batalla', async ({ page }) => {
  await setupBattle(page);
  // Guardar con la batalla en curso, recargar y comprobar que sigue ahí con sus datos.
  const before = await game<string>(page, 'JSON.stringify(s.battles)');
  await page.locator('[data-tab="game"]').tap();
  await page.locator('[data-slot="2"]').tap();
  await expect(page.locator('.toast', { hasText: 'Partida guardada' })).toBeVisible();
  await page.reload();
  await page.locator('.continue button').tap();
  await expect.poll(() => game<string>(page, 's ? JSON.stringify(s.battles) : ""')).toBe(before);
  // Dejar terminar la batalla: aparece su informe.
  await fastTime(page, 400);
  await page.locator('[data-speed="3"]').tap();
  await expect.poll(() => game<number>(page, 's.battleReports.length'), { timeout: 60_000 }).toBeGreaterThan(0);
  await page.locator('[data-speed="0"]').tap();
  await page.locator('[data-tab="army"]').tap();
  const link = page.locator('[data-report-link]').first();
  await link.scrollIntoViewIfNeeded();
  await link.tap();
  await expect(page.locator('.battle-card')).toContainText('Informe de batalla');
  await expect(page.locator('.battle-card')).toContainText(/Victoria de|Sin vencedor/);
});
