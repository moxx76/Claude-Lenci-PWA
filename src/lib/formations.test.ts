import { describe, test, expect } from 'vitest'
import { FORMATIONS, FORMATION_KEYS, startersCount, benchMax } from './formations'

describe('formations', () => {
  test('tutti i moduli hanno un portiere e il totale di slot atteso', () => {
    for (const key of FORMATION_KEYS) {
      const slots = FORMATIONS[key]
      expect(slots.length).toBeGreaterThan(0)
      const gk = slots.find(s => s.key === 'GK')
      expect(gk, `modulo ${key} manca portiere GK`).toBeDefined()
    }
  })

  test('moduli 11v11 standard hanno 11 slot', () => {
    const eleven = ['4-4-2', '4-3-3', '4-2-3-1', '4-3-1-2', '4-3-2-1', '4-1-4-1', '4-5-1', '3-5-2', '3-4-3', '3-4-1-2', '3-4-2-1', '5-3-2', '5-4-1']
    for (const key of eleven) {
      expect(FORMATIONS[key], `modulo ${key} assente`).toBeDefined()
      expect(startersCount(key), `modulo ${key} non ha 11 slot`).toBe(11)
    }
  })

  test('moduli a 7 hanno 7 slot', () => {
    expect(startersCount('2-3-1 (a 7)')).toBe(7)
    expect(startersCount('3-3 (a 7)')).toBe(7)
  })

  test('moduli a 9 hanno 9 slot', () => {
    expect(startersCount('3-3-2 (a 9)')).toBe(9)
    expect(startersCount('3-2-3 (a 9)')).toBe(9)
    expect(startersCount('2-4-2 (a 9)')).toBe(9)
  })

  test('startersCount default 11 su modulo sconosciuto', () => {
    expect(startersCount('xx')).toBe(11)
  })

  test('benchMax scala con il numero di titolari', () => {
    expect(benchMax('4-4-2')).toBe(9)        // 11 titolari → 9 panchina
    expect(benchMax('3-3-2 (a 9)')).toBe(7)  // 9 titolari → 7 panchina
    expect(benchMax('2-3-1 (a 7)')).toBe(5)  // 7 titolari → 5 panchina
  })

  test('tutte le chiavi degli slot sono uniche per modulo', () => {
    for (const key of FORMATION_KEYS) {
      const keys = FORMATIONS[key].map(s => s.key)
      const unique = new Set(keys)
      expect(unique.size, `modulo ${key} ha slot keys duplicate`).toBe(keys.length)
    }
  })

  test('coordinate x/y di tutti gli slot sono nel range 0..100', () => {
    for (const key of FORMATION_KEYS) {
      for (const slot of FORMATIONS[key]) {
        expect(slot.x, `${key}/${slot.key} x fuori range`).toBeGreaterThanOrEqual(0)
        expect(slot.x, `${key}/${slot.key} x fuori range`).toBeLessThanOrEqual(100)
        expect(slot.y, `${key}/${slot.key} y fuori range`).toBeGreaterThanOrEqual(0)
        expect(slot.y, `${key}/${slot.key} y fuori range`).toBeLessThanOrEqual(100)
      }
    }
  })

  test('albero di Natale 4-3-2-1 ha struttura corretta', () => {
    const slots = FORMATIONS['4-3-2-1']
    expect(slots).toBeDefined()
    expect(slots.length).toBe(11)
    const keys = slots.map(s => s.key).sort()
    expect(keys).toEqual(['DC1', 'DC2', 'GK', 'INTD', 'INTS', 'MED', 'PC', 'TD', 'TRQ1', 'TRQ2', 'TS'])
  })
})
