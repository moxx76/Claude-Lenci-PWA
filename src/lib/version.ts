/**
 * Versione dell'app e storico release.
 * Ad ogni deploy: aggiornare APP_VERSION e aggiungere una nuova entry in CHANGELOG in cima.
 * Convention semver: MAJOR.MINOR.PATCH
 *  - PATCH: fix bug, piccole rifiniture
 *  - MINOR: nuove feature retrocompatibili
 *  - MAJOR: breaking change o riscrittura importante
 */

export const APP_VERSION = '1.9.136'
export const APP_VERSION_DATE = '2026-10-07'

export interface Release {
  version: string
  date: string        // ISO YYYY-MM-DD
  title?: string
  features?: string[]  // ✨ novità
  fixes?: string[]     // 🐛 fix bug
  notes?: string[]     // 📌 note / anticipazioni
}

