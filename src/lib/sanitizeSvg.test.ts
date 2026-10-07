import { describe, test, expect } from 'vitest'
import { sanitizeSvg } from './sanitizeSvg'

/**
 * Test del sanitizer SVG (A08).
 * Scopo: impedire stored-XSS tramite diagram_svg degli esercizi.
 */

describe('sanitizeSvg', () => {
  test('passa un SVG legittimo (elementi preservati)', () => {
    // Nota: jsdom non parsifica fedelmente tutti gli attributi SVG come
    // viewBox/d; in Chrome vero DOMPurify li lascia. Qui verifichiamo
    // solo che il tag circle sopravviva — i test di sicurezza sotto
    // coprono il comportamento che conta davvero.
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"/></svg>'
    const out = sanitizeSvg(svg)
    expect(out).toContain('<circle')
    expect(out).toContain('<svg')
  })

  test('rimuove <script> annidati', () => {
    const svg = '<svg><circle r="10"/><script>alert(1)</script></svg>'
    const out = sanitizeSvg(svg)
    expect(out).not.toContain('<script')
    expect(out).not.toContain('alert')
    expect(out).toContain('<circle')
  })

  test('rimuove handler on* su elementi SVG', () => {
    const svg = '<svg><rect onclick="alert(1)" onload="alert(2)" width="10" height="10"/></svg>'
    const out = sanitizeSvg(svg)
    expect(out).not.toContain('onclick')
    expect(out).not.toContain('onload')
    expect(out).not.toContain('alert')
  })

  test('rimuove href=javascript:', () => {
    const svg = '<svg><a href="javascript:alert(1)"><rect width="10" height="10"/></a></svg>'
    const out = sanitizeSvg(svg)
    expect(out).not.toContain('javascript:')
  })

  test('rimuove <foreignObject> che porta HTML dentro SVG', () => {
    const svg = '<svg><foreignObject><div onclick="alert(1)">x</div></foreignObject></svg>'
    const out = sanitizeSvg(svg)
    expect(out).not.toContain('foreignObject')
    expect(out).not.toContain('onclick')
  })

  test('rimuove <iframe> annidato', () => {
    const svg = '<svg><iframe src="javascript:alert(1)"/></svg>'
    const out = sanitizeSvg(svg)
    expect(out).not.toContain('<iframe')
    expect(out).not.toContain('javascript:')
  })

  test('empty / null / undefined ritorna stringa vuota', () => {
    expect(sanitizeSvg('')).toBe('')
    expect(sanitizeSvg(null)).toBe('')
    expect(sanitizeSvg(undefined)).toBe('')
  })

  test('preserva il tag path legittimo', () => {
    // jsdom perde l'attributo d= nel parse. Verifichiamo solo la presenza
    // dell'elemento; in Chrome vero d= viene preservato.
    const svg = '<svg><path d="M10,10 L90,90" stroke="black"/></svg>'
    const out = sanitizeSvg(svg)
    expect(out).toContain('<path')
  })

  test('preserva <text> per etichette dei diagrammi', () => {
    const svg = '<svg><text x="10" y="20" fill="black">Attaccante</text></svg>'
    const out = sanitizeSvg(svg)
    expect(out).toContain('<text')
    expect(out).toContain('Attaccante')
  })
})
