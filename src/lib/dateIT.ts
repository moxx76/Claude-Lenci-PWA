/**
 * A10 — Date civili Europe/Rome centralizzate.
 *
 * Il bug era: 49 occorrenze di `new Date().toISOString().slice(0, 10)` per
 * ottenere "oggi" come YYYY-MM-DD. toISOString() ritorna UTC, non il fuso
 * locale: in Italia alle 00:30 del 7 ottobre, UTC è ancora 6 ottobre 22:30,
 * quindi "oggi" risultava il 6 ottobre nei dati salvati (eventi persi,
 * scadenze mediche sbagliate, planner che non mostrava la giornata reale).
 *
 * Questo helper usa Intl.DateTimeFormat con timeZone="Europe/Rome" per
 * ottenere la data civile italiana indipendentemente dal fuso del dispositivo.
 *
 * Convenzione:
 * - todayIT()           → YYYY-MM-DD per "oggi civile Italia"
 * - dateIT(d)           → YYYY-MM-DD per una data arbitraria, in Europe/Rome
 * - timeIT(d)           → HH:MM in Europe/Rome
 * - combineIT(d, h)     → ISO timestamp di d a ora h minuti m (Europe/Rome)
 */

const DTF_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Rome',
  year: 'numeric', month: '2-digit', day: '2-digit',
})

const DTF_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Rome',
  hour: '2-digit', minute: '2-digit', hour12: false,
})

/** YYYY-MM-DD per "oggi civile" in Europa/Roma. */
export function todayIT(): string {
  return DTF_DATE.format(new Date())
}

/** YYYY-MM-DD per una data arbitraria, visualizzata nel fuso Europe/Rome. */
export function dateIT(d: Date | string | number): string {
  const dt = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d
  return DTF_DATE.format(dt)
}

/** HH:MM per una data arbitraria in Europe/Rome. */
export function timeIT(d: Date | string | number): string {
  const dt = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d
  return DTF_TIME.format(dt)
}

/** Confronta due date come giorno civile Europe/Rome. */
export function sameDayIT(a: Date | string, b: Date | string): boolean {
  return dateIT(a) === dateIT(b)
}

/** Formatta "oggi" come "Oggi" / data breve in italiano. */
export function labelDayIT(d: Date | string | number): string {
  const target = dateIT(d)
  const today = todayIT()
  if (target === today) return 'Oggi'
  // Calcolo "domani" / "ieri" civili italiani
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 86_400_000)
  const yesterday = new Date(now.getTime() - 86_400_000)
  if (target === dateIT(tomorrow)) return 'Domani'
  if (target === dateIT(yesterday)) return 'Ieri'
  // Fallback: "7 ott 2026"
  const dt = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(dt)
}
