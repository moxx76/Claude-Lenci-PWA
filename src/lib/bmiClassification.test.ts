import { describe, test, expect } from 'vitest'
import { ageInMonths, classifyBMI } from './bmiClassification'

/**
 * Test di sanità sulla classificazione BMI. Non è un test di accuratezza
 * clinica (quella la garantisce la tabella WHO di riferimento), ma verifica
 * che il wrapper non abbia regressioni evidenti su input tipici del club.
 */

describe('ageInMonths', () => {
  test('calcola mesi tra due date', () => {
    // Nato 7 ottobre 2016, valutato 7 ottobre 2026 → 120 mesi
    const result = ageInMonths('2016-10-07', new Date('2026-10-07T12:00:00Z'))
    expect(result).toBe(120)
  })

  test('se non ha ancora compiuto il mese, sottrae uno', () => {
    // Nato 15 ottobre 2016, valutato 7 ottobre 2026 → 9 anni 11 mesi = 119 mesi
    const result = ageInMonths('2016-10-15', new Date('2026-10-07T12:00:00Z'))
    expect(result).toBe(119)
  })

  test('età negativa (data nel futuro) → null', () => {
    const result = ageInMonths('2030-01-01', new Date('2026-10-07T12:00:00Z'))
    expect(result).toBe(null)
  })

  test('input null/undefined/empty', () => {
    expect(ageInMonths(null)).toBe(null)
    expect(ageInMonths(undefined)).toBe(null)
    expect(ageInMonths('')).toBe(null)
  })

  test('data invalida', () => {
    expect(ageInMonths('non-una-data')).toBe(null)
  })
})

describe('classifyBMI', () => {
  test('adulto con BMI normale → "normal"', () => {
    // 25 anni ha ageMonths > 228 (massimo WHO 5-19), usa curve adulto
    const r = classifyBMI(22, 25 * 12, 'M')
    expect(r).not.toBeNull()
    expect(r!.category).toBe('normal')
    expect(r!.reference).toBe('adult')
  })

  test('adulto obeso → "obesity"', () => {
    const r = classifyBMI(35, 30 * 12, 'F')
    expect(r).not.toBeNull()
    expect(r!.category).toBe('obesity')
  })

  test('adulto sottopeso → "thinness"', () => {
    const r = classifyBMI(17, 25 * 12, 'M')
    expect(r).not.toBeNull()
    expect(r!.category).toBe('thinness')
  })

  test('bambino 10 anni usa curve WHO 5-19', () => {
    const r = classifyBMI(16, 120, 'M')
    expect(r).not.toBeNull()
    expect(r!.reference).toBe('who-5-19')
  })

  test('tutti i risultati hanno label non vuota e colori', () => {
    const r = classifyBMI(22, 180, 'F')
    expect(r).not.toBeNull()
    expect(r!.label).toBeTruthy()
    expect(r!.color).toMatch(/^#/)
    expect(r!.bg).toMatch(/^#|^rgba/)
  })

  test('BMI invalido (NaN/negativo) non crasha', () => {
    expect(() => classifyBMI(NaN, 120, 'M')).not.toThrow()
    expect(() => classifyBMI(-5, 120, 'M')).not.toThrow()
  })
})
