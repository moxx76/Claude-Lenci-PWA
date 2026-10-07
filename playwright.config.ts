import { defineConfig, devices } from '@playwright/test'

/**
 * Config E2E smoke tests contro la produzione Lenci LAB.
 *
 * SCOPO: catturare rotture base dopo ogni deploy (sito giù, bootstrap
 * JS fallito, SW rotto, routing non raggiungibile). NON è un test
 * funzionale (coperture di login/CRUD servirebbero credenziali di
 * test persistenti). Girano in <30s e sono invocabili con npm run e2e.
 *
 * Chromium viene fornito pre-installato dall'ambiente di sviluppo in
 * /opt/pw-browsers; PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 evita il
 * download automatico. In CI il download si attiva automaticamente.
 */
export default defineConfig({
  testDir: './tests/e2e',
  // Fully parallel: ogni test è indipendente
  fullyParallel: true,
  // Fail fast in CI: niente retry mascherante
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://lenci-poirino-app.netlify.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Lingua app è italiana
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // L'ambiente di sviluppo monta un Chromium 1194 pre-installato in
        // /opt/pw-browsers/chromium-1194/. @playwright/test 1.63 vuole la
        // revisione 1243: lo lanciamo direttamente dall'eseguibile che
        // c'è, evitando il download che fallirebbe (download bloccato dal
        // proxy, vedi PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1). In CI dove il
        // download funziona, questa variabile può essere unset per
        // tornare al binary che Playwright preferirebbe.
        launchOptions: process.env.CI
          ? {}
          : { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' },
      },
    },
  ],
  timeout: 30_000,
  expect: { timeout: 10_000 },
})
