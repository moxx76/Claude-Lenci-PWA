import { describe, test, expect } from 'vitest'
import { makeMatchDuration, DURATION_PRESETS } from './matchDuration'

describe('makeMatchDuration', () => {
  test('default 2x45 su input null/undefined', () => {
    const d = makeMatchDuration(null, null)
    expect(d.periodsCount).toBe(2)
    expect(d.periodDurationMin).toBe(45)
    expect(d.totalMin).toBe(90)
  })

  test('Piccoli Amici 3x10', () => {
    const d = makeMatchDuration(3, 10)
    expect(d.totalMin).toBe(30)
    expect(d.periodLabels).toEqual(['T1', 'T2', 'T3'])
    expect(d.periodEndMarkers).toEqual([10, 20, 30])
  })

  test('Pulcini 3x15', () => {
    const d = makeMatchDuration(3, 15)
    expect(d.totalMin).toBe(45)
    expect(d.periodEndMarkers).toEqual([15, 30, 45])
  })

  test('Under 14 2x30', () => {
    const d = makeMatchDuration(2, 30)
    expect(d.totalMin).toBe(60)
    expect(d.periodLabels).toEqual(['T1', 'T2'])
    expect(d.periodEndMarkers).toEqual([30, 60])
  })

  test('solo periodsCount valorizzato → duration default', () => {
    const d = makeMatchDuration(3, undefined)
    expect(d.periodsCount).toBe(3)
    expect(d.periodDurationMin).toBe(45)
    expect(d.totalMin).toBe(135)
  })

  test('solo durationMin valorizzato → periods default', () => {
    const d = makeMatchDuration(null, 30)
    expect(d.periodsCount).toBe(2)
    expect(d.periodDurationMin).toBe(30)
    expect(d.totalMin).toBe(60)
  })
})

describe('DURATION_PRESETS', () => {
  test('ha i 7 preset FIGC categorie giovanili + prima', () => {
    expect(DURATION_PRESETS.length).toBe(7)
  })

  test('tutti i preset hanno periodsCount e periodDurationMin positivi', () => {
    for (const p of DURATION_PRESETS) {
      expect(p.periodsCount).toBeGreaterThan(0)
      expect(p.periodDurationMin).toBeGreaterThan(0)
      expect(p.short).toMatch(/^\d+×\d+$/)
    }
  })

  test('presets sono ordinati per totale minuti crescente (facilità scelta UI)', () => {
    const totals = DURATION_PRESETS.map(p => p.periodsCount * p.periodDurationMin)
    for (let i = 1; i < totals.length; i++) {
      expect(totals[i], `preset ${i} <${DURATION_PRESETS[i].short}> non è >= del precedente`).toBeGreaterThanOrEqual(totals[i - 1])
    }
  })
})
