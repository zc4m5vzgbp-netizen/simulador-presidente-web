/** ATLAS-001: escalas Continente/Nación/Región, niveles de detalle, fichas de estado e instalación, panel plegable. */
import { test, expect, type Page } from '@playwright/test';
import { game, pinch, regionPoint, startGame } from './helpers';

async function focus(page: Page, x: number, y: number, w: number) {
  await page.evaluate(([x, y, w]) => {
    const svg = document.querySelector('svg.map') as SVGSVGElement;
    const h = (w * svg.clientHeight) / svg.clientWidth;
    (window as unknown as { __setView: (v: { x: number; y: number; w: number }) => void }).__setView({ x: x - w / 2, y: y - h / 2, w });
  }, [x, y, w] as const);
  await expect(page.locator('svg.map')).toHaveAttribute('data-view-w', String(Math.round(w)));
}

const scale = (page: Page) => page.locator('svg.map').getAttribute('data-scale');

/** Rectángulos de pantalla de las etiquetas visibles que se solapan entre sí (tolerancia de 1 px). */
async function overlappingLabels(page: Page) {
  return page.evaluate(() => {
    const svg = document.querySelector('svg.map')!.getBoundingClientRect();
    const boxes = [...document.querySelectorAll('svg.map text.label')]
      .map((t) => ({ t: (t.textContent ?? '').trim(), r: t.getBoundingClientRect() }))
      .filter(({ t, r }) => t && r.width > 0 && r.right > svg.left && r.left < svg.right && r.bottom > svg.top && r.top < svg.bottom);
    const out: string[] = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].r, b = boxes[j].r;
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push(`${boxes[i].t} × ${boxes[j].t}`);
    }
    return out;
  });
}

test('Selector de escala: Continente, Nación y Región cambian el nivel de detalle', async ({ page }) => {
  await startGame(page, 'VEN');
  const sw = page.getByRole('radiogroup', { name: 'Escala del mapa' });
  await expect(sw).toBeVisible();
  expect(await scale(page)).toBe('nation');
  await expect(page.locator('[data-scale-btn="nation"]')).toHaveAttribute('aria-checked', 'true');
  // Nación: estados, autopistas y troncales, sin secundarias; unidades por pila.
  expect(await page.locator('[data-state]').count()).toBeGreaterThan(200);
  await expect(page.locator('[data-road-tier="motorway"], [data-road-tier="trunk"]')).toHaveCount(2);
  await expect(page.locator('[data-road-tier="secondary"]')).toHaveCount(0);

  await page.locator('[data-scale-btn="continent"]').tap();
  await expect(page.locator('svg.map')).toHaveAttribute('data-scale', 'continent');
  // Continente: países y agrupaciones militares; sin estados, vías ni instalaciones.
  await expect(page.locator('[data-state]')).toHaveCount(0);
  await expect(page.locator('[data-road-tier]')).toHaveCount(0);
  await expect(page.locator('[data-facility]')).toHaveCount(0);
  expect(await page.locator('[data-army]').count()).toBeGreaterThan(0);
  await expect(page.locator('[data-city-kind="capital"]')).toHaveCount(12);

  await page.locator('[data-scale-btn="region"]').tap();
  await expect(page.locator('svg.map')).toHaveAttribute('data-scale', 'region');
  // Región: también vías secundarias (las instalaciones se prueban aparte).
  await expect(page.locator('[data-road-tier="secondary"]')).toHaveCount(1);
  await expect(page.locator('[data-scale-btn="region"]')).toHaveAttribute('aria-checked', 'true');

  // Pellizcar para alejar actualiza el selector.
  await pinch(page, 0.4);
  await pinch(page, 0.4);
  await expect(page.locator('[data-scale-btn="region"]')).toHaveAttribute('aria-checked', 'false');
});

