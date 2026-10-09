import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Plugin: scrive dist/version.json a build time, letto all'avvio dell'app
 * (VersionGuard) e dal SW per rilevare deploy nuovi senza passare dal precache.
 * version.json è sempre servito NetworkOnly dal SW (vedi sw.ts), così il check
 * all'avvio bypassa qualsiasi cache HTTP/Workbox e scopre deploy nuovi in 1 fetch.
 */
function writeVersionJson() {
  return {
    name: 'write-version-json',
    closeBundle() {
      try {
        const versionTs = fs.readFileSync(path.resolve(__dirname, 'src/lib/version.ts'), 'utf8')
        const m = versionTs.match(/APP_VERSION\s*=\s*'([^']+)'/)
        const version = m ? m[1] : '0.0.0'
        const out = { version, builtAt: new Date().toISOString() }
        fs.writeFileSync(path.resolve(__dirname, 'dist/version.json'), JSON.stringify(out))
        console.log(`[write-version-json] dist/version.json → ${version}`)
      } catch (e) {
        console.warn('[write-version-json] skip', e)
      }
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    writeVersionJson(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['favicon.svg', 'apple-touch-icon.svg'],
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Escludi i PDF seed (vengono importati una tantum nello Storage al primo
        // load admin): non vanno precached dal SW, sono assets statici serviti
        // on-demand via /moduli-seed/<file>.pdf
        globIgnores: ['**/moduli-seed/**'],
      },
      manifest: {
        name: 'Lenci LAB · ASD Lenci Poirino',
        short_name: 'Lenci LAB',
        description: 'Lenci LAB · dati, analisi e crescita — l\'app di ASD Lenci O.N.L.U.S. Poirino per staff, atleti e famiglie',
        theme_color: '#005f98',
        background_color: '#005f98',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'it',
        categories: ['sports', 'lifestyle'],
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: {
        enabled: false,
        type: 'module',
      },
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        /**
         * M10 — manualChunks per splittare le vendor libs dal codice applicativo.
         * Benefici:
         * 1. Caching molto migliore: le vendor non cambiano tra deploy, il
         *    browser le serve dalla cache per settimane
         * 2. Il chunk shared tra pagine lazy non trascina più tutte le dipendenze
         *    npm, solo utility applicative
         * 3. Download parallelo: il browser scarica vendor e app simultaneamente
         */
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          // React core: cambia solo quando aggiorno React major
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) {
            return 'vendor-react'
          }
          // Supabase client: cambia raramente, grosso
          if (id.includes('/@supabase/')) return 'vendor-supabase'
          // Workbox/IDB (PWA): usati dal SW e dal client
          if (id.includes('/workbox-') || id.includes('/idb/')) return 'vendor-pwa'
          // Router: breaking change raro, cambio solo quando aggiorno
          if (id.includes('/react-router')) return 'vendor-router'
          // DOMPurify (sanitizeSvg): piccola ma isolata
          if (id.includes('/dompurify/')) return 'vendor-sanitize'
          // PDF + Canvas (gross, usati solo nei flussi export PNG/PDF):
          // isolati così possono stare in chunk che vive solo quando serve.
          if (id.includes('/pdf-lib') || id.includes('/html2canvas') || id.includes('/jspdf')) {
            return 'vendor-pdf-canvas'
          }
          // pdfjs-dist: usato solo nell'import FIGC (M23). ~500KB, chunk a sé
          // caricato lazy insieme a ImportFigc.
          if (id.includes('/pdfjs-dist/')) {
            return 'vendor-pdfjs'
          }
          // Date/i18n libs
          if (id.includes('/date-fns') || id.includes('/dayjs') || id.includes('/luxon')) {
            return 'vendor-date'
          }
          // State management + utility piccole (zustand, immer, nanoid, ecc.)
          return 'vendor-misc'
        },
      },
    },
  },
})
