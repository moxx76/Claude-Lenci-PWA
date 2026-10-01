/**
 * weekendSectorPlannerBuilder — Genera un PNG del "Weekend del club" raggruppato
 * per settore (Prima Squadra, Settore Giovanile, Scuola Calcio).
 *
 * Formato 1080×1920 (9:16) ideale per WhatsApp Status, Instagram Stories, condivisione
 * nel gruppo dirigenti. Altezza dinamica se ci sono molti eventi.
 *
 * Differenza rispetto a weekendPlannerBuilder (v1.9.95):
 *   - Quello raggruppa per GIORNO (Sabato / Domenica)
 *   - Questo raggruppa per SETTORE (Prima / Giovanile / Scuola Calcio)
 *     mostrando dentro ogni settore gli eventi in ordine cronologico
 *
 * Zero dipendenze esterne. Canvas 2D nativo.
 */

export type SectorKey = 'prima' | 'agonistica' | 'scuola'

export interface SectorEvent {
  date: string              // YYYY-MM-DD
  startTime: string         // HH:MM
  endTime: string | null
  kind: 'training' | 'match'
  teamName: string | null
  teamColor: string | null
  title: string             // 'Allenamento' oppure 'vs Avversario'
  opponent: string | null
  venue: 'home' | 'away' | null
  location: string | null
}

export interface SectorPlannerData {
  saturdayISO: string
  sundayISO: string
  sections: {
    prima: SectorEvent[]
    agonistica: SectorEvent[]
    scuola: SectorEvent[]
  }
  clubName?: string
}

// === Layout costanti ===========================================================
const W = 1080
const PAD = 60
const HEADER_H = 340
const SECTION_HEADER_H = 100
const EVENT_CARD_H = 180
const EVENT_GAP = 16
const SECTION_GAP = 40
const EMPTY_SECTION_H = 110
const FOOTER_H = 100

// Palette
const COLOR_BG = '#f5f7fb'
const COLOR_TEXT = '#181c20'
const COLOR_MUTED = '#707882'
const COLOR_WHITE = '#ffffff'

const SECTOR_META: Record<SectorKey, {
  label: string; accent: string; accentDark: string; bg: string;
  icon: string;
}> = {
  prima: {
    label: 'PRIMA SQUADRA', accent: '#93000a', accentDark: '#6a0007',
    bg: '#ffdad6', icon: '🏆',
  },
  agonistica: {
    label: 'SETTORE GIOVANILE', accent: '#005f98', accentDark: '#003c5f',
    bg: '#cfe5ff', icon: '⚽',
  },
  scuola: {
    label: 'SCUOLA CALCIO', accent: '#8e6300', accentDark: '#5c4100',
    bg: '#fff2b3', icon: '🧒',
  },
}

const KIND_META: Record<SectorEvent['kind'], { label: string; bg: string; fg: string }> = {
  training: { label: 'ALLENAMENTO', bg: '#cfe5ff', fg: '#003c5f' },
  match:    { label: 'PARTITA',     bg: '#ffdad6', fg: '#7a0000' },
}

// === API principale ============================================================
export async function buildSectorWeekendPng(data: SectorPlannerData): Promise<Blob> {
  const clubName = data.clubName || 'ASD Lenci Poirino'

  // Calcolo altezza: header + 3 sezioni + footer
  let bodyH = 0
  for (const key of ['prima', 'agonistica', 'scuola'] as const) {
    const items = data.sections[key]
    bodyH += SECTION_HEADER_H
    if (items.length === 0) {
      bodyH += EMPTY_SECTION_H
    } else {
      bodyH += items.length * EVENT_CARD_H + (items.length - 1) * EVENT_GAP
    }
    bodyH += SECTION_GAP
  }
  bodyH -= SECTION_GAP

  const totalH = Math.max(1920, HEADER_H + 20 + bodyH + FOOTER_H + 40)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = totalH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D non disponibile')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // Sfondo
  ctx.fillStyle = COLOR_BG
  ctx.fillRect(0, 0, W, totalH)

  // Header + body + footer
  drawHeader(ctx, data, clubName)
  let y = HEADER_H + 20
  for (const key of ['prima', 'agonistica', 'scuola'] as const) {
    y = drawSection(ctx, y, key, data.sections[key])
    y += SECTION_GAP
  }
  drawFooter(ctx, totalH, clubName)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png', 0.95)
  })
}

