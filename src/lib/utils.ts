export function formatDate(date: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('it-IT', opts || { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null
  const today = new Date()
  const bd = new Date(birthDate)
  let age = today.getFullYear() - bd.getFullYear()
  const m = today.getMonth() - bd.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--
  return age
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buongiorno'
  if (h < 18) return 'Buon pomeriggio'
  return 'Buonasera'
}

/**
 * Genera un colore avatar deterministico a partire dalle iniziali.
 * Usa la palette Lenci Poirino (blu / rosso / giallo / verde).
 */
export function avatarBg(initials: string): string {
  const palette = [
    'linear-gradient(135deg, #005f98 0%, #0078bf 100%)',   // blu primario
    'linear-gradient(135deg, #b3005c 0%, #d13d84 100%)',   // rosa/tertiary
    'linear-gradient(135deg, #006e25 0%, #4caf50 100%)',   // verde
    'linear-gradient(135deg, #8e6300 0%, #d4a017 100%)',   // ambra
    'linear-gradient(135deg, #004a78 0%, #005f98 100%)',   // blu scuro
    'linear-gradient(135deg, #93000a 0%, #ba1a1a 100%)',   // rosso
  ]
  const seed = (initials || '??').charCodeAt(0) + (initials?.charCodeAt(1) || 0)
  return palette[seed % palette.length]
}
