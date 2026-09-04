/**
 * Renderer JSON → SVG per l'editor di esercizi.
 * La struttura JSON è editabile; l'SVG viene rigenerato al salvataggio.
 */

export type ElementType =
  | 'player_blue'
  | 'player_red'
  | 'player_green'
  | 'player_pink'
  | 'player_purple'
  | 'player_keeper'
  | 'player_jolly'
  | 'ball'
  | 'cone'
  | 'flat_marker'
  | 'hurdle'
  | 'pole'
  | 'ladder'
  | 'hoop'
  | 'arrow_pass'
  | 'arrow_drib'
  | 'arrow_move'
  | 'zone'
  | 'text_label'

export interface DiagramElement {
  id: string
  type: ElementType
  x: number
  y: number
  x2?: number
  y2?: number
  w?: number
  h?: number
  label?: string
}

export interface DiagramJson {
  width: number
  height: number
  fieldType: 'half_top_goal' | 'two_goals' | 'plain'
  elements: DiagramElement[]
}

export const DEFAULT_DIAGRAM: DiagramJson = {
  width: 500,
  height: 350,
  fieldType: 'plain',
  elements: [],
}

// Palette coerente col resto degli SVG seed
const COLORS = {
  green: '#3d9b47',
  line: '#ffffff',
  blue: '#1e5fb6',
  red: '#c73434',
  playerGreen: '#2fa14e',
  pink: '#e85fa5',
  purple: '#7f3fbf',
  keeper: '#f9c826',
  cone: '#ff8c00',
  flatMarker: '#e63946',
  pole: '#facc15',
  ladder: '#f97316',
  arrowPass: '#111',
  arrowDrib: '#0656c6',
  arrowMove: '#666',
}

function renderFieldBase(d: DiagramJson): string {
  const { width: w, height: h, fieldType } = d
  let s = ''
  // Perimetro
  s += `<rect width="${w}" height="${h}" fill="${COLORS.green}"/>`
  s += `<rect x="10" y="10" width="${w - 20}" height="${h - 20}" fill="none" stroke="${COLORS.line}" stroke-width="2.5"/>`

  if (fieldType === 'half_top_goal') {
    // Linea tratteggiata sul bordo basso (metà campo)
    s += `<line x1="10" y1="${h - 15}" x2="${w - 15}" y2="${h - 15}" stroke="${COLORS.line}" stroke-width="2" stroke-dasharray="6,4"/>`
    // Area di rigore in alto
    s += `<rect x="${w / 2 - 100}" y="10" width="200" height="70" fill="none" stroke="${COLORS.line}" stroke-width="2"/>`
    s += `<rect x="${w / 2 - 40}" y="10" width="80" height="25" fill="none" stroke="${COLORS.line}" stroke-width="2"/>`
    s += `<circle cx="${w / 2}" cy="60" r="2.5" fill="${COLORS.line}"/>`
    s += `<path d="M ${w / 2 - 40},80 A 40,40 0 0 0 ${w / 2 + 40},80" fill="none" stroke="${COLORS.line}" stroke-width="2"/>`
    // Porta in alto
    s += `<line x1="${w / 2 - 25}" y1="10" x2="${w / 2 + 25}" y2="10" stroke="${COLORS.line}" stroke-width="5"/>`
  } else if (fieldType === 'two_goals') {
    // Porte sui lati corti (sinistra e destra) — assetto orizzontale calcistico
    s += `<rect x="10" y="${h / 2 - 40}" width="6" height="80" fill="${COLORS.line}"/>`
    s += `<rect x="${w - 16}" y="${h / 2 - 40}" width="6" height="80" fill="${COLORS.line}"/>`
    // Linea di centrocampo verticale
    s += `<line x1="${w / 2}" y1="10" x2="${w / 2}" y2="${h - 10}" stroke="${COLORS.line}" stroke-width="1" stroke-dasharray="4,3"/>`
    // Cerchio di centrocampo
    s += `<circle cx="${w / 2}" cy="${h / 2}" r="30" fill="none" stroke="${COLORS.line}" stroke-width="1.5"/>`
    s += `<circle cx="${w / 2}" cy="${h / 2}" r="2" fill="${COLORS.line}"/>`
  }
  return s
}

function playerCircle(x: number, y: number, fill: string, label: string, ringDark = false, ringWidth = 1.5): string {
  const stroke = ringDark ? '#000' : '#fff'
  const txtFill = fill === COLORS.keeper || fill === COLORS.pole ? '#333' : '#fff'
  return `<g><circle cx="${x}" cy="${y}" r="14" fill="${fill}" stroke="${stroke}" stroke-width="${ringWidth}"/>${label ? `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11" font-weight="bold" fill="${txtFill}">${label}</text>` : ''}</g>`
}

