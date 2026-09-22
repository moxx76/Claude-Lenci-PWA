/**
 * locandinaBuilder — Genera un PNG "locandina" post-partita.
 *
 * Composto da:
 *   1. Header con nome team, avversario, risultato, data e competizione
 *   2. Campo grafico rasterizzato dal PitchView (SVG -> canvas)
 *   3. Footer con marcatori Lenci, sostituzioni, modulo e hashtag
 *
 * Nessuna dipendenza esterna. Funziona offline. Il canvas è disegnato ad alta risoluzione
 * (1.5x del PitchView PNG di v1.9.63) per rimanere nitido su Retina display.
 */

interface Marcatore {
  name: string
  minutes: number[]  // include rigori (col suffix)
  isPenalty?: boolean[]  // stesso ordine di minutes, marca quale minuto era un rigore
}

interface Sostituzione {
  minute: number
  in: string
  out: string
}

export interface LocandinaData {
  /** Nome squadra Lenci (es. "ASD Lenci Poirino") */
  teamName: string
  /** Categoria squadra opzionale (es. "Under 14") */
  teamCategory?: string | null
  /** Nome squadra avversaria */
  opponentName: string
  /** Punteggio Lenci */
  ourScore: number
  /** Punteggio avversario */
  theirScore: number
  /** Data partita (ISO) */
  matchDate: string
  /** Casa o trasferta */
  venue: 'home' | 'away'
  /** Competizione (es. "Campionato Under 14") */
  competition?: string | null
  /** Modulo tattico (es. "4-3-1-2") */
  formation: string
  /** Colore squadra (per header) */
  teamColor: string
  /** Marcatori Lenci */
  marcatori: Marcatore[]
  /** Autogol avversari a favore Lenci: minuti */
  opponentOwnGoalMinutes: number[]
  /** Gol avversari coi minuti (facoltativi) */
  opponentGoalMinutes: number[]
  /** Sostituzioni effettuate */
  sostituzioni: Sostituzione[]
}

/**
 * Costruisce una locandina PNG a partire dal SVG del PitchView e dai dati partita.
 * Ritorna un data URL PNG.
 */
export async function buildLocandinaPngDataUrl(
  pitchSvg: SVGSVGElement,
  data: LocandinaData
): Promise<string> {
  // 1. Rasterizzo il campo SVG in un canvas temporaneo
  const pitchWidth = 900
  const pitchHeight = 1260
  const pitchCanvas = await rasterizeSvg(pitchSvg, pitchWidth, pitchHeight)

  // 2. Calcolo layout locandina
  const CANVAS_W = 900
  const HEADER_H = 240
  const FOOTER_MIN_H = 260

  // Calcolo altezza footer dinamica in base al testo (approssimo)
  const marcatoriLines = wrapEstimate(formatMarcatoriString(data), CANVAS_W - 80, 22)
  const cambiLines = data.sostituzioni.length > 0
    ? wrapEstimate(formatCambiString(data.sostituzioni), CANVAS_W - 80, 22)
    : 0
  const footerH = Math.max(FOOTER_MIN_H, 80 + (marcatoriLines + cambiLines) * 28 + 60)

  const CANVAS_H = HEADER_H + pitchHeight + footerH

  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context non disponibile')

  // Anti-aliasing per testo su Retina
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // 3. Header
  drawHeader(ctx, CANVAS_W, HEADER_H, data)

  // 4. Campo (copio il canvas rasterizzato)
  ctx.drawImage(pitchCanvas, 0, HEADER_H, CANVAS_W, pitchHeight)

  // 5. Footer
  drawFooter(ctx, CANVAS_W, HEADER_H + pitchHeight, footerH, data, marcatoriLines, cambiLines)

  return canvas.toDataURL('image/png')
}

