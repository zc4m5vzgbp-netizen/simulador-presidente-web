/**
 * Toques reales para las pruebas táctiles (MOBILE-001).
 *
 * Usa Input.dispatchTouchEvent del protocolo de Chromium: el navegador genera
 * por sí mismo los eventos touch* y pointer* como en un dispositivo táctil
 * (a diferencia de `pinch()` en helpers.ts, que fabrica PointerEvent a mano).
 * Solo funciona en los proyectos Chromium.
 */
import type { CDPSession, Page } from '@playwright/test';

export type Pt = { x: number; y: number };

export class Fingers {
  /** Dedos apoyados: identificador → posición. */
  private active = new Map<number, Pt>();
  private constructor(private cdp: CDPSession) {}

  static async on(page: Page): Promise<Fingers> {
    return new Fingers(await page.context().newCDPSession(page));
  }

  private send(type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', pts: [number, Pt][]) {
    return this.cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: pts.map(([id, p]) => ({ x: p.x, y: p.y, id, radiusX: 4, radiusY: 4, force: 1 })),
    });
  }

  /** Apoya los dedos indicados; el dedo i recibe el identificador i (se conservan los ya apoyados). */
  down(pts: Pt[]) { pts.forEach((p, i) => this.active.set(i, p)); return this.send('touchStart', [...this.active]); }
  /** Mueve los dedos activos (en orden de identificador) a estas posiciones. */
  move(pts: Pt[]) { [...this.active.keys()].sort().forEach((id, i) => { if (pts[i]) this.active.set(id, pts[i]); }); return this.send('touchMove', [...this.active]); }
  /** Levanta un solo dedo (por su identificador); los demás siguen apoyados. */
  lift(id: number) { const p = this.active.get(id)!; this.active.delete(id); return this.send('touchEnd', [[id, p]]); }
  /** Levanta todos los dedos. */
  up() { const pts = [...this.active]; this.active.clear(); return this.send('touchEnd', pts); }
  /** El sistema cancela el gesto (p. ej. una notificación o un gesto de iOS). */
  cancel() { this.active.clear(); return this.send('touchCancel', []); }

  /** Desliza los dedos de `from` a `to` en `steps` pasos (sin levantarlos). */
  async slide(from: Pt[], to: Pt[], steps = 10) {
    for (let i = 1; i <= steps; i++) {
      await this.move(from.map((p, j) => ({ x: p.x + ((to[j].x - p.x) * i) / steps, y: p.y + ((to[j].y - p.y) * i) / steps })));
    }
  }

  /** Arrastre completo con un dedo. */
  async drag(from: Pt, to: Pt, steps = 10) {
    await this.down([from]);
    await this.slide([from], [to], steps);
    await this.up();
  }
}

/** Rectángulo del mapa en pantalla. */
export async function mapRect(page: Page) {
  return page.evaluate(() => {
    const r = document.querySelector('svg.map')!.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
  });
}

/** Encuadre actual del mapa (viewBox) en unidades de mapa. */
export async function viewBox(page: Page) {
  const [x, y, w, h] = (await page.locator('svg.map').getAttribute('viewBox'))!.split(' ').map(Number);
  return { x, y, w, h };
}

/** Punto del mapa (unidades de mapa) que hay bajo un punto de pantalla. */
export async function mapPointAt(page: Page, p: Pt): Promise<Pt> {
  return page.evaluate(({ x, y }) => {
    const svg = document.querySelector('svg.map') as SVGSVGElement;
    const pt = svg.createSVGPoint();
    pt.x = x; pt.y = y;
    const m = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: m.x, y: m.y };
  }, p);
}

/** Punto de pantalla donde se dibuja un punto del mapa. */
export async function screenPointOf(page: Page, p: Pt): Promise<Pt> {
  return page.evaluate(({ x, y }) => {
    const svg = document.querySelector('svg.map') as SVGSVGElement;
    const pt = svg.createSVGPoint();
    pt.x = x; pt.y = y;
    const m = pt.matrixTransform(svg.getScreenCTM()!);
    return { x: m.x, y: m.y };
  }, p);
}

/** Espera a que React haya dibujado los últimos cambios (dos fotogramas). */
export function frames(page: Page) {
  return page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}