// === Header ====================================================================
function drawHeader(ctx: CanvasRenderingContext2D, data: SectorPlannerData, clubName: string) {
  // Gradient blu scuro → viola (identità "del club", neutra rispetto ai colori settore)
  const grad = ctx.createLinearGradient(0, 0, W, HEADER_H)
  grad.addColorStop(0, '#003c5f')
  grad.addColorStop(0.5, '#005f98')
  grad.addColorStop(1, '#7a0071')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, HEADER_H)

  // Pattern diagonale decorativo
  ctx.save()
  ctx.globalAlpha = 0.08
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2
  for (let i = -HEADER_H; i < W; i += 40) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + HEADER_H, HEADER_H)
    ctx.stroke()
  }
  ctx.restore()

  // Eyebrow club
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  const eyebrowText = clubName.toUpperCase()
  ctx.font = '700 22px "Segoe UI", -apple-system, sans-serif'
  const eyebrowW = ctx.measureText(eyebrowText).width + 40
  roundRect(ctx, PAD, 50, eyebrowW, 44, 22)
  ctx.fill()
  ctx.fillStyle = COLOR_WHITE
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(eyebrowText, PAD + 20, 72)

  // Titolo WEEKEND / DEL CLUB
  ctx.fillStyle = COLOR_WHITE
  ctx.font = '900 84px "Segoe UI", -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('WEEKEND', PAD, 120)
  ctx.fillText('DEL CLUB', PAD, 210)

  // Emoji in alto a destra
  ctx.font = '96px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillText('📋', W - PAD, 130)

  // Sottotitolo date
  const dateRange = `${formatDate(data.saturdayISO)} · ${formatDate(data.sundayISO)}`
  ctx.font = '600 28px "Segoe UI", -apple-system, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(dateRange, PAD, 300)
}

// === Sezione ===================================================================
function drawSection(
  ctx: CanvasRenderingContext2D,
  y: number,
  key: SectorKey,
  items: SectorEvent[],
): number {
  const meta = SECTOR_META[key]

  // Header sezione
  ctx.fillStyle = meta.accent
  roundRect(ctx, PAD, y + 15, 10, 70, 5)
  ctx.fill()

  ctx.fillStyle = COLOR_TEXT
  ctx.font = '900 42px "Segoe UI", -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(meta.label, PAD + 30, y + 20)

  const sub = items.length === 0
    ? 'Nessun impegno'
    : `${items.length} impegn${items.length === 1 ? 'o' : 'i'}`
  ctx.fillStyle = COLOR_MUTED
  ctx.font = '500 24px "Segoe UI", -apple-system, sans-serif'
  ctx.fillText(sub, PAD + 30, y + 70)

  // Emoji settore a destra
  ctx.font = '56px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillText(meta.icon, W - PAD, y + 25)

  y += SECTION_HEADER_H

  if (items.length === 0) {
    drawEmptyBox(ctx, y)
    return y + EMPTY_SECTION_H
  }

  // Ordino per data+ora
  const sorted = [...items].sort((a, b) =>
    a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)
  )
  for (const ev of sorted) {
    drawEventCard(ctx, y, ev, meta)
    y += EVENT_CARD_H + EVENT_GAP
  }
  y -= EVENT_GAP
  return y
}

function drawEmptyBox(ctx: CanvasRenderingContext2D, y: number) {
  const cardX = PAD
  const cardW = W - PAD * 2
  const h = EMPTY_SECTION_H - 20

  ctx.fillStyle = '#ffffff88'
  roundRect(ctx, cardX, y, cardW, h, 16)
  ctx.fill()
  ctx.strokeStyle = '#dfe6ef'
  ctx.lineWidth = 2
  ctx.setLineDash([8, 8])
  roundRect(ctx, cardX, y, cardW, h, 16)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = COLOR_MUTED
  ctx.font = '500 26px "Segoe UI", -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Nessun impegno in programma', W / 2, y + h / 2)
}

