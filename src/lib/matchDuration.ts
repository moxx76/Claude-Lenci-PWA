/**
 * matchDuration — helper per gestire la durata dei tempi di gioco per categoria.
 *
 * Nel calcio giovanile italiano ogni categoria ha durate diverse:
 *   Piccoli Amici    3×10 = 30 min
 *   Primi Calci      3×15 = 45 min
 *   Pulcini          3×15 = 45 min
 *   Esordienti       3×20 = 60 min
 *   Under 14 (Giov.) 2×30 = 60 min
 *   Under 16/17      2×40 = 80 min
 *   Under 19/Prima   2×45 = 90 min
 *
 * Salvati in teams.match_periods_count e teams.match_period_duration_min.
 * Default 2×45=90 se non impostati (retrocompatibile con il vecchio hardcoded).
 */

export interface MatchDuration {
  periodsCount: number
  periodDurationMin: number
  /** Totale in minuti (periodsCount * periodDurationMin) */
  totalMin: number
  /** Etichette dei tempi, es. ["T1", "T2"] per 2 tempi, ["T1", "T2", "T3"] per 3 tempi */
  periodLabels: string[]
  /** Marker minuti in cui finisce ogni tempo. Es. [30, 60] per 2×30, [15, 30, 45] per 3×15 */
  periodEndMarkers: number[]
}

const DEFAULT_PERIODS = 2
const DEFAULT_DURATION = 45

/** Costruisce l'oggetto MatchDuration da valori grezzi (nullish → default). */
export function makeMatchDuration(periodsCount: number | null | undefined, periodDurationMin: number | null | undefined): MatchDuration {
  const periods = periodsCount ?? DEFAULT_PERIODS
  const duration = periodDurationMin ?? DEFAULT_DURATION
  const total = periods * duration
  return {
    periodsCount: periods,
    periodDurationMin: duration,
    totalMin: total,
    periodLabels: Array.from({ length: periods }, (_, i) => `T${i + 1}`),
    periodEndMarkers: Array.from({ length: periods }, (_, i) => (i + 1) * duration),
  }
}

/** Preset comuni FIGC per il dropdown di scelta rapida in UI. */
export interface DurationPreset {
  label: string
  short: string
  periodsCount: number
  periodDurationMin: number
}

export const DURATION_PRESETS: DurationPreset[] = [
  { label: 'Piccoli Amici (3 tempi × 10 min = 30 min)',       short: '3×10', periodsCount: 3, periodDurationMin: 10 },
  { label: 'Primi Calci / Pulcini (3 tempi × 15 min = 45 min)', short: '3×15', periodsCount: 3, periodDurationMin: 15 },
  { label: 'Esordienti (3 tempi × 20 min = 60 min)',            short: '3×20', periodsCount: 3, periodDurationMin: 20 },
  { label: 'Under 14 / Giovanissimi (2 tempi × 30 min = 60 min)', short: '2×30', periodsCount: 2, periodDurationMin: 30 },
  { label: 'Under 15 Giovanissimi Nazionali (2 tempi × 35 min = 70 min)', short: '2×35', periodsCount: 2, periodDurationMin: 35 },
  { label: 'Under 16/17 / Allievi (2 tempi × 40 min = 80 min)', short: '2×40', periodsCount: 2, periodDurationMin: 40 },
  { label: 'Under 19 / Juniores / Prima squadra (2 tempi × 45 min = 90 min)', short: '2×45', periodsCount: 2, periodDurationMin: 45 },
]
