import { test, expect } from '@playwright/test'

/**
 * Smoke test: raggiungiamo tutte le pagine pubbliche, verifichiamo che
 * il bootstrap React non muoia e che il service worker si registri
 * sul primo caricamento. Girano contro produzione o contro E2E_BASE_URL.
 *
 * Non copriamo login/CRUD perché richiederebbero credenziali di test
 * (coperte dalla matrice di test manuale ruolo-per-ruolo).
 */

test.describe('bootstrap base', () => {
  test('homepage carica, titolo HTML corretto', async ({ page }) => {
    await page.goto('/')
    // Titolo definito in index.html
    await expect(page).toHaveTitle(/Lenci/i)
  })

  test('/version.json servito dal SW/Netlify risponde con APP_VERSION corrente', async ({ page }) => {
    const response = await page.request.get('/version.json')
    expect(response.status()).toBe(200)
    const body = await response.json()
    // Deve contenere version in formato semver
    expect(body.version).toMatch(/^\d+\.\d+\.\d+$/)
    // Deve contenere builtAt in ISO
    expect(body.builtAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  test('index.html carica senza errori console critici', async ({ page }) => {
    const criticalErrors: string[] = []
    page.on('pageerror', e => criticalErrors.push(e.message))
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // Ignora errori di fetch 401/403 (login mancante) e preload HTTP
        if (!text.includes('401') && !text.includes('403') && !text.includes('preload')) {
          criticalErrors.push(text)
        }
      }
    })
    await page.goto('/', { waitUntil: 'networkidle' })
    expect(criticalErrors, criticalErrors.join('\n')).toEqual([])
  })

  test('root element React montato con contenuto', async ({ page }) => {
    await page.goto('/')
    // #root esiste nell'index.html e viene popolato da React al bootstrap
    const root = page.locator('#root')
    await expect(root).toBeAttached()
    // Attendo che React abbia popolato il root (innerHTML non vuoto)
    await expect.poll(
      async () => (await root.innerHTML()).length,
      { timeout: 10_000 }
    ).toBeGreaterThan(100)
  })

  test('login form raggiungibile per utente non autenticato', async ({ page }) => {
    await page.goto('/')
    // L'app senza sessione dovrebbe mostrare il form di login:
    // cerco un input email e un input password visibili
    const email = page.locator('input[type="email"]').first()
    await expect(email).toBeVisible({ timeout: 10_000 })
    const password = page.locator('input[type="password"]').first()
    await expect(password).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('PWA service worker', () => {
  test('service worker si registra entro 15s', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    // Workbox autoUpdate registra sw.js al load, può richiedere qualche
    // tick in più in Chromium headless. Polling fino a 15s.
    await expect.poll(
      async () => page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return false
        // navigator.serviceWorker.ready aspetta che un SW sia attivo
        try {
          const reg = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise(res => setTimeout(() => res(null), 500)),
          ])
          return !!reg
        } catch {
          return false
        }
      }),
      { timeout: 15_000, intervals: [1000, 1000, 2000] }
    ).toBe(true)
  })

  test('manifest.webmanifest è servito con icon list completa', async ({ page }) => {
    const resp = await page.request.get('/manifest.webmanifest')
    expect(resp.status()).toBe(200)
    const m = await resp.json()
    expect(m.name).toMatch(/Lenci LAB/i)
    expect(m.icons).toBeDefined()
    expect(m.icons.length).toBeGreaterThanOrEqual(3)
    // Deve esserci almeno una icon maskable per Android/iOS adaptive
    const maskable = m.icons.some((i: any) => (i.purpose || '').includes('maskable'))
    expect(maskable).toBe(true)
  })
})

test.describe('route pubbliche', () => {
  // Route protette rediregono a login via NotForJournalist/auth guard,
  // ma devono comunque rispondere 200 (SPA fallback). Netlify serve
  // index.html su qualsiasi path, quindi ogni URL ritorna 200.
  const protectedRoutes = [
    '/teams',
    '/calendario',
    '/comunicati',
    '/referti',
    '/esercizi',
    '/profile',
    '/moduli',
    '/marketing',
    '/giornalisti',
  ]

  for (const path of protectedRoutes) {
    test(`SPA fallback risponde a ${path}`, async ({ page }) => {
      const resp = await page.goto(path)
      expect(resp?.status()).toBe(200)
      // index.html contiene #root, che l'SPA popola in base all'auth
      await expect(page.locator('#root')).toBeAttached()
    })
  }
})