function renderElement(e: DiagramElement): string {
  const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // Player: 4 char cap; text_label: 32 char cap
  const isText = e.type === 'text_label'
  const label = e.label ? escapeXml(e.label.slice(0, isText ? 32 : 4)) : ''

  switch (e.type) {
    case 'player_blue':
      return playerCircle(e.x, e.y, COLORS.blue, label)
    case 'player_red':
      return playerCircle(e.x, e.y, COLORS.red, label)
    case 'player_green':
      return playerCircle(e.x, e.y, COLORS.playerGreen, label)
    case 'player_pink':
      return playerCircle(e.x, e.y, COLORS.pink, label)
    case 'player_purple':
      return playerCircle(e.x, e.y, COLORS.purple, label)
    case 'player_keeper':
      return playerCircle(e.x, e.y, COLORS.keeper, label || 'P')
    case 'player_jolly':
      return playerCircle(e.x, e.y, COLORS.keeper, label || 'J', true, 2.5)
    case 'ball':
      return `<circle cx="${e.x}" cy="${e.y}" r="6" fill="#fff" stroke="#000" stroke-width="1.5"/>`
    case 'cone':
      return `<polygon points="${e.x},${e.y - 8} ${e.x - 6},${e.y + 4} ${e.x + 6},${e.y + 4}" fill="${COLORS.cone}" stroke="#fff" stroke-width="1"/>`
    case 'flat_marker':
      // Cinesino: disco piatto (ellisse schiacciata)
      return `<ellipse cx="${e.x}" cy="${e.y}" rx="8" ry="3" fill="${COLORS.flatMarker}" stroke="#fff" stroke-width="1"/>`
    case 'hurdle':
      // Ostacolo: traversa arancione con due palini verticali
      return `<g><rect x="${e.x - 12}" y="${e.y - 2}" width="24" height="4" fill="${COLORS.cone}"/><rect x="${e.x - 12}" y="${e.y - 2}" width="3" height="10" fill="${COLORS.cone}"/><rect x="${e.x + 9}" y="${e.y - 2}" width="3" height="10" fill="${COLORS.cone}"/></g>`
    case 'pole':
      // Asta: bastone verticale giallo con base
      return `<g><line x1="${e.x}" y1="${e.y + 4}" x2="${e.x}" y2="${e.y - 24}" stroke="${COLORS.pole}" stroke-width="3" stroke-linecap="round"/><circle cx="${e.x}" cy="${e.y + 4}" r="4" fill="${COLORS.pole}" stroke="#000" stroke-width="0.5"/></g>`
    case 'ladder': {
      // Scaletta agility: 5 caselle affiancate
      const w = 60, h = 12
      let s = `<rect x="${e.x - w / 2}" y="${e.y - h / 2}" width="${w}" height="${h}" fill="none" stroke="${COLORS.ladder}" stroke-width="1.8"/>`
      for (let i = 1; i < 5; i++) {
        const xi = e.x - w / 2 + (w / 5) * i
        s += `<line x1="${xi}" y1="${e.y - h / 2}" x2="${xi}" y2="${e.y + h / 2}" stroke="${COLORS.ladder}" stroke-width="1.5"/>`
      }
      return `<g>${s}</g>`
    }
    case 'hoop':
      return `<circle cx="${e.x}" cy="${e.y}" r="16" fill="none" stroke="${COLORS.keeper}" stroke-width="3"/>`
    case 'arrow_pass':
      return `<line x1="${e.x}" y1="${e.y}" x2="${e.x2 ?? e.x}" y2="${e.y2 ?? e.y}" stroke="${COLORS.arrowPass}" stroke-width="2.5" marker-end="url(#ah)"/>`
    case 'arrow_drib': {
      // Guida palla: freccia ondulata (sinusoide)
      const x1 = e.x, y1 = e.y, x2 = e.x2 ?? e.x, y2 = e.y2 ?? e.y
      const dx = x2 - x1, dy = y2 - y1
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      const px = -dy / len, py = dx / len
      const amp = Math.min(6, len / 6)
      // 4 punti intermedi con deviazione perpendicolare alternata
      const pts: Array<[number, number]> = []
      for (let i = 1; i <= 4; i++) {
        const t = i / 5
        const sign = i % 2 === 1 ? 1 : -1
        pts.push([x1 + dx * t + px * amp * sign, y1 + dy * t + py * amp * sign])
      }
      // Path: M start, Q ctrl mid, T T T end (T eredita il control point riflesso)
      const d = `M ${x1} ${y1} Q ${pts[0][0]} ${pts[0][1]} ${pts[1][0]} ${pts[1][1]} T ${pts[3][0]} ${pts[3][1]} T ${x2} ${y2}`
      return `<path d="${d}" fill="none" stroke="${COLORS.arrowDrib}" stroke-width="2.5" marker-end="url(#ab)"/>`
    }
    case 'arrow_move':
      return `<line x1="${e.x}" y1="${e.y}" x2="${e.x2 ?? e.x}" y2="${e.y2 ?? e.y}" stroke="${COLORS.arrowMove}" stroke-width="2" stroke-dasharray="5,4" marker-end="url(#ag)"/>`
    case 'zone':
      return `<rect x="${e.x}" y="${e.y}" width="${e.w ?? 100}" height="${e.h ?? 60}" fill="#ff0" opacity="0.15" stroke="#ff0" stroke-width="1.5" stroke-dasharray="4,3"/>`
    case 'text_label':
      return `<text x="${e.x}" y="${e.y}" text-anchor="middle" font-size="13" font-weight="bold" fill="#fff" stroke="#000" stroke-width="0.4" paint-order="stroke">${label || 'testo'}</text>`
    default:
      return ''
  }
}

