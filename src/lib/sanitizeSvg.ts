import DOMPurify from 'dompurify'

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

const config: DOMPurify.Config = {
  USE_PROFILES: { svg: true, svgFilters: true },
  // Non consentire HTML: il campo deve essere SVG puro.
  // dompurify svg profile include già una allowlist stringente di tag/attrs.
  FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'object', 'embed'],
  // Rifiuta tutti gli handler on* esplicitamente (ridondante con il profile svg
  // ma dichiarativo e difesa in profondità).
  FORBID_ATTR: [
    'onload', 'onerror', 'onclick', 'onmouseover', 'onmouseout', 'onfocus',
    'onblur', 'onbegin', 'onend', 'onrepeat',
  ],
  // Nessun protocollo javascript: nei href/xlink:href
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#|\/)/i,
  KEEP_CONTENT: true,
  RETURN_TRUSTED_TYPE: false,
}

export function sanitizeSvg(raw: string | null | undefined): string {
  if (!raw) return ''
  try {
    return DOMPurify.sanitize(raw, config) as string
  } catch {
    return ''
  }
}
