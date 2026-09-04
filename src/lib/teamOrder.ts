/**
 * Ritorna un numero di priorità per l'ordinamento squadre per età.
 * Più alto = squadra di età maggiore (adulti in cima).
 *
 * Ordine desiderato: Prima Squadra → Juniores → U19/17/16/14/13/12/11 →
 *   Esordienti → Pulcini A → Pulcini B → Primi Calci → Piccoli Amici
 */
export function teamAgeOrder(team: {
  category?: string | null; name?: string | null; age_range?: string | null
}): number {
  const cat = (team.category || '').toLowerCase()
  const name = (team.name || '').toLowerCase()
  const age = (team.age_range || '').toLowerCase()
  const all = `${cat} ${name} ${age}`

  if (all.includes('prima squadra') || cat === 'prima squadra' || age === 'senior') return 100
  if (all.includes('juniores')) return 90
  if (all.includes('allievi')) return 80
  if (all.includes('giovanissimi')) return 75

  // Under X — estraggo il numero (Under 19=69, Under 17=67, Under 16=66, Under 14=64…)
  const underMatch = all.match(/u-?(\d+)|under\s*(\d+)/i)
  if (underMatch) {
    const n = parseInt(underMatch[1] || underMatch[2], 10)
    if (!isNaN(n)) return 50 + n
  }

  if (all.includes('esordienti')) return 40
  if (all.includes('pulcini')) {
    // Pulcini A prima di B (A più grandi tipicamente)
    if (/\bpulcini\s*a\b/.test(all)) return 32
    if (/\bpulcini\s*b\b/.test(all)) return 31
    return 30
  }
  if (all.includes('primi calci')) return 20
  if (all.includes('piccoli amici')) return 10

  return 0
}

/**
 * Sort comparator: prima squadra a scendere.
 * A parità di età, ordina alfabeticamente per nome.
 */
export function sortTeamsByAge<T extends { category?: string | null; name?: string | null; age_range?: string | null }>(teams: T[]): T[] {
  return [...teams].sort((a, b) => {
    const oa = teamAgeOrder(a)
    const ob = teamAgeOrder(b)
    if (oa !== ob) return ob - oa
    return (a.name || '').localeCompare(b.name || '')
  })
}
