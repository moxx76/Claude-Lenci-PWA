import DOMPurify, { type Config } from 'dompurify'

/**
 * Sanitizer per SVG salvati nel DB e renderizzati via dangerouslySetInnerHTML
 * (A08). Serve a prevenire stored-XSS se un attore con permessi di scrittura
 * sulla tabella exercises inserisce markup attivo (<script>, event handlers,
 * href=javascript:) nel campo diagram_svg.
 *
 * DOMPurify in modalità SVG permette solo il subset necessario per i diagrammi
 * tattici: elementi di geometria, path, text, uso di id/class, attributi di
 * stile presentazionali. Rifiuta <script>, on*, URL non http(s)/relativi,
 * foreignObject (porta HTML dentro SVG), <use> con href esterni, animazioni
 * SMIL (<animate> con from/to malevoli).
 *
 * Il valore stored viene sanitizzato sia in lettura (qui) sia idealmente anche
 * in scrittura (lato RPC / API quando esisterà un endpoint dedicato); per ora
 * la difesa è in lettura, che è il momento dove si manifesta l'eventuale XSS.
 */

// Allowlist esplicita per diagrammi tattici: il profile svg di DOMPurify
// nelle versioni recenti è aggressivo e rimuove attributi di geometria se
// non sono dichiarati. Preferiamo elencarli: tutto ciò che non è qui dentro
// viene scartato, inclusi gli handler on* e href=javascript:.
const config: Config = {
  USE_PROFILES: { svg: true, svgFilters: true },
  ADD_TAGS: [], // nessuno aggiuntivo oltre al profile
  ADD_ATTR: [
    // Namespace e geometria base
    'xmlns', 'xmlns:xlink', 'viewBox', 'preserveAspectRatio',
    'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
    'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points',
    'transform', 'transform-origin',
    // Presentazione
    'fill', 'fill-opacity', 'fill-rule',
    'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
    'stroke-dasharray', 'stroke-opacity',
    'opacity', 'color', 'style', 'class', 'id',
    // Testo
    'font-family', 'font-size', 'font-weight', 'font-style',
    'text-anchor', 'dominant-baseline', 'alignment-baseline',
    'dx', 'dy',
    // Marker/pattern/defs
    'orient', 'markerUnits', 'markerWidth', 'markerHeight',
    'refX', 'refY', 'patternUnits',
  ],
  FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'object', 'embed', 'use'],
  FORBID_ATTR: [
    'onload', 'onerror', 'onclick', 'onmouseover', 'onmouseout', 'onfocus',
    'onblur', 'onbegin', 'onend', 'onrepeat', 'onactivate',
    // href non è necessario per diagrammi tattici statici: lo blocchiamo
    // per eliminare sia href=javascript: sia xlink:href su <use> esterni
    'href', 'xlink:href',
  ],
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#|\/)/i,
  KEEP_CONTENT: true,
  RETURN_TRUSTED_TYPE: false,
}

export function sanitizeSvg(raw: string | null | undefined): string {
  if (!raw) return ''
  try {
    return DOMPurify.sanitize(raw, config) as unknown as string
  } catch {
    return ''
  }
}