/** Rasterizza un elemento SVG in un canvas alle dimensioni target */
async function rasterizeSvg(svg: SVGSVGElement, w: number, h: number): Promise<HTMLCanvasElement> {
  const serializer = new XMLSerializer()
  let svgStr = serializer.serializeToString(svg)
  if (!svgStr.match(/^<svg[^>]+xmlns=/)) {
    svgStr = svgStr.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')
  }
  // Forza width/height espliciti
  svgStr = svgStr.replace(/^<svg[^>]*>/, m => m.replace(/\s(width|height)="[^"]*"/g, ''))
                 .replace(/^<svg/, `<svg width="${w}" height="${h}"`)

  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('rasterizeSvg: caricamento fallito'))
      img.src = url
    })
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const cx = c.getContext('2d')!
    // Sfondo verde di sicurezza (già presente nel SVG del PitchView)
    cx.fillStyle = '#2d7a3e'
    cx.fillRect(0, 0, w, h)
    cx.drawImage(img, 0, 0, w, h)
    return c
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Disegna l'header: gradient nel colore team, titoli team e score */
function drawHeader(ctx: CanvasRenderingContext2D, w: number, h: number, data: LocandinaData) {
  const isHome = data.venue === 'home'

  // Gradient sfondo header
  const grad = ctx.createLinearGradient(0, 0, w, 0)
  grad.addColorStop(0, darken(data.teamColor, 0.15))
  grad.addColorStop(1, data.teamColor)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  // Fascia superiore chiara con competizione + data
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  ctx.fillRect(0, 0, w, 42)

  const d = new Date(data.matchDate)
  const dateStr = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  const topLine = [
    data.competition || 'Amichevole',
    capitalizeFirst(dateStr),
    timeStr,
    isHome ? '🏠 Casa' : '✈️ Trasferta',
  ].filter(Boolean).join(' · ')

  ctx.fillStyle = '#fff'
  ctx.font = '600 18px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(topLine, w / 2, 21)

  // Team names (sx = Lenci se casa, dx altrimenti) + score al centro
  const homeName = isHome ? data.teamName : data.opponentName
  const awayName = isHome ? data.opponentName : data.teamName
  const homeScore = isHome ? data.ourScore : data.theirScore
  const awayScore = isHome ? data.theirScore : data.ourScore

  // Categoria squadra sotto il nome, se presente (mostra solo la nostra)
  const centerY = 42 + (h - 42) / 2

  // Nome Home (sinistra)
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.font = '800 30px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
  const homeNameLines = wrapText(ctx, homeName.toUpperCase(), 320)
  drawMultilineText(ctx, homeNameLines, w / 2 - 100, centerY - 14, 34)

  // Sottolineatura categoria home se è Lenci
  if (isHome && data.teamCategory) {
    ctx.font = '600 15px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText(data.teamCategory, w / 2 - 100, centerY + 30)
  }

  // Nome Away (destra)
  ctx.textAlign = 'left'
  ctx.font = '800 30px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
  ctx.fillStyle = '#fff'
  const awayNameLines = wrapText(ctx, awayName.toUpperCase(), 320)
  drawMultilineText(ctx, awayNameLines, w / 2 + 100, centerY - 14, 34)

  if (!isHome && data.teamCategory) {
    ctx.font = '600 15px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText(data.teamCategory, w / 2 + 100, centerY + 30)
  }

  // Score al centro dentro un badge scuro
  const scoreText = `${homeScore} - ${awayScore}`
  ctx.font = '900 54px "Anybody", system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  const scoreW = 180
  const scoreBoxH = 82
  ctx.fillRect(w / 2 - scoreW / 2, centerY - scoreBoxH / 2, scoreW, scoreBoxH)
  ctx.fillStyle = '#fff'
  ctx.fillText(scoreText, w / 2, centerY + 4)
}

