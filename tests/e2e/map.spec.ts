/** MAP-001: capas cartográficas, selección de ciudades y pasos, y separación del motor. */
import { test, expect, type Page } from '@playwright/test';
import { game, startGame, waitMapStable } from './helpers';

/** Fija la vista del mapa centrada en (x, y) con ancho w (unidades de mapa) y espera a que se estabilice. */
async function focus(page: Page, x: number, y: number, w: number) {
  await page.evaluate(([x, y, w]) => {
    const svg = document.querySelector('svg.map') as SVGSVGElement;
    const h = (w * svg.clientHeight) / svg.clientWidth;
    (window as unknown as { __setView: (v: { x: number; y: number; w: number }) => void }).__setView({ x: x - w / 2, y: y - h / 2, w });
  }, [x, y, w] as const);
  await expect(page.locator('svg.map')).toHaveAttribute('data-view-w', String(Math.round(w)));
}

/** Toca el centro exacto del icono (no el de su área táctil). */
async function tapIcon(page: Page, selector: string) {
  await waitMapStable(page);
  const p = await page.evaluate((sel) => {
    const el = document.querySelector(sel) as SVGGraphicsElement;
    const r = el.querySelector('.crossing-shape, .city-shape')!.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    if (!top || !document.querySelector('svg.map')!.contains(top)) throw new Error(`Icono tapado por ${top?.className}`);
    return { x, y };
  }, selector);
  await page.touchscreen.tap(p.x, p.y);
}

test('Capas: carreteras, pasos, ciudades, estados e instalaciones se muestran y ocultan; bases militares siguen previstas', async ({ page }) => {
  await startGame(page, 'ARG');
  expect(await page.locator('[data-layer="roads"] [data-road-network]').count()).toBeGreaterThanOrEqual(1);
  expect(await page.locator('[data-layer="crossings"] [data-crossing]').count()).toBeGreaterThanOrEqual(15);
  expect(await page.locator('[data-city-kind="capital"]').count()).toBe(12);
  expect(await page.locator('[data-layer="provinces"] [data-state]').count()).toBeGreaterThan(200);
  await page.getByRole('button', { name: 'Capas del mapa' }).tap();
  await expect(page.locator('.layer-row.planned')).toHaveCount(1);
  await expect(page.locator('#layer-bases')).toBeDisabled();
  for (const [id, sel] of [['roads', '[data-road-network]'], ['crossings', '[data-crossing]'], ['cities', '[data-city]'], ['provinces', '[data-state]']] as const) {
    await page.locator(`label[for="layer-${id}"]`).tap();
    await expect(page.locator(sel)).toHaveCount(0);
    await page.locator(`label[for="layer-${id}"]`).tap();
    expect(await page.locator(sel).count()).toBeGreaterThan(0);
  }
  // Capa prevista: grupo vacío, sin datos inventados.
  expect(await page.locator('g[data-layer="bases"] > *').count()).toBe(0);
});

test('Ocultar las capas cartográficas no altera el estado del motor', async ({ page }) => {
  await startGame(page, 'BRA');
  await page.locator('[data-speed="0"]').tap();
  const before = await game<string>(page, 'JSON.stringify(s)');
  await page.getByRole('button', { name: 'Capas del mapa' }).tap();
  for (const id of ['roads', 'crossings', 'cities']) await page.locator(`label[for="layer-${id}"]`).tap();
  await expect(page.locator('[data-city], [data-crossing], [data-road-network]')).toHaveCount(0);
  for (const id of ['roads', 'crossings', 'cities']) await page.locator(`label[for="layer-${id}"]`).tap();
  expect(await game<string>(page, 'JSON.stringify(s)')).toBe(before);
});

test('Seleccionar una capital muestra su información geográfica', async ({ page }) => {
  await startGame(page, 'ARG');
  await focus(page, 493, 1040, 240);
  await expect(page.locator('[data-city-label="ar-buenos-aires"]')).toBeVisible();
  await tapIcon(page, '[data-city="ar-buenos-aires"]');
  const card = page.locator('.city-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Buenos Aires');
  await expect(card.getByTestId('city-kind')).toHaveText('Capital nacional');
  await expect(card).toContainText('34,60° S');
  await expect(card).toContainText('Natural Earth');
  await expect(page.locator('[data-city="ar-buenos-aires"]')).toHaveClass(/sel/);
  // Sin estadísticas inventadas: la tarjeta no muestra población ni PIB de la ciudad.
  await expect(card).not.toContainText('Población');
  await expect(card).not.toContainText('PIB');
  // La región del juego enlaza con su tarjeta.
  await card.getByRole('button', { name: /Buenos Aires/ }).last().tap();
  await expect(page.locator('.region-card')).toBeVisible();
});

