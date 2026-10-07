import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest'
import { todayIT, dateIT, timeIT, sameDayIT, labelDayIT } from './dateIT'

/**
 * Test del helper date centrale (A10).
 * Il bug che vogliamo prevenire: in Italia alle 00:30 del 7 ottobre,
 * UTC è ancora 6 ottobre 22:30. new Date().toISOString().slice(0,10)
 * dava "2026-10-06"; dateIT/todayIT devono dare "2026-10-07".
 */

describe('dateIT', () => {
  test('ritorna YYYY-MM-DD civile Europe/Rome per una data chiara di giorno', () => {
    // 7 ottobre 2026 ore 10:00 locale Italia = 08:00 UTC
    const d = new Date('2026-10-07T08:00:00Z')
    expect(dateIT(d)).toBe('2026-10-07')
  })

  test('non slitta al giorno precedente alle 00:30 CEST', () => {
    // 7 ottobre 2026 00:30 Italia (CEST, UTC+2) = 6 ottobre 22:30 UTC
    const d = new Date('2026-10-06T22:30:00Z')
    expect(dateIT(d)).toBe('2026-10-07')
  })

  test('gestisce correttamente CET (UTC+1) dopo cambio ora', () => {
    // 1 novembre 2026 00:30 Italia (CET, UTC+1) = 31 ottobre 23:30 UTC
    const d = new Date('2026-10-31T23:30:00Z')
    expect(dateIT(d)).toBe('2026-11-01')
  })

  test('gestisce stringa ISO', () => {
    expect(dateIT('2026-07-15T12:00:00Z')).toBe('2026-07-15')
  })

  test('gestisce timestamp number', () => {
    const ts = new Date('2026-03-10T09:00:00Z').getTime()
    expect(dateIT(ts)).toBe('2026-03-10')
  })
})

describe('todayIT', () => {
  afterAll(() => vi.useRealTimers())

  test('alle 00:30 CEST ritorna il giorno appena iniziato, non quello UTC', () => {
    vi.useFakeTimers()
    // 7 ottobre 2026 00:30 Italia (CEST, UTC+2) = 6 ottobre 22:30 UTC
    vi.setSystemTime(new Date('2026-10-06T22:30:00Z'))
    expect(todayIT()).toBe('2026-10-07')
  })

  test('a mezzogiorno restituisce il giorno corrente', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-07T10:00:00Z'))
    expect(todayIT()).toBe('2026-10-07')
  })
})

describe('timeIT', () => {
  test('ritorna HH:MM civile Europe/Rome con CEST', () => {
    // 15:00 UTC luglio = 17:00 CEST
    expect(timeIT('2026-07-15T15:00:00Z')).toBe('17:00')
  })

  test('ritorna HH:MM corretto con CET', () => {
    // 15:00 UTC gennaio = 16:00 CET
    expect(timeIT('2026-01-15T15:00:00Z')).toBe('16:00')
  })
})

describe('sameDayIT', () => {
  test('due timestamp UTC che cadono nello stesso giorno civile IT', () => {
    // 6 ott 22:30 UTC + 6 ott 23:50 UTC: entrambi 7 ott IT (CEST)
    expect(sameDayIT('2026-10-06T22:30:00Z', '2026-10-06T23:50:00Z')).toBe(true)
  })

  test('due timestamp UTC in giorni civili IT diversi', () => {
    // 6 ott 21:00 UTC = 6 ott 23:00 IT; 7 ott 03:00 UTC = 7 ott 05:00 IT
    expect(sameDayIT('2026-10-06T21:00:00Z', '2026-10-07T03:00:00Z')).toBe(false)
  })
})

describe('labelDayIT', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    // Riferimento "ora": 7 ottobre 2026 10:00 Italia
    vi.setSystemTime(new Date('2026-10-07T08:00:00Z'))
  })
  afterAll(() => vi.useRealTimers())

  test('"Oggi" per data corrente', () => {
    expect(labelDayIT('2026-10-07T15:00:00Z')).toBe('Oggi')
  })

  test('"Domani" per data +1 giorno', () => {
    expect(labelDayIT('2026-10-08T10:00:00Z')).toBe('Domani')
  })

  test('"Ieri" per data -1 giorno', () => {
    expect(labelDayIT('2026-10-06T10:00:00Z')).toBe('Ieri')
  })

  test('data lontana → formato breve italiano', () => {
    const result = labelDayIT('2026-12-25T10:00:00Z')
    expect(result).toMatch(/25.*dic.*2026/)
  })
})
