/**
 * weekendPlannerBuilder — Genera un PNG "Planner Weekend" con tutti gli impegni
 * di sabato e domenica raggruppati per giorno.
 *
 * Formato 9:16 (1080×1920) ideale per WhatsApp Status e Instagram Stories.
 * Layout:
 *   - Header viola-blu con titolo, sottotitolo e date del weekend
 *   - (opzionale) Chip filtri attivi (squadra, tipo)
 *   - Sezione SABATO con lista card evento
 *   - Sezione DOMENICA con lista card evento
 *   - Footer con marchio Lenci LAB e data di generazione
 *
 * Il canvas cresce in altezza se ci sono molti eventi, oppure si riduce se
 * pochi — la larghezza resta sempre 1080 per compatibilità con i formati story.
 * Nessuna dipendenza esterna, funziona anche offline.
 */

export interface WeekendPlannerEvent {
  date: string             // YYYY-MM-DD
  startTime: string | null // HH:MM
  endTime: string | null   // HH:MM
  kind: 'training' | 'match' | 'tournament' | 'marketing' | 'meeting'
  title: string
  teamName: string | null
  teamColor: string | null
  location: string | null
  opponent: string | null
  venue: 'home' | 'away' | null
  competition: string | null
}

export interface WeekendPlannerData {
  saturdayISO: string      // YYYY-MM-DD
  sundayISO: string        // YYYY-MM-DD
  events: WeekendPlannerEvent[]
  /** Nome squadra se attivo il filtro squadra (es. "Under 14") */
  teamFilterName?: string | null
  /** Etichetta del filtro tipo (es. "Solo partite") o null per "Tutti" */
  typeFilterLabel?: string | null
  /** Nome del club (default "ASD Lenci Poirino") */
  clubName?: string
}

// ============================================================
// Costanti layout
// ============================================================
const W = 1080
const PAD = 60                   // padding orizzontale
const HEADER_H = 340
const FILTER_BAR_H = 70          // solo se ci sono filtri attivi
const SECTION_HEADER_H = 100
const EVENT_CARD_H = 200         // altezza card evento
const EVENT_GAP = 20             // gap tra card
const SECTION_GAP = 40           // gap tra sabato e domenica
const FOOTER_H = 100
const EMPTY_DAY_H = 130          // se nessun evento in un giorno

// Palette
const COLOR_BLU = '#005f98'
const COLOR_BLU_DARK = '#003c5f'
const COLOR_VIOLA = '#7a0071'
const COLOR_VIOLA_DARK = '#4a1e78'
const COLOR_BG = '#f5f7fb'
const COLOR_TEXT = '#181c20'
const COLOR_MUTED = '#707882'
const COLOR_WHITE = '#ffffff'

// Colori per tipo evento
const KIND_STYLE: Record<WeekendPlannerEvent['kind'], { bg: string; fg: string; label: string; icon: string }> = {
  training:   { bg: '#cfe5ff',                 fg: '#003c5f',  label: 'ALLENAMENTO', icon: '🏃' },
  match:      { bg: '#ffdad6',                 fg: '#7a0000',  label: 'PARTITA',     icon: '⚽' },
  tournament: { bg: 'rgba(255,209,0,0.35)',    fg: '#6a4a00',  label: 'TORNEO',      icon: '🏆' },
  marketing:  { bg: '#f4d0f2',                 fg: '#5a0055',  label: 'EVENTO',      icon: '📣' },
  meeting:    { bg: '#e6dbf5',                 fg: '#3a1560',  label: 'RIUNIONE',    icon: '👥' },
}

