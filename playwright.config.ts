import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de interfaz táctil. Sirve dist/ por HTTP (IndexedDB real).
 * Requiere haber ejecutado `npm run build` antes.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1 --directory dist',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: true,
  },
  projects: [
    // Emulación de iPhone (pantalla, táctil, userAgent) sobre Chromium.
    { name: 'iphone-chromium', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    // WebKit real (motor de Safari) si está instalado: npx playwright install webkit
    ...(process.env.PW_WEBKIT ? [{ name: 'iphone-webkit', use: { ...devices['iPhone 13'] } }] : []),
  ],
});
