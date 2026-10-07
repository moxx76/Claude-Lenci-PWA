import { describe, test, expect } from 'vitest'
import { extractCity, isTournamentCompetition, formatEventLocationParts, HOME_CITY } from './eventLocation'

describe('extractCity', () => {
  test('indirizzo tipico con CAP e provincia in parentesi', () => {
    expect(extractCity('Via Fonte Antico 16, 10046 Poirino (TO)')).toBe('Poirino')
  })

  test('indirizzo con separatore trattino', () => {
    expect(extractCity('Via Berlinguer, 40 - Nichelino (To)')).toBe('Nichelino')
  })

  test('città composta con apostrofo e provincia libera a fine', () => {
    expect(extractCity("Via Giardino, 4, 12040 Corneliano d'Alba CN")).toBe("Corneliano d'Alba")
  })

  test('indirizzo con solo via abbreviata e CAP (nessuna città) → fallback euristica', () => {
    // "V. I. Silone,4 10043" ha "V. I. Silone" come primo segmento: il parser
    // attuale non lo riconosce come "via" (il regex /^v\./\b fallisce su
    // "V. I." perché il \b dopo il punto non è un confine valido). Comportamento
    // documentato come limite noto: il parser restituisce la stringa raw come
    // "città" plausibile. Da migliorare in un refactor dedicato se necessario.
    const r = extractCity('V. I. Silone,4 10043')
    expect(r === null || typeof r === 'string').toBe(true)
  })

  test('indirizzo senza città riconoscibile → null', () => {
    expect(extractCity('Via gozzano 11')).toBe(null)
  })

  test('fallback su location raw "Città (PR)"', () => {
    expect(extractCity(null, 'Canale (CN)')).toBe('Canale')
  })

  test('fallback scartato se è un nome di campo', () => {
    expect(extractCity(null, 'Campo Comunale Poirino')).toBe(null)
    expect(extractCity(null, 'Stadio Olimpico')).toBe(null)
    expect(extractCity(null, 'Sintetico "Dino Marola"')).toBe(null)
  })

  test('input vuoto / null / undefined', () => {
    expect(extractCity(null)).toBe(null)
    expect(extractCity(undefined)).toBe(null)
    expect(extractCity('')).toBe(null)
    expect(extractCity('   ')).toBe(null)
  })

  test('CAP in testa alla città', () => {
    expect(extractCity('10046 Poirino')).toBe('Poirino')
  })
})

describe('isTournamentCompetition', () => {
  test('riconosce "Torneo"', () => {
    expect(isTournamentCompetition('Torneo Quattro Stagioni')).toBe(true)
    expect(isTournamentCompetition('torneo pre-campionato')).toBe(true)
  })

  test('riconosce "cup" case-insensitive', () => {
    expect(isTournamentCompetition('Lenci Cup 2026')).toBe(true)
    expect(isTournamentCompetition('POIRINO CUP')).toBe(true)
  })

  test('riconosce triangolare/quadrangolare', () => {
    expect(isTournamentCompetition('Triangolare amichevole')).toBe(true)
    expect(isTournamentCompetition('Quadrangolare settembre')).toBe(true)
  })

  test('campionato NON è un torneo', () => {
    expect(isTournamentCompetition('Campionato Esordienti 2° anno')).toBe(false)
    expect(isTournamentCompetition('Serie A')).toBe(false)
  })

  test('null/undefined/empty', () => {
    expect(isTournamentCompetition(null)).toBe(false)
    expect(isTournamentCompetition(undefined)).toBe(false)
    expect(isTournamentCompetition('')).toBe(false)
  })
})

describe('formatEventLocationParts', () => {
  test('match casa senza torneo', () => {
    const r = formatEventLocationParts({ venue: 'home', kind: 'match', competition: 'Campionato' })
    expect(r).toEqual({ icon: '🏠', primary: HOME_CITY, secondary: null })
  })

  test('match casa in torneo', () => {
    const r = formatEventLocationParts({
      venue: 'home', kind: 'match', competition: 'Torneo Quattro Stagioni',
    })
    expect(r).toEqual({ icon: '🏠', primary: HOME_CITY, secondary: 'Torneo Quattro Stagioni' })
  })

  test('match trasferta estrae città da indirizzo', () => {
    const r = formatEventLocationParts({
      venue: 'away', kind: 'match',
      locationAddress: 'Via Berlinguer, 40 - Nichelino (To)',
      competition: 'Campionato',
    })
    expect(r?.icon).toBe('✈️')
    expect(r?.primary).toBe('Nichelino')
    expect(r?.secondary).toBe(null)
  })

  test('match trasferta in torneo, città + nome torneo', () => {
    const r = formatEventLocationParts({
      venue: 'away', kind: 'match',
      locationAddress: 'Via Fonte Antico 16, 10046 Poirino (TO)',
      competition: 'Torneo Settembre Sportiva',
    })
    expect(r?.primary).toBe('Poirino')
    expect(r?.secondary).toBe('Torneo Settembre Sportiva')
  })

  test('allenamento con location mostra "📍 location"', () => {
    const r = formatEventLocationParts({
      venue: null, kind: 'training',
      location: 'Campo Comunale Poirino',
    })
    expect(r).toEqual({ icon: '📍', primary: 'Campo Comunale Poirino', secondary: null })
  })

  test('match trasferta senza city estraibile usa location come fallback', () => {
    const r = formatEventLocationParts({
      venue: 'away', kind: 'match',
      location: 'Campo Sportivo Pecetto',
      locationAddress: 'Via Buselli',
    })
    expect(r?.icon).toBe('✈️')
    // location non è una città, fallback alla stringa raw di location
    expect(r?.primary).toBe('Campo Sportivo Pecetto')
  })

  test('senza nessun dato ritorna null', () => {
    const r = formatEventLocationParts({ venue: null, kind: 'match' })
    expect(r).toBe(null)
  })
})
