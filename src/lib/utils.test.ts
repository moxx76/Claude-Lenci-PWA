import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatDate, formatDateShort, formatDateTime, calculateAge, initials, greeting, avatarBg } from './utils'

/**
 * Test sulle utility di base. formatDate* usano toLocaleDateString con locale
 * it-IT: coprono null/empty e la forma tipica dei nostri campi di DB
 * (ISO string per date, Date object sporadicamente).
 */

describe('formatDate', () => {
  test('null/undefined → "-"', () => {
    expect(formatDate(null)).toBe('-')
    expect(formatDate(undefined)).toBe('-')
    expect(formatDate('')).toBe('-')
  })

  test('ISO string → formato giorno/mese/anno', () => {
    const r = formatDate('2026-10-07')
    expect(r).toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  test('Date object funziona come string', () => {
    const d = new Date('2026-10-07T10:00:00Z')
    const r = formatDate(d)
    expect(r).toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  test('opts custom passati a toLocaleDateString', () => {
    const r = formatDate('2026-10-07', { year: 'numeric' })
    expect(r).toBe('2026')
  })
})

describe('formatDateShort', () => {
  test('null → "-"', () => {
    expect(formatDateShort(null)).toBe('-')
  })

  test('ritorna "giorno mese_corto" italiano', () => {
    const r = formatDateShort('2026-10-07')
    expect(r.toLowerCase()).toMatch(/ott/)
  })
})

describe('formatDateTime', () => {
  test('null → "-"', () => {
    expect(formatDateTime(null)).toBe('-')
  })

  test('include ora e minuti', () => {
    const r = formatDateTime('2026-10-07T15:30:00')
    expect(r).toMatch(/15[:.]30/)
  })
})

describe('calculateAge', () => {
  // Fisso oggi al 7 ottobre 2026 per rendere i test deterministici
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-07T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  test('null → null', () => {
    expect(calculateAge(null)).toBe(null)
  })

  test('nato 7 ottobre 2000 → 26 (ha appena compiuto)', () => {
    expect(calculateAge('2000-10-07')).toBe(26)
  })

  test('nato 8 ottobre 2000 → 25 (non ancora compiuto)', () => {
    expect(calculateAge('2000-10-08')).toBe(25)
  })

  test('nato 1 gennaio 2010 → 16', () => {
    expect(calculateAge('2010-01-01')).toBe(16)
  })

  test('neonato (data recente) → 0', () => {
    expect(calculateAge('2026-01-15')).toBe(0)
  })
})

describe('initials', () => {
  test('null/undefined/empty → "?"', () => {
    expect(initials(null)).toBe('?')
    expect(initials(undefined)).toBe('?')
    expect(initials('')).toBe('?')
  })

  test('nome singolo → prime due lettere maiuscole', () => {
    expect(initials('Davide')).toBe('DA')
    expect(initials('al')).toBe('AL')
  })

  test('nome e cognome → iniziali', () => {
    expect(initials('Davide Mantovani')).toBe('DM')
    expect(initials('mario rossi')).toBe('MR')
  })

  test('nome con più spazi → iniziale primo + ultimo', () => {
    expect(initials('Jean-Luc Van der Berg')).toBe('JB')
  })

  test('whitespace extra viene normalizzato', () => {
    expect(initials('  Davide   Mantovani  ')).toBe('DM')
  })
})

describe('greeting', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  test('mattina (< 12) → Buongiorno', () => {
    vi.setSystemTime(new Date('2026-10-07T09:00:00'))
    expect(greeting()).toBe('Buongiorno')
  })

  test('pomeriggio (12-17) → Buon pomeriggio', () => {
    vi.setSystemTime(new Date('2026-10-07T15:00:00'))
    expect(greeting()).toBe('Buon pomeriggio')
  })

  test('sera (>= 18) → Buonasera', () => {
    vi.setSystemTime(new Date('2026-10-07T20:00:00'))
    expect(greeting()).toBe('Buonasera')
  })

  test('mezzanotte → Buongiorno', () => {
    vi.setSystemTime(new Date('2026-10-07T00:00:00'))
    expect(greeting()).toBe('Buongiorno')
  })
})

describe('avatarBg', () => {
  test('ritorna linear-gradient per iniziali note', () => {
    expect(avatarBg('DM')).toMatch(/^linear-gradient/)
    expect(avatarBg('AB')).toMatch(/^linear-gradient/)
  })

  test('deterministico (stesso input → stesso output)', () => {
    expect(avatarBg('DM')).toBe(avatarBg('DM'))
  })

  test('iniziali vuote/undefined non crasha', () => {
    expect(avatarBg('')).toMatch(/^linear-gradient/)
    expect(avatarBg(undefined as any)).toMatch(/^linear-gradient/)
  })
})