test('Bolivia: Sucre es la capital y La Paz la sede de gobierno', async ({ page }) => {
  await startGame(page, 'BOL');
  await focus(page, 292, 624, 200);
  await tapIcon(page, '[data-city="bo-la-paz"]');
  await expect(page.locator('.city-card')).toContainText('La Paz');
  await expect(page.locator('.city-card').getByTestId('city-kind')).toHaveText('Sede de gobierno');
  await focus(page, 352, 679, 200);
  await tapIcon(page, '[data-city="bo-sucre"]');
  await expect(page.locator('.city-card')).toContainText('Sucre');
  await expect(page.locator('.city-card').getByTestId('city-kind')).toHaveText('Capital nacional');
  await expect(page.locator('.city-card')).toContainText('Capital constitucional');
});

test('Pasos fronterizos: terrestre y fluvial se distinguen y muestran sus datos', async ({ page }) => {
  await startGame(page, 'ARG');
  await focus(page, 252, 996, 220);
  await tapIcon(page, '[data-crossing="x-los-libertadores"]');
  const card = page.locator('.crossing-card');
  await expect(card.getByTestId('crossing-type')).toHaveText('Terrestre');
  await expect(card).toContainText('Chile');
  await expect(card).toContainText('no influye en el movimiento de tropas');
  await expect(card.locator('.src-list a').first()).toHaveAttribute('href', /^https:\/\//);

  await focus(page, 499, 1039, 160);
  expect(await page.locator('.crossing-link').count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator('[data-crossing="x-buenos-aires-colonia"]')).toHaveAttribute('data-crossing-type', 'fluvial');
  await tapIcon(page, '[data-crossing="x-buenos-aires-colonia"]');
  await expect(card.getByTestId('crossing-type')).toHaveText('Fluvial');
  await expect(card).toContainText('Terminal Colonia del Sacramento');
  await expect(card).toContainText('Uruguay');
});

test('Al dar una orden de marcha, tocar una ciudad elige su región como destino', async ({ page }) => {
  await startGame(page, 'ARG');
  await page.locator('[data-units="AR_BA"][data-owner="ARG"]').tap();
  await page.locator('[data-action="move"]').tap();
  await expect(page.locator('.order-banner')).toBeVisible();
  await focus(page, 374, 930, 160); // ciudad en la mitad inferior: el aviso de orden ocupa la parte superior
  await tapIcon(page, '[data-city="ar-cordoba"]');
  await expect(page.locator('.toast').first()).toContainText('en marcha');
  const dest = await game<string[]>(page, "Object.values(s.units).filter(u => u.owner === 'ARG' && u.destination).map(u => u.destination)");
  expect(dest.length).toBeGreaterThan(0);
  expect(dest.every((d) => d === 'AR_NO')).toBe(true);
  await expect(page.locator('.city-card')).toHaveCount(0);
});

test('Los nombres de ciudades no se superponen entre sí, con otros rótulos ni con marcadores', async ({ page }) => {
  await startGame(page, 'BRA');
  // Vistas: inicial, sur de Brasil y Río de la Plata, Andes centrales, norte.
  const views: [number, number, number][] = [[0, 0, 0], [520, 930, 520], [470, 1010, 330], [300, 640, 420], [260, 300, 500]];
  let total = 0;
  for (const [x, y, w] of views) {
    if (w) await focus(page, x, y, w);
    const r = await page.evaluate(() => {
      const hit = (a: DOMRect, b: DOMRect) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const cities = [...document.querySelectorAll('[data-city-label]')].map((e) => e.getBoundingClientRect());
      let overlaps = 0;
      const names = [...document.querySelectorAll('[data-city-label]')].map((e) => e.textContent);
      const otherEls = [...document.querySelectorAll('[data-country-label]:not(.crowded) text, [data-region-label], .stack:not(.moving) .stack-box, .city-shape, .crossing-shape')];
      const others = otherEls.map((e) => e.getBoundingClientRect());
      const detail: string[] = [];
      cities.forEach((a, i) => {
        cities.forEach((b, j) => { if (j > i && hit(a, b) > 6) { overlaps++; detail.push(`${names[i]}~${names[j]}`); } });
        others.forEach((b, j) => { if (hit(a, b) > 6) { overlaps++; detail.push(`${names[i]}~${otherEls[j].textContent || otherEls[j].getAttribute('class')}:${(otherEls[j].closest('[data-city],[data-crossing]') as Element | null)?.getAttribute('data-city') ?? ''}`); } });
      });
      return { labels: cities.length, overlaps, detail: detail.join(' | ') };
    });
    total += r.labels;
    expect(r.overlaps, `vista ${x},${y},${w}: ${r.detail}`).toBe(0);
  }
  expect(total).toBeGreaterThan(5);
});
