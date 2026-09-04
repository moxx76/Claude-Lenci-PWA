import { useEffect, useState } from 'react'
import { APP_VERSION } from '../lib/version'

const STORAGE_KEY = 'lenci_last_seen_version'

/**
 * Rileva se l'utente sta aprendo l'app dopo un aggiornamento.
 * - Al primo accesso in assoluto NON mostra il changelog (esperienza pulita).
 * - Ai successivi accessi, se la versione installata è diversa dall'ultima vista, mostra il changelog.
 * - L'utente può marcare come "letto" e non lo vedrà più fino al prossimo update.
 */
export function useVersionCheck() {
  const [showChangelog, setShowChangelog] = useState(false)

  useEffect(() => {
    try {
      const lastSeen = localStorage.getItem(STORAGE_KEY)
      if (lastSeen === null) {
        // Primo accesso in assoluto: registro la versione corrente senza mostrare nulla
        localStorage.setItem(STORAGE_KEY, APP_VERSION)
        return
      }
      if (lastSeen !== APP_VERSION) {
        // C'è stato un update
        setShowChangelog(true)
      }
    } catch {
      // localStorage non disponibile: ignora silenziosamente
    }
  }, [])

  const markSeen = () => {
    try {
      localStorage.setItem(STORAGE_KEY, APP_VERSION)
    } catch {
      // ignore
    }
    setShowChangelog(false)
  }

  return { showChangelog, markSeen }
}
