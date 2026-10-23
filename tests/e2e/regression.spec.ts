/**
 * REGRESIÓN INTEGRAL (se ejecuta en cada fase; ver docs/mil/REGRESION.md).
 *
 * Recorridos reales de jugador con toques en pantalla, que comprueban cambios
 * del ESTADO del juego (no solo que aparezcan botones). Incluye el reloj en
 * tiempo real sin aceleración y el escenario completo Argentina → Uruguay.
 *
 * Contra otra compilación (p. ej. la copia descargada de la vista previa):
 *   E2E_BASE_URL=http://127.0.0.1:4174 npx playwright test regression
 */
import { test, expect, type Page } from '@playwright/test';
import { fastTime, game, regionPoint, startGame } from './helpers';

const hour = (page: Page) => game<number>(page, 's.hour');

test.describe('Regresión: reloj real', () => {
  test('pausa, ×1, ×2 y ×4 avanzan en tiempo real (sin acelerar) y la hora visible cambia', async ({ page }) => {
    test.setTimeout(120_000);
    await startGame(page, 'ARG');
    expect(await game<number>(page, 'g.timeScale')).toBe(1);
    await expect(page.getByTestId('clock-hour')).toHaveText('00:00');
    // ×4: 1 hora de juego = 3,1 s reales.
    await page.locator('[data-speed="3"]').tap();
    await page.waitForTimeout(7_000);
    const h4 = await hour(page);
    expect(h4).toBeGreaterThanOrEqual(2);
    expect(h4).toBeLessThanOrEqual(3);
    await expect(page.getByTestId('clock-hour')).not.toHaveText('00:00');
    // ×2: 6,25 s por hora.
    await page.locator('[data-speed="2"]').tap();
    await page.waitForTimeout(7_000);
    expect((await hour(page)) - h4).toBeGreaterThanOrEqual(1);
    // ×1: 12,5 s por hora.
    const h1 = await hour(page);
    await page.locator('[data-speed="1"]').tap();
    await page.waitForTimeout(13_500);
    expect((await hour(page)) - h1).toBeGreaterThanOrEqual(1);
    // Pausa: no avanza; al reanudar, sí.
    await page.locator('[data-speed="0"]').tap();
    const hp = await hour(page);
    await page.waitForTimeout(4_000);
    expect(await hour(page)).toBe(hp);
    await page.locator('[data-speed="3"]').tap();
    await expect.poll(() => hour(page), { timeout: 10_000 }).toBeGreaterThan(hp);
  });

  test('el reloj sigue aunque el visor suspenda requestAnimationFrame (respaldo por temporizador)', async ({ page }) => {
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await startGame(page, 'CHL');
    await page.locator('[data-speed="3"]').tap();
    await expect.poll(() => hour(page), { timeout: 12_000 }).toBeGreaterThanOrEqual(2);
  });

  test('un error interno del motor pausa la partida y se avisa en pantalla (nunca congelado en silencio)', async ({ page }) => {
    await startGame(page, 'PER');
    await page.evaluate(() => {
      const g = (window as unknown as { __game: { state: { units: Record<string, { regionId: string; path: string[]; status: string }> } } }).__game;
      const u = Object.values(g.state.units)[0];
      u.path = ['REGION_INEXISTENTE']; u.status = 'moving';
    });
    await page.locator('[data-speed="3"]').tap();
    await fastTime(page, 50);
    await expect(page.locator('.toast.err')).toContainText('Error interno');
    expect(await game<number>(page, 'g.clock.speed')).toBe(0);
    expect(await game<string | null>(page, 'g.fatal')).not.toBeNull();
  });
});

