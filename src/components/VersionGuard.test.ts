import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { hasUnsavedWork } from './VersionGuard'

/**
 * Tests sul rilevamento di bozze non salvate. Protezione critica: se
 * fallisce può portare al reload automatico sopra un referto che il coach
 * sta compilando, perdendo la bozza. Convention:
 *  - data-dirty="true" su qualsiasi elemento → dirty
 *  - localStorage keys con prefisso "draft:" o "postmatch_draft_" → dirty
 *  - BottomSheet aperto (data-bottom-sheet="open") con input testuali
 *    con value non vuoto e diverso da defaultValue → dirty
 */

describe('hasUnsavedWork', () => {
  // Pulizia completa tra un test e l'altro: DOM + localStorage
  beforeEach(() => {
    document.body.innerHTML = ''
    localStorage.clear()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    localStorage.clear()
  })

  test('DOM pulito e localStorage vuoto → false', () => {
    expect(hasUnsavedWork()).toBe(false)
  })

  describe('marker data-dirty', () => {
    test('elemento con data-dirty="true" → true', () => {
      const el = document.createElement('div')
      el.setAttribute('data-dirty', 'true')
      document.body.appendChild(el)
      expect(hasUnsavedWork()).toBe(true)
    })

    test('data-dirty="false" non conta', () => {
      const el = document.createElement('div')
      el.setAttribute('data-dirty', 'false')
      document.body.appendChild(el)
      expect(hasUnsavedWork()).toBe(false)
    })

    test('data-dirty senza value non conta (deve essere "true")', () => {
      const el = document.createElement('div')
      el.setAttribute('data-dirty', '')
      document.body.appendChild(el)
      expect(hasUnsavedWork()).toBe(false)
    })

    test('marker nested in profondità → true', () => {
      const root = document.createElement('div')
      const mid = document.createElement('section')
      const inner = document.createElement('span')
      inner.setAttribute('data-dirty', 'true')
      mid.appendChild(inner)
      root.appendChild(mid)
      document.body.appendChild(root)
      expect(hasUnsavedWork()).toBe(true)
    })
  })

  describe('draft keys in localStorage', () => {
    test('chiave con prefisso "draft:" → true', () => {
      localStorage.setItem('draft:eventEdit:abc', JSON.stringify({ title: 'bozza' }))
      expect(hasUnsavedWork()).toBe(true)
    })

    test('chiave con prefisso "postmatch_draft_" → true', () => {
      localStorage.setItem('postmatch_draft_123', JSON.stringify({ scored: 2 }))
      expect(hasUnsavedWork()).toBe(true)
    })

    test('chiave senza prefisso → false', () => {
      localStorage.setItem('session', 'abc')
      localStorage.setItem('user_pref', 'dark')
      expect(hasUnsavedWork()).toBe(false)
    })

    test('più chiavi di cui una draft → true', () => {
      localStorage.setItem('session', 'abc')
      localStorage.setItem('user_pref', 'dark')
      localStorage.setItem('draft:xyz', 'something')
      expect(hasUnsavedWork()).toBe(true)
    })
  })

  describe('BottomSheet aperto con input', () => {
    test('sheet aperto ma vuoto → false', () => {
      const sheet = document.createElement('div')
      sheet.setAttribute('data-bottom-sheet', 'open')
      document.body.appendChild(sheet)
      expect(hasUnsavedWork()).toBe(false)
    })

    test('sheet aperto con input text valorizzato → true', () => {
      const sheet = document.createElement('div')
      sheet.setAttribute('data-bottom-sheet', 'open')
      const input = document.createElement('input')
      input.type = 'text'
      input.value = 'ha scritto qualcosa'
      sheet.appendChild(input)
      document.body.appendChild(sheet)
      expect(hasUnsavedWork()).toBe(true)
    })

    test('sheet aperto con textarea valorizzata → true', () => {
      const sheet = document.createElement('div')
      sheet.setAttribute('data-bottom-sheet', 'open')
      const textarea = document.createElement('textarea')
      textarea.value = 'nota lunga del coach'
      sheet.appendChild(textarea)
      document.body.appendChild(sheet)
      expect(hasUnsavedWork()).toBe(true)
    })

    test('sheet aperto con input vuoto → false', () => {
      const sheet = document.createElement('div')
      sheet.setAttribute('data-bottom-sheet', 'open')
      const input = document.createElement('input')
      input.type = 'text'
      input.value = ''
      sheet.appendChild(input)
      document.body.appendChild(sheet)
      expect(hasUnsavedWork()).toBe(false)
    })

    test('sheet aperto con solo spazi nel valore → false (trim)', () => {
      const sheet = document.createElement('div')
      sheet.setAttribute('data-bottom-sheet', 'open')
      const input = document.createElement('input')
      input.type = 'text'
      input.value = '    '
      sheet.appendChild(input)
      document.body.appendChild(sheet)
      expect(hasUnsavedWork()).toBe(false)
    })

    test('sheet aperto con input hidden/button/submit valorizzati → false', () => {
      const sheet = document.createElement('div')
      sheet.setAttribute('data-bottom-sheet', 'open')
      const hidden = document.createElement('input')
      hidden.type = 'hidden'
      hidden.value = 'csrf-token-abc'
      sheet.appendChild(hidden)
      const btn = document.createElement('input')
      btn.type = 'button'
      btn.value = 'Salva'
      sheet.appendChild(btn)
      const submit = document.createElement('input')
      submit.type = 'submit'
      submit.value = 'Invia'
      sheet.appendChild(submit)
      document.body.appendChild(sheet)
      expect(hasUnsavedWork()).toBe(false)
    })

    test('sheet non aperto (attributo diverso) → ignorato', () => {
      const sheet = document.createElement('div')
      sheet.setAttribute('data-bottom-sheet', 'closed')
      const input = document.createElement('input')
      input.type = 'text'
      input.value = 'bozza persa'
      sheet.appendChild(input)
      document.body.appendChild(sheet)
      // Il contratto del guard è "sheet aperto": se chiuso non interessa
      expect(hasUnsavedWork()).toBe(false)
    })

    test('input testuale uguale a defaultValue → non è dirty', () => {
      const sheet = document.createElement('div')
      sheet.setAttribute('data-bottom-sheet', 'open')
      const input = document.createElement('input')
      input.type = 'text'
      input.defaultValue = 'nome squadra'
      input.value = 'nome squadra'
      sheet.appendChild(input)
      document.body.appendChild(sheet)
      // L'utente non ha modificato il campo: valore iniziale uguale al corrente
      expect(hasUnsavedWork()).toBe(false)
    })

    test('due sheet aperti, uno pulito e uno con bozza → true', () => {
      const sheetClean = document.createElement('div')
      sheetClean.setAttribute('data-bottom-sheet', 'open')
      document.body.appendChild(sheetClean)

      const sheetDirty = document.createElement('div')
      sheetDirty.setAttribute('data-bottom-sheet', 'open')
      const textarea = document.createElement('textarea')
      textarea.value = 'bozza referto post match'
      sheetDirty.appendChild(textarea)
      document.body.appendChild(sheetDirty)

      expect(hasUnsavedWork()).toBe(true)
    })
  })

  describe('priorità e combinazioni', () => {
    test('data-dirty vince senza bisogno di sheet o localStorage', () => {
      const el = document.createElement('div')
      el.setAttribute('data-dirty', 'true')
      document.body.appendChild(el)
      // Nessuno sheet, nessun localStorage, ma marker esplicito → dirty
      expect(hasUnsavedWork()).toBe(true)
    })

    test('tutti e tre i segnali attivi → true (robustezza)', () => {
      const el = document.createElement('div')
      el.setAttribute('data-dirty', 'true')
      document.body.appendChild(el)

      localStorage.setItem('draft:x', 'y')

      const sheet = document.createElement('div')
      sheet.setAttribute('data-bottom-sheet', 'open')
      const input = document.createElement('input')
      input.type = 'text'
      input.value = 'altro'
      sheet.appendChild(input)
      document.body.appendChild(sheet)

      expect(hasUnsavedWork()).toBe(true)
    })
  })
})