/** Disegna il footer con marcatori, sostituzioni, modulo */
function drawFooter(
  ctx: CanvasRenderingContext2D, w: number, top: number, h: number,
  data: LocandinaData, marcatoriLines: number, cambiLines: number
) {
  // Sfondo bianco con bordo superiore colorato
  ctx.fillStyle = '#f8f9fc'
  ctx.fillRect(0, top, w, h)
  ctx.fillStyle = data.teamColor
  ctx.fillRect(0, top, w, 6)

  let y = top + 34
  const padding = 40

  // Marcatori Lenci
  const marcatoriStr = formatMarcatoriString(data)
  if (marcatoriStr) {
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#8e6300'
    ctx.font = '800 15px system-ui, sans-serif'
    ctx.fillText('⚽ MARCATORI', padding, y)
    y += 24
    ctx.fillStyle = '#181c20'
    ctx.font = '400 17px system-ui, sans-serif'
    const lines = wrapText(ctx, marcatoriStr, w - padding * 2)
    for (const l of lines) {
      ctx.fillText(l, padding, y)
      y += 26
    }
    y += 8
  }

  // Sostituzioni
  if (cambiLines > 0) {
    ctx.fillStyle = '#005f98'
    ctx.font = '800 15px system-ui, sans-serif'
    ctx.fillText('🔄 SOSTITUZIONI', padding, y)
    y += 24
    ctx.fillStyle = '#181c20'
    ctx.font = '400 17px system-ui, sans-serif'
    const cambiStr = formatCambiString(data.sostituzioni)
    const lines = wrapText(ctx, cambiStr, w - padding * 2)
    for (const l of lines) {
      ctx.fillText(l, padding, y)
      y += 26
    }
    y += 8
  }

  // Riga inferiore: modulo + hashtag
  const bottomY = top + h - 20
  ctx.fillStyle = '#404751'
  ctx.font = '700 14px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(`📋 Modulo: ${data.formation}`, padding, bottomY)

  const hashtag = `#${data.teamName.replace(/[^A-Za-zÀ-ÿ0-9]/g, '')}`
  ctx.textAlign = 'right'
  ctx.fillStyle = data.teamColor
  ctx.font = '800 14px system-ui, sans-serif'
  ctx.fillText(hashtag, w - padding, bottomY)
}

// ============ helpers testo ============

function formatMarcatoriString(data: LocandinaData): string {
  const parts: string[] = []
  for (const m of data.marcatori) {
    if (m.minutes.length === 0) continue
    const minStrs = m.minutes.map((min, i) => `${min}'${m.isPenalty?.[i] ? ' rig' : ''}`)
    parts.push(`${m.name} (${minStrs.join(', ')})`)
  }
  for (const min of data.opponentOwnGoalMinutes) {
    parts.push(`Autogol avv. (${min}')`)
  }
  return parts.join(' · ')
}

function formatCambiString(subs: Sostituzione[]): string {
  return subs.map(s => `${s.minute}' ${s.in} \u2190 ${s.out}`).join(' · ')
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    const test = current ? `${current} ${w}` : w
    if (ctx.measureText(test).width <= maxWidth) {
      current = test
    } else {
      if (current) lines.push(current)
      current = w
    }
  }
  if (current) lines.push(current)
  return lines
}

/** Stima quante righe ci vorranno per un testo, usato prima di creare il canvas */
function wrapEstimate(text: string, maxWidth: number, avgCharPx: number): number {
  if (!text) return 0
  const charsPerLine = Math.max(1, Math.floor(maxWidth / (avgCharPx * 0.55)))
  return Math.max(1, Math.ceil(text.length / charsPerLine))
}

function drawMultilineText(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight: number) {
  // Se ho più righe, sposto y in su per centrare verticalmente
  const totalH = lines.length * lineHeight
  const startY = y - totalH / 2 + lineHeight / 2
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, startY + i * lineHeight)
  }
}

function darken(hex: string, amount: number): string {
  // hex = "#rrggbb"
  const c = hex.replace('#', '')
  if (c.length !== 6) return hex
  const r = Math.max(0, Math.floor(parseInt(c.slice(0, 2), 16) * (1 - amount)))
  const g = Math.max(0, Math.floor(parseInt(c.slice(2, 4), 16) * (1 - amount)))
  const b = Math.max(0, Math.floor(parseInt(c.slice(4, 6), 16) * (1 - amount)))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