test.describe('Regresión: recorrido Argentina ataca Uruguay', () => {
  test('selección → orden → confirmación → marcha visible → llegada → batalla → resultado → informe → guardado y recuperación', async ({ page }) => {
    test.setTimeout(180_000);
    await startGame(page, 'ARG');
    await page.evaluate(() => { const g = (window as any).__game; for (const c of Object.keys(g.state.ai)) g.state.ai[c].aggression = 0; });

    // 1) Seleccionar el batallón de Buenos Aires y ordenar la marcha tocando Uruguay.
    await page.locator('[data-units="AR_BA"][data-owner="ARG"]').tap();
    await page.locator('[data-action="move"]').tap();
    await expect(page.locator('.order-banner')).toBeVisible();
    const p = await regionPoint(page, 'UY');
    await page.touchscreen.tap(p.x, p.y);

    // 2) Confirmación de ataque directo: el mismo toque no la acepta.
    const dialog = page.getByRole('alertdialog', { name: 'Confirmar ataque directo' });
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(600);
    expect(await game<number>(page, 's.wars.length')).toBe(0);
    await page.locator('[data-action="confirm-attack"]').tap();
    expect(await game<string>(page, 's.wars[0].name')).toContain('Argentina contra Uruguay');
    const id = await game<string>(page, "Object.values(s.units).find(u => u.owner === 'ARG' && u.destination === 'UY').id");
    await expect(page.locator('.toast').filter({ hasText: 'llegada en' })).toBeVisible();

    // 3) El tiempo avanza y la marcha progresa de forma visible en el mapa.
    await page.locator('[data-speed="3"]').tap();
    await fastTime(page, 60);
    await expect.poll(() => game<number>(page, `s.units['${id}'].progress`), { timeout: 20_000 }).toBeGreaterThan(0.05);
    await expect(page.locator(`[data-moving="${id}"] .march-progress`)).toBeVisible();
    const shown1 = Number(await page.locator(`[data-moving="${id}"] .march-progress`).getAttribute('data-progress'));
    await expect.poll(async () => Number(await page.locator(`[data-moving="${id}"] .march-progress`).getAttribute('data-progress')), { timeout: 20_000 }).toBeGreaterThan(shown1);

    // 4) Llegada y batalla EN URUGUAY. Acelerador moderado: con uno muy alto, entre dos
    // comprobaciones pasarían cientos de horas (marcha, batalla y retirada completas).
    await fastTime(page, 40);
    await expect.poll(() => game<boolean>(page, `!!(s.battles.UY || s.battleReports.some(r => r.regionId === 'UY' && r.entry['${id}']) || (s.units['${id}'] && s.units['${id}'].regionId === 'UY'))`), { timeout: 60_000 }).toBe(true);
    await expect.poll(() => game<boolean>(page, `!!(s.battles.UY || s.battleReports.some(r => r.regionId === 'UY'))`), { timeout: 60_000 }).toBe(true);
    await fastTime(page, 200);

    // 5) Resultado: la batalla termina con informe; bajas reales en ambos bandos.
    await expect.poll(() => game<boolean>(page, "s.battleReports.some(r => r.regionId === 'UY')"), { timeout: 90_000 }).toBe(true);
    await page.locator('[data-speed="0"]').tap();
    await fastTime(page, 1);
    const r = await game<{ losses: Record<string, number>; winners: string[] }>(page, "s.battleReports.find(r => r.regionId === 'UY')");
    expect(r.losses.ARG ?? 0).toBeGreaterThan(0);
    expect(r.losses.URY ?? 0).toBeGreaterThan(0);
    // Bajas acumuladas reales (los efectivos pueden recuperarse luego por la reposición automática).
    expect(await game<number>(page, 's.countries.URY.casualties')).toBeGreaterThan(0);
    expect(await game<number>(page, 's.countries.ARG.casualties')).toBeGreaterThan(0);
    // Ocupación (si Argentina vence y se queda) con rendimiento completo, o retirada/destrucción si pierde.
    const outcome = await game<string>(page, `s.regions.UY.controller === 'ARG' ? 'ocupada' : (s.units['${id}'] ? s.units['${id}'].status : 'destruido')`);
    if (outcome === 'ocupada') {
      expect(await game<number>(page, "Math.abs(s.countries.ARG.gdp - Object.values(s.regions).filter(x => x.controller === 'ARG').reduce((a, x) => a + x.gdp, 0))")).toBeLessThan(1e-6);
    } else {
      expect(['retreating', 'idle', 'moving', 'destruido']).toContain(outcome);
      expect(await game<string>(page, 's.regions.UY.controller')).toBe('URY');
    }

    // 6) El informe se abre desde Ejército con datos reales.
    await page.locator('[data-tab="army"]').tap();
    const link = page.locator('[data-report-link^="UY@"]').first();
    await link.scrollIntoViewIfNeeded();
    await link.tap();
    const card = page.locator('.battle-card');
    await expect(card).toContainText('Informe de batalla');
    await expect(card.getByTestId('losses-ARG')).not.toHaveText('0');

    // 7) Guardar, «cerrar» la app (pausa + autoguardado), recargar y recuperar el mismo estado.
    await page.locator('[data-tab="game"]').tap();
    await page.locator('[data-slot="3"]').tap();
    await expect(page.locator('.toast', { hasText: 'Partida guardada' })).toBeVisible();
    const snapshot = await game<string>(page, 'JSON.stringify({ h: s.hour, u: s.units, r: s.regions, w: s.wars, rep: s.battleReports })');
    await page.locator('[data-speed="1"]').tap();
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect.poll(() => game<number>(page, 'g.clock.speed')).toBe(0);
    await expect.poll(() => game<boolean>(page, 'g.saves.some(x => x.slot === "auto" && x.hour === s.hour)')).toBe(true);
    // Recargar la página (como cerrar y volver a abrir) y continuar desde el menú.
    await page.reload();
    await page.locator('.continue button').tap();
    await expect.poll(() => game<string>(page, 's ? JSON.stringify({ h: s.hour, u: s.units, r: s.regions, w: s.wars, rep: s.battleReports }) : ""')).toBe(snapshot);
  });
});

