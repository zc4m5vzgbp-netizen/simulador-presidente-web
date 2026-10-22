import { test, expect, type Page } from '@playwright/test';
import { startGame } from './helpers';

/**
 * Capturas de la cartografía (MAP-001) para documentación.
 * Solo se ejecuta con SHOTS=1:  SHOTS=1 npx playwright test screenshots
 */
test.skip(!process.env.SHOTS, 'Solo para generar capturas (SHOTS=1).');

const dir = 'docs/map-001';

async function focus(page: Page, x: number, y: number, w: number) {
  await page.evaluate(([x, y, w]) => {
    const svg = document.querySelector('svg.map') as SVGSVGElement;
    const h = (w * svg.clientHeight) / svg.clientWidth;
    (window as unknown as { __setView: (v: { x: number; y: number; w: number }) => void }).__setView({ x: x - w / 2, y: y - h / 2, w });
  }, [x, y, w] as const);
  await expect(page.locator('svg.map')).toHaveAttribute('data-view-w', String(Math.round(w)));
  await page.waitForTimeout(250);
}

async function tapIcon(page: Page, selector: string) {
  const p = await page.evaluate((sel) => {
    const r = document.querySelector(sel)!.querySelector('.crossing-shape, .city-shape')!.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, selector);
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(400);
}

test('capturas de cartografía', async ({ page }, info) => {
  const p = info.project.name.replace('-landscape', '');
  await startGame(page, 'ARG');
  await page.screenshot({ path: `${dir}/${p}-1-vista-inicial.png` });

  await focus(page, 470, 1000, 330);
  await page.screenshot({ path: `${dir}/${p}-2-zoom-rio-de-la-plata.png` });

  await focus(page, 499, 1039, 150);
  await tapIcon(page, '[data-crossing="x-buenos-aires-colonia"]');
  await page.screenshot({ path: `${dir}/${p}-3-paso-fluvial.png` });

  await focus(page, 250, 1000, 230);
  await tapIcon(page, '[data-crossing="x-los-libertadores"]');
  await page.screenshot({ path: `${dir}/${p}-4-paso-terrestre.png` });

  await focus(page, 320, 655, 300);
  await tapIcon(page, '[data-city="bo-la-paz"]');
  await page.screenshot({ path: `${dir}/${p}-5-sede-la-paz.png` });

  await page.getByRole('button', { name: 'Capas del mapa' }).tap();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${dir}/${p}-6-capas.png` });
});