test('Tocar un estado abre su ficha real junto a los datos de la región del juego', async ({ page }) => {
  await startGame(page, 'VEN');
  await page.locator('[data-speed="0"]').tap();
  const before = await game<string>(page, 'JSON.stringify(s)');
  const p = await regionPoint(page, 'VE_CA');
  await page.touchscreen.tap(p.x, p.y);
  const card = page.locator('.state-card');
  await expect(card).toBeVisible();
  await expect(card.locator('.ic-name')).not.toBeEmpty();
  await expect(card).toContainText('Venezuela');
  await expect(card).toContainText('Natural Earth');
  await expect(page.locator('.region-card .rc-name')).toBeVisible();
  await expect(page.locator('.sel-state-fill')).toHaveCount(1);
  // Sin cifras inventadas en la ficha del estado.
  await expect(card).not.toContainText('Población');
  // Seleccionar no altera la partida.
  expect(await game<string>(page, 'JSON.stringify(s)')).toBe(before);
});

test('Aeropuerto: el icono abre su ficha con código y fuente; no inventa capacidades', async ({ page }) => {
  await startGame(page, 'BRA');
  await focus(page, 902.94, 356.59, 120);
  expect(await scale(page)).toBe('region');
  const p = await page.evaluate(() => {
    const r = document.querySelector('[data-facility="ap-for"] .fac-shape')!.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.touchscreen.tap(p.x, p.y);
  const card = page.locator('.facility-card');
  await expect(card).toBeVisible();
  await expect(card.getByTestId('facility-code')).toHaveText('FOR');
  await expect(card).toContainText('Pendiente');
  await expect(card).toContainText('Natural Earth');
  await expect(page.locator('[data-facility="ap-for"]')).toHaveClass(/sel/);
});

test('Continente: tocar una agrupación militar selecciona su país', async ({ page }) => {
  await startGame(page, 'COL');
  await page.locator('[data-scale-btn="continent"]').tap();
  await expect(page.locator('svg.map')).toHaveAttribute('data-scale', 'continent');
  const p = await page.evaluate(() => {
    const r = document.querySelector('[data-army="COL"] .stack-hit')!.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.touchscreen.tap(p.x, p.y);
  await expect(page.locator('.country-card, [aria-label^="País"]').first()).toBeVisible();
  await expect(page.locator('[data-army="COL"]')).toHaveClass(/sel/);
});

test('Plegar el panel derecho devuelve el espacio al mapa y desplegarlo lo recupera', async ({ page }) => {
  await startGame(page, 'ARG');
  const w0 = (await page.locator('svg.map').boundingBox())!.width;
  await page.locator('[data-action="toggle-panel"]').tap();
  await expect(page.locator('[data-action="toggle-panel"]')).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(async () => (await page.locator('svg.map').boundingBox())!.width).toBeGreaterThan(w0 + 100);
  await page.locator('[data-action="toggle-panel"]').tap();
  await expect.poll(async () => (await page.locator('svg.map').boundingBox())!.width).toBeLessThan(w0 + 2);
});

test('Los controles flotantes no se solapan entre sí y tienen tamaño táctil', async ({ page }) => {
  await startGame(page, 'BRA');
  const boxes = await page.evaluate(() => Object.fromEntries(
    ['.scale-switch', '.map-ctl', '.side-handle'].map((s) => [s, document.querySelector(s)!.getBoundingClientRect().toJSON()]),
  )) as Record<string, DOMRect>;
  const keys = Object.keys(boxes);
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    const a = boxes[keys[i]], b = boxes[keys[j]];
    expect(a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom, `${keys[i]} × ${keys[j]}`).toBe(false);
  }
  for (const h of await page.locator('[data-scale-btn], .map-ctl button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) {
    expect(h).toBeGreaterThanOrEqual(32);
  }
});

for (const band of ['continent', 'nation', 'region'] as const) {
  test(`Escala ${band}: las etiquetas visibles no se superponen`, async ({ page }) => {
    await startGame(page, 'ARG');
    if (band === 'region') await focus(page, 493, 1040, 160);
    else await page.locator(`[data-scale-btn="${band}"]`).tap();
    await expect(page.locator('svg.map')).toHaveAttribute('data-scale', band);
    expect(await overlappingLabels(page)).toEqual([]);
  });
}