test.describe('Regresión: funciones esenciales', () => {
  test('selección de región y estado, reclutamiento, reposición pausable, inventario y economía', async ({ page }) => {
    test.setTimeout(120_000);
    await startGame(page, 'COL');
    // Selección de región/estado (Atlas).
    const p = await regionPoint(page, 'CO_AN');
    await page.touchscreen.tap(p.x, p.y);
    await expect(page.locator('.region-card .rc-name')).toBeVisible();
    // Reclutamiento de 2 batallones: estado real.
    await page.locator('[data-tab="army"]').tap();
    const n0 = await game<number>(page, "Object.values(s.units).filter(u => u.owner === 'COL').length");
    const reserve0 = await game<number>(page, "Object.values(s.countries.COL.inventory).reduce((a, b) => a + b, 0)");
    await page.getByRole('button', { name: 'Más' }).tap();
    await page.locator('[data-action="recruit"]').tap();
    expect(await game<number>(page, "Object.values(s.units).filter(u => u.owner === 'COL').length")).toBe(n0 + 2);
    expect(await game<number>(page, "Object.values(s.countries.COL.inventory).reduce((a, b) => a + b, 0)")).toBeLessThan(reserve0);
    const newIds = await game<string[]>(page, "Object.values(s.units).filter(u => u.owner === 'COL').slice(-2).map(u => u.id)");
    // Reposición: los voluntarios se incorporan con el tiempo.
    await fastTime(page, 200);
    await page.locator('[data-speed="3"]').tap();
    await expect.poll(() => game<number>(page, `s.units['${newIds[0]}'].men`), { timeout: 20_000 }).toBeGreaterThan(250);
    await page.locator('[data-speed="0"]').tap();
    // Pausar la reposición: un batallón con bajas no se repone.
    await page.locator('label.switch').first().tap();
    expect(await game<boolean>(page, 's.countries.COL.autoReplenish')).toBe(false);
    const veteran = await game<string>(page, "Object.values(s.units).find(u => u.owner === 'COL' && u.recruitPending === 0).id");
    await page.evaluate((id) => { (window as any).__game.state.units[id].men = 600; }, veteran);
    const h0 = await hour(page);
    await page.locator('[data-speed="3"]').tap();
    await expect.poll(() => hour(page), { timeout: 20_000 }).toBeGreaterThan(h0 + 48);
    await page.locator('[data-speed="0"]').tap();
    expect(await game<number>(page, `s.units['${veteran}'].men`)).toBe(600);
    // Economía: cambiar impuestos cambia el estado; el cierre mensual produce informe.
    await page.locator('[data-tab="economy"]').tap();
    await page.locator('#pol-taxRate').fill('30');
    await page.getByRole('button', { name: 'Aplicar cambios' }).tap();
    expect(await game<number>(page, 's.countries.COL.policy.taxRate')).toBe(30);
    await fastTime(page, 2000);
    await page.locator('[data-speed="3"]').tap();
    await expect.poll(() => game<boolean>(page, '!!s.countries.COL.lastReport'), { timeout: 30_000 }).toBe(true);
    await page.locator('[data-speed="0"]').tap();
  });

  test('declaración de guerra formal, Atlas (escalas y estado) y navegación táctil', async ({ page }) => {
    await startGame(page, 'PER');
    await page.locator('[data-tab="diplomacy"]').tap();
    await page.locator('.country-row', { hasText: 'Ecuador' }).tap();
    await page.getByRole('button', { name: /Declarar la guerra/ }).tap();
    await page.getByRole('button', { name: 'Confirmar declaración de guerra' }).tap();
    expect(await game<string>(page, 's.wars[0].name')).toContain('Guerra');
    await page.locator('[data-tab="map"]').tap();
    for (const band of ['continent', 'region', 'nation']) {
      await page.locator(`[data-scale-btn="${band}"]`).tap();
      await expect(page.locator('svg.map')).toHaveAttribute('data-scale', band);
    }
    const p = await regionPoint(page, 'PE_SU');
    await page.touchscreen.tap(p.x, p.y);
    await expect(page.locator('.state-card, .region-card').first()).toBeVisible();
    await page.locator('[data-action="toggle-panel"]').tap();
    await expect(page.locator('[data-action="toggle-panel"]')).toHaveAttribute('aria-expanded', 'false');
  });
});
