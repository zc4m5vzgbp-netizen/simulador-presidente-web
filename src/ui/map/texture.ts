/**
 * Textura de relieve sutil generada en el navegador (ruido suave en escala de
 * grises). Da al terreno un aspecto cartográfico sin descargar imágenes.
 * Se genera una sola vez; si no hay canvas (pruebas), no se usa.
 */
let cached: string | null | undefined;

export function reliefTexture(): string | null {
  if (cached !== undefined) return cached;
  try {
    const size = 160;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return (cached = null);
    // Ruido de valor con interpolación (2 octavas), determinista.
    let seed = 1234567;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const grid = (n: number) => Array.from({ length: n + 1 }, () => Array.from({ length: n + 1 }, rnd));
    const g1 = grid(8), g2 = grid(24);
    const sample = (g: number[][], n: number, x: number, y: number) => {
      const fx = (x / size) * n, fy = (y / size) * n;
      const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const s = (t: number) => t * t * (3 - 2 * t);
      const a = g[iy % n][ix % n], b = g[iy % n][(ix + 1) % n], c = g[(iy + 1) % n][ix % n], d = g[(iy + 1) % n][(ix + 1) % n];
      return (a + (b - a) * s(tx)) * (1 - s(ty)) + (c + (d - c) * s(tx)) * s(ty);
    };
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = 0.65 * sample(g1, 8, x, y) + 0.35 * sample(g2, 24, x, y);
        const shade = v > 0.5 ? 255 : 0;
        const alpha = Math.abs(v - 0.5) * 2 * 70;
        const i = (y * size + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = shade;
        img.data[i + 3] = alpha;
      }
    }
    ctx.putImageData(img, 0, 0);
    cached = canvas.toDataURL('image/png');
  } catch {
    cached = null;
  }
  return cached;
}
