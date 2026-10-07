import { describe, test, expect } from 'vitest'
import {
  categoryStyle,
  avatarBg,
  isAdmin,
  isCoach,
  isParent,
  isAthlete,
  isStaff,
} from './types'

/**
 * Test sui predicati di ruolo e sugli helper visivi. isX sono usati a
 * dozzine di call-site (NotForJournalist, Dashboard router, NavItem…):
 * un singolo bug qui tocca tutta la navigazione.
 */

describe('role predicates', () => {
  describe('isAdmin', () => {
    test('"admin" → true', () => expect(isAdmin('admin')).toBe(true))
    test('"coach" → false', () => expect(isAdmin('coach')).toBe(false))
    test('null/undefined → false', () => {
      expect(isAdmin(null)).toBe(false)
      expect(isAdmin(undefined)).toBe(false)
    })
    test('string vuota → false', () => expect(isAdmin('')).toBe(false))
    test('maiuscole non riconosciute (case-sensitive)', () => {
      expect(isAdmin('Admin')).toBe(false)
      expect(isAdmin('ADMIN')).toBe(false)
    })
  })

  describe('isCoach', () => {
    test('"coach" → true', () => expect(isCoach('coach')).toBe(true))
    test('"admin" → false', () => expect(isCoach('admin')).toBe(false))
    test('null → false', () => expect(isCoach(null)).toBe(false))
  })

  describe('isParent', () => {
    test('"parent" → true', () => expect(isParent('parent')).toBe(true))
    test('"athlete" → false', () => expect(isParent('athlete')).toBe(false))
    test('null → false', () => expect(isParent(null)).toBe(false))
  })

  describe('isAthlete', () => {
    test('"athlete" → true', () => expect(isAthlete('athlete')).toBe(true))
    test('"parent" → false', () => expect(isAthlete('parent')).toBe(false))
    test('null → false', () => expect(isAthlete(null)).toBe(false))
  })

  describe('isStaff', () => {
    test('"admin" → true', () => expect(isStaff('admin')).toBe(true))
    test('"coach" → true', () => expect(isStaff('coach')).toBe(true))
    test('"athlete" → false', () => expect(isStaff('athlete')).toBe(false))
    test('"parent" → false', () => expect(isStaff('parent')).toBe(false))
    test('null → false', () => expect(isStaff(null)).toBe(false))
  })

  test('ruoli non noti (es. journalist) → tutti false (non è staff)', () => {
    expect(isAdmin('journalist')).toBe(false)
    expect(isCoach('journalist')).toBe(false)
    expect(isStaff('journalist')).toBe(false)
    expect(isAthlete('journalist')).toBe(false)
    expect(isParent('journalist')).toBe(false)
  })
})

describe('categoryStyle', () => {
  test('null/undefined → stile neutro', () => {
    const n = categoryStyle(null)
    expect(n.bg).toBe('#e6e8ee')
    expect(n.color).toBe('#181c20')
    expect(categoryStyle(undefined)).toEqual(n)
  })

  test('U-19 variants → palette rosa', () => {
    const a = categoryStyle('U-19')
    const b = categoryStyle('U19')
    expect(a).toEqual(b)
    expect(a.bg).toMatch(/#/)
    expect(a.color).toMatch(/#/)
  })

  test('U-17 e U17 ritornano lo stesso stile', () => {
    expect(categoryStyle('U-17')).toEqual(categoryStyle('U17'))
  })

  test('categorie u-11/u-12 condividono palette verde', () => {
    const u11 = categoryStyle('U-11')
    const u12 = categoryStyle('U-12')
    expect(u11.color).toBe(u12.color)
  })

  test('case-insensitive', () => {
    expect(categoryStyle('U-19')).toEqual(categoryStyle('u-19'))
  })

  test('categoria sconosciuta → stile neutro', () => {
    expect(categoryStyle('Prima Squadra')).toEqual({ bg: '#e6e8ee', color: '#181c20' })
  })
})

describe('avatarBg (types.ts palette)', () => {
  test('ritorna sempre un colore dalla palette fissa', () => {
    const palette = ['#005f98', '#b3005c', '#0078bf', '#006e25', '#004a78', '#8e0048']
    for (const seed of ['DM', 'MR', 'GN', 'LB', '']) {
      expect(palette).toContain(avatarBg(seed))
    }
  })

  test('deterministico', () => {
    expect(avatarBg('Davide Mantovani')).toBe(avatarBg('Davide Mantovani'))
  })

  test('seed diversi tendono a mappare a colori diversi (hash reasonable)', () => {
    const results = new Set(['AA', 'BB', 'CC', 'DD', 'EE', 'FF', 'GG', 'HH'].map(avatarBg))
    // Ci aspettiamo almeno 2 colori diversi su 8 input (ragionevole per hash djb2-ish)
    expect(results.size).toBeGreaterThanOrEqual(2)
  })
})