// ============================================================
// API principale
// ============================================================
export async function buildWeekendPlannerPng(data: WeekendPlannerData): Promise<Blob> {
  const clubName = data.clubName || 'ASD Lenci Poirino'
  const satEvents = data.events.filter(e => e.date === data.saturdayISO).sort(sortByTime)
  const sunEvents = data.events.filter(e => e.date === data.sundayISO).sort(sortByTime)

  const hasFilters = !!(data.teamFilterName || data.typeFilterLabel)

  // Calcolo altezza dinamica
  const satBlockH = SECTION_HEADER_H + (satEvents.length > 0
    ? satEvents.length * EVENT_CARD_H + (satEvents.length - 1) * EVENT_GAP
    : EMPTY_DAY_H)
  const sunBlockH = SECTION_HEADER_H + (sunEvents.length > 0
    ? sunEvents.length * EVENT_CARD_H + (sunEvents.length - 1) * EVENT_GAP
    : EMPTY_DAY_H)

  // Altezza minima 1920 per compatibilità story-format, se scarso contenuto
  const bodyH = satBlockH + SECTION_GAP + sunBlockH
  const totalH = Math.max(1920, HEADER_H + (hasFilters ? FILTER_BAR_H : 0) + bodyH + FOOTER_H + 40)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = totalH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context non disponibile')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // Sfondo pagina
  ctx.fillStyle = COLOR_BG
  ctx.fillRect(0, 0, W, totalH)

  // Header
  drawHeader(ctx, data, clubName)

  let y = HEADER_H

  // Filter bar (se filtri attivi)
  if (hasFilters) {
    drawFilterBar(ctx, y, data)
    y += FILTER_BAR_H
  }

  y += 20 // padding after header/filter

  // SABATO
  drawSectionHeader(ctx, y, 'SABATO', data.saturdayISO, COLOR_VIOLA)
  y += SECTION_HEADER_H
  if (satEvents.length === 0) {
    drawEmptyDay(ctx, y)
    y += EMPTY_DAY_H
  } else {
    for (const evt of satEvents) {
      drawEventCard(ctx, y, evt)
      y += EVENT_CARD_H + EVENT_GAP
    }
    y -= EVENT_GAP // remove trailing gap
  }

  y += SECTION_GAP

  // DOMENICA
  drawSectionHeader(ctx, y, 'DOMENICA', data.sundayISO, COLOR_BLU)
  y += SECTION_HEADER_H
  if (sunEvents.length === 0) {
    drawEmptyDay(ctx, y)
    y += EMPTY_DAY_H
  } else {
    for (const evt of sunEvents) {
      drawEventCard(ctx, y, evt)
      y += EVENT_CARD_H + EVENT_GAP
    }
  }

  // Footer (sempre in fondo)
  drawFooter(ctx, totalH, clubName)

  // Converto in Blob PNG
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png', 0.95)
  })
}

// ============================================================
// HEADER — gradient viola->blu con titolo grande
// ============================================================
function drawHeader(ctx: CanvasRenderingContext2D, data: WeekendPlannerData, clubName: string) {
  // Gradient di sfondo
  const grad = ctx.createLinearGradient(0, 0, W, HEADER_H)
  grad.addColorStop(0, COLOR_VIOLA_DARK)
  grad.addColorStop(0.5, COLOR_VIOLA)
  grad.addColorStop(1, COLOR_BLU_DARK)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, HEADER_H)

  // Overlay decorativo — righe diagonali sottili
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

  // Piccolo box "eyebrow" con nome club
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

  // Titolo grande "PLANNER WEEKEND"
  ctx.fillStyle = COLOR_WHITE
  ctx.font = '900 84px "Segoe UI", -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('PLANNER', PAD, 120)
  ctx.font = '900 84px "Segoe UI", -apple-system, sans-serif'
  ctx.fillText('WEEKEND', PAD, 210)

  // Icona weekend in alto a destra
  ctx.font = '96px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillText('📅', W - PAD, 130)

  // Sottotitolo con date
  const dateRange = `${formatDateHuman(data.saturdayISO)} · ${formatDateHuman(data.sundayISO)}`
  ctx.font = '600 28px "Segoe UI", -apple-system, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(dateRange, PAD, 300)
}