// === Card evento ===============================================================
function drawEventCard(
  ctx: CanvasRenderingContext2D,
  y: number,
  ev: SectorEvent,
  sectorMeta: typeof SECTOR_META[SectorKey],
) {
  const cardX = PAD
  const cardW = W - PAD * 2
  const cardH = EVENT_CARD_H
  const kindMeta = KIND_META[ev.kind]

  // Sfondo con ombra
  ctx.save()
  ctx.shadowColor = 'rgba(0,60,95,0.10)'
  ctx.shadowBlur = 12
  ctx.shadowOffsetY = 4
  ctx.fillStyle = '#fff'
  roundRect(ctx, cardX, y, cardW, cardH, 18)
  ctx.fill()
  ctx.restore()

  // Barra sinistra: colore della squadra, fallback al colore del settore
  const stripColor = ev.teamColor || sectorMeta.accent
  ctx.fillStyle = stripColor
  roundRect(ctx, cardX, y + 16, 8, cardH - 32, 4)
  ctx.fill()

  // Blocco data + ora a sinistra
  const dayLabel = dayShort(ev.date)
  const dateX = cardX + 32
  const dateW = 170
  // Giorno (SAB/DOM) small, data numerica, ora grande
  ctx.fillStyle = sectorMeta.accent
  ctx.font = '800 20px "Segoe UI", -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(dayLabel, dateX, y + 28)

  ctx.fillStyle = COLOR_TEXT
  ctx.font = '900 56px "Segoe UI", -apple-system, sans-serif'
  ctx.fillText(ev.startTime, dateX, y + 60)

  if (ev.endTime) {
    ctx.fillStyle = COLOR_MUTED
    ctx.font = '500 20px "Segoe UI", -apple-system, sans-serif'
    ctx.fillText(`→ ${ev.endTime}`, dateX, y + 125)
  }

  // Zona destra
  const rightX = dateX + dateW
  const rightW = cardX + cardW - rightX - 24

  // Badge tipo
  ctx.font = '800 18px "Segoe UI", -apple-system, sans-serif'
  const badgeText = kindMeta.label
  const badgeW = ctx.measureText(badgeText).width + 24
  ctx.fillStyle = kindMeta.bg
  roundRect(ctx, rightX, y + 28, badgeW, 30, 15)
  ctx.fill()
  ctx.fillStyle = kindMeta.fg
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(badgeText, rightX + 12, y + 44)

  // Squadra a fianco del badge
  if (ev.teamName) {
    ctx.fillStyle = ev.teamColor || COLOR_TEXT
    ctx.font = '800 22px "Segoe UI", -apple-system, sans-serif'
    ctx.textBaseline = 'middle'
    const nameX = rightX + badgeW + 12
    ctx.fillText(truncateToWidth(ctx, ev.teamName, rightW - badgeW - 12), nameX, y + 44)
  }

  // Titolo (vs Avversario oppure focus allenamento)
  const mainTitle = ev.kind === 'match' && ev.opponent
    ? `vs ${ev.opponent}`
    : ev.title
  ctx.fillStyle = COLOR_TEXT
  ctx.font = '800 30px "Segoe UI", -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(truncateToWidth(ctx, mainTitle, rightW), rightX, y + 76)

  // Riga location (casa/trasferta + luogo)
  const infoParts: string[] = []
  if (ev.venue === 'home') infoParts.push('🏠 Casa')
  else if (ev.venue === 'away') infoParts.push('✈️ Trasferta')
  if (ev.location) infoParts.push(ev.location)
  if (infoParts.length > 0) {
    ctx.fillStyle = COLOR_MUTED
    ctx.font = '500 22px "Segoe UI", -apple-system, sans-serif'
    ctx.fillText(truncateToWidth(ctx, infoParts.join(' · '), rightW), rightX, y + 120)
  }
}

// === Footer ====================================================================
function drawFooter(ctx: CanvasRenderingContext2D, canvasH: number, clubName: string) {
  const y = canvasH - FOOTER_H
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, y, W, FOOTER_H)
  ctx.strokeStyle = '#e6ebf2'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PAD, y)
  ctx.lineTo(W - PAD, y)
  ctx.stroke()

  ctx.fillStyle = COLOR_MUTED
  ctx.font = '500 22px "Segoe UI", -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${clubName} · Lenci LAB`, PAD, y + FOOTER_H / 2)

  const now = new Date()
  const dateGen = `Generato ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
  ctx.textAlign = 'right'
  ctx.fillText(dateGen, W - PAD, y + FOOTER_H / 2)
}

// === Utility ===================================================================
function dayShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = dt.getDay()
  return dow === 6 ? `SAB ${d}/${m}` : dow === 0 ? `DOM ${d}/${m}` : `${d}/${m}`
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const days = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato']
  const months = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre']
  return `${days[dt.getDay()]} ${d} ${months[m - 1]} ${y}`
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let lo = 0, hi = text.length
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2)
    const test = text.slice(0, mid) + '…'
    if (ctx.measureText(test).width <= maxW) lo = mid
    else hi = mid - 1
  }
  return text.slice(0, lo) + '…'
}

// Download / share riusabili (copiano il pattern di weekendPlannerBuilder)
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function shareOrDownload(blob: Blob, filename: string, title: string): Promise<void> {
  try {
    const file = new File([blob], filename, { type: 'image/png' })
    const nav: any = navigator
    if (nav.canShare && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], title })
      return
    }
  } catch { /* fallthrough */ }
  downloadBlob(blob, filename)
}
