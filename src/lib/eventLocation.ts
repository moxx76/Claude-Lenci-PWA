/**
 * eventLocation — Helpers condivisi per rendere ESPLICITA la città (località)
 * di ogni evento sui planner/report dell'app.
 *
 * Perché serve: su "Weekend del club", "Planner Weekend" e in generale sulle
 * card eventi mostravamo solo "🏠 Casa" / "✈️ Trasferta". L'utente deve dedurre
 * la città guardando l'avversario — scomodo e ambiguo per i tornei.
 *
 * Convenzione richiesta (richiesta Luca Palermo via Davide, 2026-10-01):
 *   - Casa:        Poirino (sede fissa Lenci)
 *   - Trasferta:   nome città estratto da location_address, es. "Rivoli"
 *   - Torneo:      "<città> – <nome torneo>", es. "Rivoli – Torneo Quattro Stagioni"
 *
 * L'icona 🏠 / ✈️ resta come supporto visivo ma la città diventa IL dato
 * principale della riga location.
 */

/** Città della sede casalinga Lenci (campo di Poirino). Fissa, per convenzione. */
export const HOME_CITY = 'Poirino'

/**
 * Estrae il nome della città da `location_address` (campo DB `matches.location_address`),
 * con fallback euristico su `location` quando l'indirizzo è assente o troppo povero.
 *
 * Pattern tipici osservati nei dati di produzione:
 *   "Via Fonte Antico 16, 10046 Poirino (TO)" → "Poirino"
 *   "Via Mombirone 44, 12043 Canale (CN)"     → "Canale"
 *   "Via Berlinguer, 40 - Nichelino (To)"     → "Nichelino"
 *   "Via Giardino, 4, 12040 Corneliano d'Alba CN" → "Corneliano d'Alba"
 *   "V. I. Silone,4 10043"                    → null (solo CAP)
 *   "Via gozzano 11"                          → null (nessuna città nel testo)
 *
 * Il fallback su `location` serve solo per stringhe tipo "Canale (CN)" o
 * "Orbassano" — i nomi di campo ("Campo Sportivo…") vengono scartati per
 * evitare di mostrarli al posto della città.
 */
export function extractCity(
  locationAddress: string | null | undefined,
  location?: string | null,
): string | null {
  const addr = (locationAddress || '').trim()
  if (addr) {
    // Normalizza il separatore " - " (usato come alternativa alla virgola) in ","
    // così la segmentazione finale è uniforme.
    //   "Via Berlinguer, 40 - Nichelino (To)" → "Via Berlinguer, 40, Nichelino (To)"
    const normalized = addr.replace(/\s+-\s+(?=[A-Za-zÀ-ÿ])/g, ', ')
    const parts = normalized.split(',').map(s => s.trim()).filter(Boolean)
    // Scansiono dall'ultimo segmento verso il primo: la città sta tipicamente
    // nell'ultima parte (dopo CAP e numero civico).
    for (let i = parts.length - 1; i >= 0; i--) {
      const city = cleanCitySegment(parts[i])
      if (city) return city
    }
  }
  // Fallback: location raw. Capita solo per record vecchi con solo "Città (PR)".
  const loc = (location || '').trim()
  if (loc) {
    // Scarto nomi campo tipici — non sono città
    if (/^(campo|comunale|sintetico|erba|parrocchiale|polisportiva|stadio|palazzetto)\b/i.test(loc)) {
      return null
    }
    const city = cleanCitySegment(loc)
    if (city) return city
  }
  return null
}

/**
 * Pulisce un singolo segmento di indirizzo:
 *   - rimuove la provincia in parentesi: "Poirino (TO)" → "Poirino"
 *   - rimuove la provincia in forma libera a fine stringa:
 *     "Corneliano d'Alba CN" → "Corneliano d'Alba"
 *   - rimuove il CAP in testa a 5 cifre: "10046 Poirino" → "Poirino"
 *   - scarta prefissi via/corso/piazza/strada (è un segmento di indirizzo, non città)
 *   - scarta segmenti con dentro cifre residue (civico, chilometro)
 */