// ============================================================
// FILTER BAR — chip con filtri attivi
// ============================================================
function drawFilterBar(ctx: CanvasRenderingContext2D, y: number, data: WeekendPlannerData) {
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, y, W, FILTER_BAR_H)

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  let x = PAD

  const chips: Array<{ label: string; bg: string; fg: string }> = []
  if (data.teamFilterName) chips.push({ label: `🏆 ${data.teamFilterName}`, bg: '#e6f2fb', fg: '#004a78' })
  if (data.typeFilterLabel) chips.push({ label: `📌 ${data.typeFilterLabel}`, bg: '#e6dbf5', fg: '#4a1e78' })

  for (const chip of chips) {
    ctx.font = '700 22px "Segoe UI", -apple-system, sans-serif'
    const tw = ctx.measureText(chip.label).width + 34
    ctx.fillStyle = chip.bg
    roundRect(ctx, x, y + 15, tw, 40, 20)
    ctx.fill()
    ctx.fillStyle = chip.fg
    ctx.fillText(chip.label, x + 17, y + 35)
    x += tw + 12
  }

  // Linea separatrice sotto
  ctx.strokeStyle = '#e6ebf2'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PAD, y + FILTER_BAR_H)
  ctx.lineTo(W - PAD, y + FILTER_BAR_H)
  ctx.stroke()
}

// ============================================================
// SECTION HEADER — "SABATO 27" / "DOMENICA 28"
// ============================================================
function drawSectionHeader(ctx: CanvasRenderingContext2D, y: number, dayLabel: string, iso: string, accent: string) {
  // Barra colorata verticale a sinistra
  ctx.fillStyle = accent
  roundRect(ctx, PAD, y + 15, 8, 60, 4)
  ctx.fill()

  // Titolo giorno
  ctx.fillStyle = COLOR_TEXT
  ctx.font = '900 46px "Segoe UI", -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(dayLabel, PAD + 30, y + 15)

  // Data dettaglio "27 sett 2026"
  ctx.fillStyle = COLOR_MUTED
  ctx.font = '500 24px "Segoe UI", -apple-system, sans-serif'
  ctx.fillText(formatDateHuman(iso), PAD + 30, y + 65)
}

