import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de interfaz táctil en horizontal. Sirve dist/ por HTTP (IndexedDB real).
 * Requiere haber ejecutado `npm run build` antes.
 *
 * Se emula el iPhone (pantalla, táctil, userAgent) sobre Chromium. WebKit (el
 * motor de Safari) se puede añadir con PW_WEBKIT=1 tras `npx playwright install webkit`.
 */
const landscape = [
  { name: 'iphone15promax-landscape', device: devices['iPhone 15 Pro Max landscape'] },
  { name: 'iphoneSE-landscape', device: devices['iPhone SE landscape'] },
];

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  // En CI, cada fallo aparece como anotación en GitHub.
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1 --directory dist',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: true,
  },
  projects: [
    ...landscape.map((p) => ({ name: p.name, use: { ...p.device, browserName: 'chromium' as const } })),
    ...(process.env.PW_WEBKIT ? landscape.map((p) => ({ name: `${p.name}-webkit`, use: { ...p.device } })) : []),
  ],
});