const DEFS = `<defs>
  <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${COLORS.arrowPass}"/></marker>
  <marker id="ab" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${COLORS.arrowDrib}"/></marker>
  <marker id="ag" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${COLORS.arrowMove}"/></marker>
</defs>`

/**
 * Converte JSON → stringa SVG completa e autonoma (self-contained).
 */
export function renderDiagramToSvg(diagram: DiagramJson): string {
  const { width, height } = diagram
  return (
    `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto">` +
    DEFS +
    renderFieldBase(diagram) +
    diagram.elements.map(renderElement).join('') +
    `</svg>`
  )
}

// Labels UI per la toolbar
export const ELEMENT_LABELS: Record<ElementType, { label: string; short: string; icon: string; color: string; needsTwoPoints: boolean }> = {
  player_blue: { label: 'Giocatore blu', short: 'B', icon: '⚽', color: COLORS.blue, needsTwoPoints: false },
  player_red: { label: 'Giocatore rosso', short: 'R', icon: '⚽', color: COLORS.red, needsTwoPoints: false },
  player_green: { label: 'Giocatore verde', short: 'V', icon: '⚽', color: COLORS.playerGreen, needsTwoPoints: false },
  player_pink: { label: 'Giocatore rosa', short: 'P', icon: '⚽', color: COLORS.pink, needsTwoPoints: false },
  player_purple: { label: 'Giocatore viola', short: 'X', icon: '⚽', color: COLORS.purple, needsTwoPoints: false },
  player_keeper: { label: 'Portiere', short: 'P', icon: '🥅', color: COLORS.keeper, needsTwoPoints: false },
  player_jolly: { label: 'Jolly neutro', short: 'J', icon: '⚪', color: COLORS.keeper, needsTwoPoints: false },
  ball: { label: 'Pallone', short: '●', icon: '⚽', color: '#000', needsTwoPoints: false },
  cone: { label: 'Cono', short: '▲', icon: '🚧', color: COLORS.cone, needsTwoPoints: false },
  flat_marker: { label: 'Cinesino', short: '◉', icon: '🔴', color: COLORS.flatMarker, needsTwoPoints: false },
  hurdle: { label: 'Ostacolo', short: '⊓', icon: '📏', color: COLORS.cone, needsTwoPoints: false },
  pole: { label: 'Asta', short: '│', icon: '🎯', color: COLORS.pole, needsTwoPoints: false },
  ladder: { label: 'Scaletta', short: '▤', icon: '🪜', color: COLORS.ladder, needsTwoPoints: false },
  hoop: { label: 'Cerchio', short: '○', icon: '⭕', color: COLORS.keeper, needsTwoPoints: false },
  arrow_pass: { label: 'Passaggio', short: '→', icon: '→', color: COLORS.arrowPass, needsTwoPoints: true },
  arrow_drib: { label: 'Guida palla (ondulata)', short: '⤳', icon: '⤳', color: COLORS.arrowDrib, needsTwoPoints: true },
  arrow_move: { label: 'Mov. senza palla', short: '⇢', icon: '⇢', color: COLORS.arrowMove, needsTwoPoints: true },
  zone: { label: 'Zona', short: '▭', icon: '▭', color: '#ff0', needsTwoPoints: false },
  text_label: { label: 'Testo', short: 'T', icon: 'T', color: '#fff', needsTwoPoints: false },
}

export function generateElementId(): string {
  return Math.random().toString(36).slice(2, 10)
}