function cleanCitySegment(s: string): string | null {
  // 1. Provincia in parentesi finale: "(TO)", "(CN)", "(To)"
  let v = s.replace(/\s*\([A-Za-zÀ-ÿ]{2,}\)\s*$/, '').trim()
  // 2. CAP iniziale a 5 cifre: "10046 Poirino" → "Poirino"
  v = v.replace(/^\d{5}\b[\s,]*/, '').trim()
  // 3. Provincia "libera" a fine stringa (2 lettere maiuscole): "...d'Alba CN"
  v = v.replace(/\s+[A-Z]{2}$/, '').trim()
  if (!v) return null
  // 4. Solo cifre → è un CAP residuo
  if (/^\d+$/.test(v)) return null
  // 5. Prefissi di tipologia stradale → non è una città
  if (/^(via|v\.|corso|c\.so|piazza|p\.za|p\.zza|v\.le|viale|str\.?|strada|loc\.|frazione|fraz\.)\b/i.test(v)) return null
  // 6. Scarta segmenti con dentro cifre residue (es. "40 Nichelino" non pulito)
  if (/\d/.test(v)) return null
  // 7. Lunghezza minima
  if (v.length < 2) return null
  return v
}

/**
 * Determina se un evento è un torneo in base alla stringa `competition`.
 * Case-insensitive: "Torneo", "torneo quattro stagioni", "poirino cup",
 * "lenci cup" vengono tutti considerati tornei.
 *
 * ⚠ Il kind del CalendarEvent di useCalendarEvents già pre-classifica,
 * ma su altre superfici (card dashboard, builder PNG) il kind arriva
 * come 'match' quindi serve il check sulla competition.
 */
export function isTournamentCompetition(competition: string | null | undefined): boolean {
  if (!competition) return false
  const c = competition.toLowerCase()
  return c.includes('torneo') || c.includes('cup') || c.includes('triangolare') || c.includes('quadrangolare')
}

export interface EventLocationParams {
  venue: 'home' | 'away' | null | undefined
  location?: string | null
  locationAddress?: string | null
  competition?: string | null
  /** Serve per non applicare la logica match/torneo ad allenamenti/riunioni/eventi. */
  kind: 'training' | 'match' | 'tournament' | 'marketing' | 'meeting'
}

/**
 * Variante STRINGA della riga location: utile per i Canvas 2D (builder PNG)
 * dove serve una singola riga da misurare e troncare.
 *
 * Formato di output:
 *   Casa (match):            "🏠 Poirino"
 *   Casa (torneo):           "🏠 Poirino – Torneo Quattro Stagioni"
 *   Trasferta (match):       "✈️ Rivoli"
 *   Trasferta (torneo):      "✈️ Rivoli – Torneo Quattro Stagioni"
 *   Trasferta senza città:   "✈️ <location raw>"
 *   Allenamento con sede:    "📍 Campo Comunale Poirino"
 *   Altro senza dati:        null
 */
export function formatEventLocationLine(params: EventLocationParams): string | null {
  const result = formatEventLocation(params)
  if (!result) return null
  return `${result.icon} ${result.label}`
}

/**
 * Variante STRUTTURATA della riga location: utile per i renderer React che
 * vogliono stilizzare icona e testo diversamente (colori, pesi, troncamento
 * separato). Restituisce `{ icon, label }` oppure null se non c'è nulla da
 * mostrare.
 */
export function formatEventLocation(params: EventLocationParams): { icon: string; label: string } | null {
  const { venue, location, locationAddress, competition, kind } = params
  const isTournament = kind === 'tournament' || isTournamentCompetition(competition)
  const isMatchLike = kind === 'match' || kind === 'tournament'

  if (isMatchLike) {
    if (venue === 'home') {
      // Casa: la sede è sempre Poirino. Il campo location contiene il nome
      // del campo ("Campo Sportivo Poirino") che è ridondante — vince la città.
      const city = HOME_CITY
      const label = isTournament && competition
        ? `${city} – ${competition.trim()}`
        : city
      return { icon: '🏠', label }
    }
    if (venue === 'away') {
      // Trasferta: estraggo la città dall'indirizzo, fallback al nome location
      const city = extractCity(locationAddress, location)
      // Se città mancante uso il nome location (es. "Orbassano") come fallback
      // visivo invece di mostrare un generico "Trasferta" sterile.
      const fallback = (location || '').trim()
      const base = city || fallback || 'Trasferta'
      const label = isTournament && competition
        ? `${base} – ${competition.trim()}`
        : base
      return { icon: '✈️', label }
    }
    // venue sconosciuto per una partita (dovrebbe essere raro): fallback puro
    if (location) return { icon: '📍', label: location }
    return null
  }

  // Allenamenti / marketing / riunioni: mostro il nome location grezzo, se c'è.
  if (location) return { icon: '📍', label: location }
  return null
}
