import { expect, type Page } from '@playwright/test';

/** Lee datos del estado real del juego (expuesto en window.__game para pruebas). */
export async function game<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(`(() => { const g = window.__game; const s = g.state; return (${fn}); })()`) as Promise<T>;
}

/** Punto de pantalla dentro de una región, visible y sin marcadores ni paneles encima. */
export async function regionPoint(page: Page, regionId: string): Promise<{ x: number; y: number }> {
  try {
    return await regionPointOnce(page, regionId);
  } catch {
    // En pantallas muy pequeñas la región puede quedar solo junto a los controles:
    // se centra el mapa en ella (como haría el jugador) y se vuelve a buscar.
    await page.evaluate((id) => {
      const svg = document.querySelector('svg.map') as SVGSVGElement;
      const bb = (svg.querySelector(`path[data-region="${id}"]`) as SVGPathElement).getBBox();
      const [, , w] = svg.getAttribute('viewBox')!.split(' ').map(Number);
      const h = (w * svg.clientHeight) / svg.clientWidth;
      (window as unknown as { __setView: (v: { x: number; y: number; w: number }) => void }).__setView({ x: bb.x + bb.width / 2 - w / 2, y: bb.y + bb.height / 2 - h / 2, w });
    }, regionId);
    return regionPointOnce(page, regionId);
  }
}

async function regionPointOnce(page: Page, regionId: string) {
  // Esperar a que el mapa deje de cambiar de tamaño (paneles que se abren o cierran).
  await page.evaluate(() => new Promise<void>((resolve) => {
    let last = '', stable = 0;
    const tick = () => {
      const svg = document.querySelector('svg.map');
      const r = svg?.getBoundingClientRect();
      const key = r ? `${r.width}|${r.height}|${svg!.getAttribute('viewBox')}` : '';
      stable = key === last ? stable + 1 : 0;
      last = key;
      if (stable >= 4) resolve(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  return page.evaluate((id) => {
    const svg = document.querySelector('svg.map') as SVGSVGElement;
    const path = svg.querySelector(`path[data-region="${id}"]`) as SVGPathElement;
    const bb = path.getBBox();
    const m = svg.getScreenCTM()!;
    // El navegador desvía un toque a un control cercano (ajuste táctil): se evitan
    // puntos a menos de 16 px de los controles flotantes del mapa (ATLAS-001).
    const controls = [...document.querySelectorAll('.scale-switch, .map-ctl, .side-handle, .order-banner, .minimap')].map((e) => e.getBoundingClientRect());
    const nearControl = (x: number, y: number) => controls.some((r) => x > r.left - 16 && x < r.right + 16 && y > r.top - 16 && y < r.bottom + 16);
    for (let fy = 0.5; fy < 0.97; fy += 0.06) {
      for (let fx = 0.5; fx < 0.97; fx += 0.06) {
        for (const [sx, sy] of [[fx, fy], [1 - fx, fy], [fx, 1 - fy], [1 - fx, 1 - fy]]) {
          const pt = svg.createSVGPoint();
          pt.x = bb.x + bb.width * sx; pt.y = bb.y + bb.height * sy;
          const p = pt.matrixTransform(m);
          const el = document.elementFromPoint(p.x, p.y);
          if (el && el.getAttribute('data-region') === id && !nearControl(p.x, p.y)) return { x: p.x, y: p.y };
        }
      }
    }
    throw new Error('Región no visible: ' + id);
  }, regionId);
}

export async function startGame(page: Page, country: string) {
  await page.goto('/index.html');
  await page.locator(`[data-country="${country}"]`).tap();
  await page.getByTestId('start').tap();
  await expect(page.getByTestId('date')).toContainText('1 ene 2027');
}

/** Simula un gesto de pellizco con dos punteros táctiles sobre el mapa. */
export async function pinch(page: Page, scale: number) {
  await page.evaluate((scale) => {
    const svg = document.querySelector('svg.map') as SVGSVGElement;
    const r = svg.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const fire = (type: string, id: number, x: number, y: number) =>
      svg.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: id === 1 }));
    const d0 = 40, d1 = 40 * scale;
    fire('pointerdown', 1, cx - d0, cy);
    fire('pointerdown', 2, cx + d0, cy);
    for (let i = 1; i <= 8; i++) {
      const d = d0 + ((d1 - d0) * i) / 8;
      fire('pointermove', 1, cx - d, cy);
      fire('pointermove', 2, cx + d, cy);
    }
    fire('pointerup', 1, cx - d1, cy);
    fire('pointerup', 2, cx + d1, cy);
  }, scale);
}

/**
 * Acelera el reloj SOLO en las pruebas (1 día = 5 min reales a ×1 haría esperar minutos).
 * No cambia reglas: el motor sigue simulando hora a hora.
 */
export async function fastTime(page: Page, scale = 200) {
  await page.evaluate((k) => { (window as unknown as { __game: { timeScale: number } }).__game.timeScale = k; }, scale);
}
