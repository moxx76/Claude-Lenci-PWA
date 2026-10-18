/**
 * Helper centralizzato per formattare il risultato di una partita.
 * Supporta:
 *  - score regolamentare (home-away) ordinato lato "Noi" / "Loro" via `venue`
 *  - M27: suffisso " (X-Y d.c.r.)" quando la gara è stata decisa ai rigori
 *
 * Usage:
 *   formatMatchScore({ venue: 'home', homeScore: 1, awayScore: 1, shootoutHome: 5, shootoutAway: 3 })
 *   // → "1-1 (5-3 d.c.r.)" dal nostro punto di vista (siamo in casa)
 */

export interface MatchScoreInput {
  venue: 'home' | 'away'
  homeScore: number | null | undefined
  awayScore: number | null | undefined
  shootoutHome?: number | null
  shootoutAway?: number | null
  /** M29: minuti totali di tempi supplementari giocati (0/null = non giocati). */
  extraTimeMinutes?: number | null
}

export function formatMatchScore(m: MatchScoreInput): string {
  const h = m.homeScore
  const a = m.awayScore
  if (h == null || a == null) return '—'
  const isHome = m.venue === 'home'
  const our = isHome ? h : a
  const their = isHome ? a : h
  let base = `${our}-${their}`
  const hadExtra = m.extraTimeMinutes != null && m.extraTimeMinutes > 0
  if (hadExtra) base += ' dts'
  if (m.shootoutHome != null || m.shootoutAway != null) {
    const sh = m.shootoutHome ?? 0
    const sa = m.shootoutAway ?? 0
    const ourShoot = isHome ? sh : sa
    const theirShoot = isHome ? sa : sh
    base += ` (${ourShoot}-${theirShoot} d.c.r.)`
  }
  return base
}

/**
 * Variant: assume prospettiva naturale home-away senza venue (per visualizzazioni
 * neutre tipo tabellone pubblico).
 */
export function formatMatchScoreNeutral(
  homeScore: number | null | undefined,
  awayScore: number | null | undefined,
  shootoutHome?: number | null,
  shootoutAway?: number | null,
  extraTimeMinutes?: number | null,
): string {
  if (homeScore == null || awayScore == null) return '—'
  let base = `${homeScore}-${awayScore}`
  if (extraTimeMinutes != null && extraTimeMinutes > 0) base += ' dts'
  if (shootoutHome != null || shootoutAway != null) {
    base += ` (${shootoutHome ?? 0}-${shootoutAway ?? 0} d.c.r.)`
  }
  return base
}

/**
 * Determina esito dal punto di vista Lenci: 'win' | 'draw' | 'loss'.
 * Se c'è shootout, chi vince ai rigori prende il risultato (la UI può comunque
 * mostrare "D" per il regolamentare: dipende dalla scelta prodotto).
 * Qui restituiamo il vincitore considerando ANCHE i rigori quando presenti —
 * utile per sapere "siamo passati" nelle fasi finali.
 */
export function matchOutcome(m: MatchScoreInput): 'win' | 'draw' | 'loss' | null {
  const h = m.homeScore
  const a = m.awayScore
  if (h == null || a == null) return null
  const isHome = m.venue === 'home'
  const our = isHome ? h : a
  const their = isHome ? a : h
  if (our > their) return 'win'
  if (our < their) return 'loss'
  // Pari ai regolamentari: controlla shootout
  if (m.shootoutHome != null || m.shootoutAway != null) {
    const sh = m.shootoutHome ?? 0
    const sa = m.shootoutAway ?? 0
    const ourShoot = isHome ? sh : sa
    const theirShoot = isHome ? sa : sh
    if (ourShoot > theirShoot) return 'win'
    if (ourShoot < theirShoot) return 'loss'
  }
  return 'draw'
}
