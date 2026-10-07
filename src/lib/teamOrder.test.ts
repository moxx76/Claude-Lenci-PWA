import { describe, test, expect } from 'vitest'
import { teamAgeOrder, sortTeamsByAge } from './teamOrder'

/**
 * Test sulla classificazione per età FIGC. Serve a mantenere stabile
 * l'ordine in cui compaiono le squadre nelle liste (Dashboard Admin,
 * TeamPicker, Calendario). Prima squadra sempre in cima, Piccoli Amici
 * in fondo. A parità di priorità, ordinamento alfabetico per nome.
 */

describe('teamAgeOrder', () => {
  test('Prima Squadra ha priorità 100 (massima)', () => {
    expect(teamAgeOrder({ category: 'Prima Squadra' })).toBe(100)
    expect(teamAgeOrder({ name: 'Prima squadra' })).toBe(100)
    expect(teamAgeOrder({ age_range: 'senior' })).toBe(100)
  })

  test('Juniores → 90', () => {
    expect(teamAgeOrder({ category: 'Juniores' })).toBe(90)
    expect(teamAgeOrder({ name: 'Juniores Regionali' })).toBe(90)
  })

  test('Allievi → 80', () => {
    expect(teamAgeOrder({ category: 'Allievi' })).toBe(80)
  })

  test('Giovanissimi → 75', () => {
    expect(teamAgeOrder({ category: 'Giovanissimi' })).toBe(75)
  })

  test('Under 19 → 69, Under 17 → 67, Under 14 → 64 (50+N)', () => {
    expect(teamAgeOrder({ category: 'Under 19' })).toBe(69)
    expect(teamAgeOrder({ category: 'Under 17' })).toBe(67)
    expect(teamAgeOrder({ category: 'Under 14' })).toBe(64)
    expect(teamAgeOrder({ category: 'U-15' })).toBe(65)
  })

  test('Esordienti → 40', () => {
    expect(teamAgeOrder({ category: 'Esordienti' })).toBe(40)
  })

  test('Pulcini A > Pulcini B', () => {
    const pulciniA = teamAgeOrder({ category: 'Pulcini A' })
    const pulciniB = teamAgeOrder({ category: 'Pulcini B' })
    expect(pulciniA).toBeGreaterThan(pulciniB)
    expect(pulciniA).toBe(32)
    expect(pulciniB).toBe(31)
  })

  test('Pulcini generico (senza A/B) → 30', () => {
    expect(teamAgeOrder({ category: 'Pulcini' })).toBe(30)
  })

  test('Primi Calci → 20', () => {
    expect(teamAgeOrder({ category: 'Primi Calci' })).toBe(20)
  })

  test('Piccoli Amici → 10 (ultima)', () => {
    expect(teamAgeOrder({ category: 'Piccoli Amici' })).toBe(10)
  })

  test('categoria sconosciuta → 0', () => {
    expect(teamAgeOrder({ category: 'Qualcosa' })).toBe(0)
    expect(teamAgeOrder({})).toBe(0)
    expect(teamAgeOrder({ category: null, name: null, age_range: null })).toBe(0)
  })
})

describe('sortTeamsByAge', () => {
  test('ordina dalla prima squadra a Piccoli Amici', () => {
    const teams = [
      { name: 'Piccoli Amici', category: 'Piccoli Amici' },
      { name: 'Prima Squadra', category: 'Prima Squadra' },
      { name: 'Under 14', category: 'Under 14' },
      { name: 'Juniores', category: 'Juniores' },
    ]
    const sorted = sortTeamsByAge(teams)
    expect(sorted.map(t => t.name)).toEqual(['Prima Squadra', 'Juniores', 'Under 14', 'Piccoli Amici'])
  })

  test('a parità di categoria ordina alfabetico per nome', () => {
    const teams = [
      { name: 'Pulcini A 2015', category: 'Pulcini A' },
      { name: 'Pulcini A 2014', category: 'Pulcini A' },
    ]
    const sorted = sortTeamsByAge(teams)
    expect(sorted[0].name).toBe('Pulcini A 2014')
    expect(sorted[1].name).toBe('Pulcini A 2015')
  })

  test('non muta l\'array originale (immutable sort)', () => {
    const teams = [
      { name: 'Piccoli Amici' },
      { name: 'Prima Squadra' },
    ]
    const original = [...teams]
    sortTeamsByAge(teams)
    expect(teams).toEqual(original)
  })

  test('array vuoto non crasha', () => {
    expect(sortTeamsByAge([])).toEqual([])
  })
})