// ============================================================
// EVENT CARD — card singolo evento con orario grande a sinistra
// ============================================================
function drawEventCard(ctx: CanvasRenderingContext2D, y: number, evt: WeekendPlannerEvent) {
  const cardX = PAD
  const cardW = W - PAD * 2
  const cardH = EVENT_CARD_H
  const kindStyle = KIND_STYLE[evt.kind]

  // Sfondo card bianco con ombra
  ctx.save()
  ctx.shadowColor = 'rgba(0,60,95,0.10)'
  ctx.shadowBlur = 12
  ctx.shadowOffsetY = 4
  ctx.fillStyle = '#fff'
  roundRect(ctx, cardX, y, cardW, cardH, 20)
  ctx.fill()
  ctx.restore()

  // Barra colorata a sinistra (colore squadra o colore tipo)
  const stripColor = evt.teamColor || kindStyle.fg
  ctx.fillStyle = stripColor
  ctx.beginPath()
  ctx.moveTo(cardX, y + 20)
  ctx.lineTo(cardX + 8, y + 20)
  ctx.lineTo(cardX + 8, y + cardH - 20)
  ctx.lineTo(cardX, y + cardH - 20)
  ctx.closePath()
  ctx.fill()
  // Arrotondo lato sinistro
  ctx.fillRect(cardX, y + 20, 8, cardH - 40)

  // Orario grande a sinistra
  const timeX = cardX + 35
  const timeStr = evt.startTime || '—'
  ctx.fillStyle = COLOR_TEXT
  ctx.font = '900 62px "Segoe UI", -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(timeStr, timeX, y + 40)

  // "→ HH:MM" endTime sotto se presente
  if (evt.endTime) {
    ctx.fillStyle = COLOR_MUTED
    ctx.font = '500 22px "Segoe UI", -apple-system, sans-serif'
    ctx.fillText(`→ ${evt.endTime}`, timeX, y + 108)
  }

  // Zona destra: badge tipo + titolo + luogo
  const rightX = timeX + 240
  const rightW = cardX + cardW - rightX - 30

  // Badge tipo evento (in alto)
  ctx.font = '800 18px "Segoe UI", -apple-system, sans-serif'
  const badgeText = kindStyle.label
  const badgeW = ctx.measureText(badgeText).width + 26
  ctx.fillStyle = kindStyle.bg
  roundRect(ctx, rightX, y + 30, badgeW, 32, 16)
  ctx.fill()
  ctx.fillStyle = kindStyle.fg
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(badgeText, rightX + 13, y + 47)

  // Squadra a fianco del badge (se presente)
  if (evt.teamName) {
    ctx.fillStyle = COLOR_TEXT
    ctx.font = '800 20px "Segoe UI", -apple-system, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText(evt.teamName, rightX + badgeW + 12, y + 47)
  }

  // Titolo evento (o avversario per le partite)
  const mainTitle = evt.kind === 'match' || evt.kind === 'tournament'
    ? (evt.opponent ? `vs ${evt.opponent}` : evt.title)
    : evt.title
  ctx.fillStyle = COLOR_TEXT
  ctx.font = '800 32px "Segoe UI", -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const truncMain = truncateToWidth(ctx, mainTitle, rightW)
  ctx.fillText(truncMain, rightX, y + 82)

  // Riga info (casa/trasferta + location)
  const infoParts: string[] = []
  if (evt.venue === 'home') infoParts.push('🏠 Casa')
  else if (evt.venue === 'away') infoParts.push('✈️ Trasferta')
  if (evt.location) infoParts.push(evt.location)
  const infoLine = infoParts.join(' · ')

  if (infoLine) {
    ctx.fillStyle = COLOR_MUTED
    ctx.font = '500 22px "Segoe UI", -apple-system, sans-serif'
    const truncInfo = truncateToWidth(ctx, infoLine, rightW)
    ctx.fillText(truncInfo, rightX, y + 132)
  }

  // Competizione (in fondo, piccola)
  if (evt.competition) {
    ctx.fillStyle = COLOR_MUTED
    ctx.font = '400 18px "Segoe UI", -apple-system, sans-serif'
    const truncComp = truncateToWidth(ctx, evt.competition, rightW)
    ctx.fillText(truncComp, rightX, y + 165)
  }
}

// ============================================================
// EMPTY DAY — quando un giorno non ha eventi
// ============================================================
function drawEmptyDay(ctx: CanvasRenderingContext2D, y: number) {
  const cardX = PAD
  const cardW = W - PAD * 2
  ctx.fillStyle = '#ffffff88'
  roundRect(ctx, cardX, y, cardW, EMPTY_DAY_H - 20, 20)
  ctx.fill()

  ctx.strokeStyle = '#dfe6ef'
  ctx.lineWidth = 2
  ctx.setLineDash([8, 8])
  roundRect(ctx, cardX, y, cardW, EMPTY_DAY_H - 20, 20)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = COLOR_MUTED
  ctx.font = '500 26px "Segoe UI", -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Nessun impegno in programma', W / 2, y + (EMPTY_DAY_H - 20) / 2)
}

// ============================================================
// FOOTER — marchio e data generazione
// ============================================================
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

// ============================================================
// UTIL
// ============================================================
function sortByTime(a: WeekendPlannerEvent, b: WeekendPlannerEvent): number {
  return (a.startTime || '').localeCompare(b.startTime || '')
}

function formatDateHuman(iso: string): string {
  // Es: "2026-09-27" -> "Sab 27 settembre 2026"
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
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

// ============================================================
// SHARE / DOWNLOAD helpers (compatibili col pattern esistente)
// ============================================================
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
  // Mobile: prova Web Share API con file
  try {
    const file = new File([blob], filename, { type: 'image/png' })
    const nav: any = navigator
    if (nav.canShare && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], title })
      return
    }
  } catch { /* fallthrough */ }
  // Desktop / fallback: download
  downloadBlob(blob, filename)
}
