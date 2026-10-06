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
  },
})
