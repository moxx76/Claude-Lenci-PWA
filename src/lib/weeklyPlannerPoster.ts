/**
 * Generatore planner settimanale per WhatsApp/social.
 * Canvas 1080x1350 stile Lenci con 7 giorni della settimana.
 */

import { formatEventLocationParts } from './eventLocation'

export interface PlannerEvent {
  kind: 'training' | 'match' | 'tournament'
  time: string | null   // HH:MM
  endTime?: string | null
  teamName: string
  teamColor: string | null
  opponent?: string | null   // per match
  venue?: 'home' | 'away' | null
  location?: string | null
  /** Indirizzo esteso (matches.location_address) — serve per estrarre la città in chiaro (v1.9.106). */
  locationAddress?: string | null
  competition?: string | null
}

export interface WeeklyPlannerData {
  /** Data lunedì della settimana (YYYY-MM-DD) */
  weekStart: string
  /** Titolo secondario, es. "TUTTE LE SQUADRE" o "UNDER 14" */
  scopeLabel: string
  /** 7 giorni ordinati lun→dom */
  days: Array<{
    date: string        // YYYY-MM-DD
    events: PlannerEvent[]
  }>
}

const W = 1080
const H = 1350

const COL = {
  blueDark: '#0d1f3d',
  blueMid: '#1e3a75',
  blueBrand: '#1e5fb6',
  blueLight: '#4a90d9',
  red: '#c73434',
  redSoft: 'rgba(199,52,52,0.15)',
  redPill: '#a02525',
  white: '#ffffff',
  cream: '#f5f5f0',
  slate: '#404751',
  slateSoft: '#707882',
  restGrey: 'rgba(255,255,255,0.06)',
}

const DAY_NAMES = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM']
const MONTHS_IT = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

export async function generateWeeklyPlannerPoster(
  data: WeeklyPlannerData,
  logoUrl: string = '/lenci-logo-ufficiale.jpg'
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D non disponibile')

  const logo = await loadImage(logoUrl)

  // ==================== BACKGROUND ====================
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, COL.blueDark)
  bg.addColorStop(0.5, COL.blueMid)
  bg.addColorStop(1, COL.blueDark)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Bande decorative angoli
  ctx.save()
  ctx.globalAlpha = 0.30
  ctx.fillStyle = COL.red
  ctx.beginPath()
  ctx.moveTo(0, 0); ctx.lineTo(220, 0); ctx.lineTo(0, 200); ctx.closePath(); ctx.fill()
  ctx.fillStyle = COL.blueLight
  ctx.beginPath()
  ctx.moveTo(W - 280, 0); ctx.lineTo(W, 0); ctx.lineTo(W, 240); ctx.closePath(); ctx.fill()
  ctx.fillStyle = COL.red
  ctx.beginPath()
  ctx.moveTo(W, H); ctx.lineTo(W, H - 180); ctx.lineTo(W - 200, H); ctx.closePath(); ctx.fill()
  ctx.fillStyle = COL.blueLight
  ctx.beginPath()
  ctx.moveTo(0, H); ctx.lineTo(280, H); ctx.lineTo(0, H - 220); ctx.closePath(); ctx.fill()
  ctx.restore()

  // Watermark logo
  ctx.save()
  ctx.globalAlpha = 0.04
  const wmSize = 850
  ctx.drawImage(logo, W / 2 - wmSize / 2, H / 2 - wmSize / 2, wmSize, wmSize)
  ctx.restore()

  // ==================== HEADER ====================
  const logoSize = 180
  const logoX = 50
  const logoY = 45
  ctx.save()
  ctx.beginPath()
  ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 7, 0, Math.PI * 2)
  ctx.fillStyle = COL.white
  ctx.shadowColor = 'rgba(0,0,0,0.4)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 5
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2)
  ctx.clip()
  ctx.drawImage(logo, logoX, logoY, logoSize, logoSize)
  ctx.restore()

  // Titolo
  ctx.fillStyle = COL.white
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 4
  ctx.font = '900 62px "Anybody", "Arial Black", sans-serif'
  ctx.fillText('PLANNER', 260, 55)
  ctx.font = '900 62px "Anybody", "Arial Black", sans-serif'
  ctx.fillText('SETTIMANALE', 260, 118)
  ctx.restore()

  // Sottotitolo scope (categoria squadra) — stesso font/size del titolo, in rosso brand
  // Auto-shrink se il testo è troppo largo (es. 'PICCOLI AMICI 2020-21')
  const scopeText = data.scopeLabel.toUpperCase()
  const maxWidth = 780  // spazio disponibile a destra del logo (fino a x=1040)
  let scopeSize = 62
  ctx.font = `900 ${scopeSize}px "Anybody", "Arial Black", sans-serif`
  while (ctx.measureText(scopeText).width > maxWidth && scopeSize > 34) {
    scopeSize -= 2
    ctx.font = `900 ${scopeSize}px "Anybody", "Arial Black", sans-serif`
  }
  ctx.fillStyle = COL.red
  ctx.fillText(scopeText, 260, 181)

  // Banner range date
  const weekStartDate = new Date(data.weekStart + 'T00:00:00')
  const weekEndDate = new Date(weekStartDate.getTime() + 6 * 86400000)
  const rangeStr = formatDateRange(weekStartDate, weekEndDate)

  const bannerY = 270
  const bannerH = 56
  ctx.save()
  ctx.fillStyle = COL.red
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 3
  roundRect(ctx, 40, bannerY, W - 80, bannerH, 14)
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = COL.white
  ctx.font = '900 26px "Anybody", "Arial Black", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(rangeStr.toUpperCase(), W / 2, bannerY + bannerH / 2 + 2)

  // ==================== GRIGLIA GIORNI ====================
  const gridY = 335
  const gridH = H - gridY - 130   // 130px riservati al footer
  const rowH = gridH / 7          // 7 giorni

  for (let i = 0; i < 7; i++) {
    const day = data.days[i]
    if (!day) continue
    drawDayRow(ctx, 40, gridY + i * rowH, W - 80, rowH, day, i)
  }

  // ==================== FOOTER ====================
  const footerY = H - 100

  // Slogan composto affiancato (bianco + "maglia" rosso più grande + bianco)
  ctx.save()
  ctx.font = 'italic 700 20px "Georgia", serif'
  const w1 = ctx.measureText('«Casa non è un luogo, è una ').width
  ctx.font = 'italic 900 24px "Georgia", serif'
  const w2 = ctx.measureText('maglia').width
  ctx.font = 'italic 700 20px "Georgia", serif'
  const w3 = ctx.measureText('»').width
  const totalW = w1 + w2 + w3
  let cursor = W / 2 - totalW / 2
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = 'italic 700 20px "Georgia", serif'
  ctx.fillText('«Casa non è un luogo, è una ', cursor, footerY)
  cursor += w1
  ctx.font = 'italic 900 24px "Georgia", serif'
  ctx.fillStyle = COL.red
  ctx.fillText('maglia', cursor, footerY - 1)
  cursor += w2
  ctx.font = 'italic 700 20px "Georgia", serif'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText('»', cursor, footerY)
  ctx.restore()

  // Firma club
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '700 13px system-ui, Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('ASD LENCI POIRINO · SETTORE GIOVANILE', W / 2, footerY + 40)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Errore generazione PNG'))),
      'image/png',
      0.95
    )
  })
}

// ============================================================
// DRAW: singola riga giorno
// ============================================================

function drawDayRow(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  day: { date: string; events: PlannerEvent[] },
  dayIndex: number
) {
  const [yr, mo, dy] = day.date.split('-').map(Number)
  const d = new Date(yr, mo - 1, dy)
  const isMatchDay = day.events.some(e => e.kind === 'match' || e.kind === 'tournament')
  const isEmpty = day.events.length === 0

  // Sfondo riga
  const rowH = h - 6  // gap 6 tra righe
  ctx.save()
  const bgColor = isMatchDay
    ? 'rgba(199,52,52,0.14)'
    : isEmpty
      ? 'rgba(255,255,255,0.04)'
      : 'rgba(255,255,255,0.09)'
  ctx.fillStyle = bgColor
  roundRect(ctx, x, y, w, rowH, 12)
  ctx.fill()
  const stripe = isMatchDay ? COL.red : isEmpty ? 'rgba(255,255,255,0.15)' : COL.blueBrand
  ctx.fillStyle = stripe
  roundRect(ctx, x, y, 8, rowH, 4)
  ctx.fill()
  ctx.restore()

  // Box giorno (a sinistra)
  const dayBoxW = 130
  const dayBoxX = x + 25
  const dayBoxCy = y + rowH / 2

  ctx.fillStyle = COL.white
  ctx.font = '800 15px "Anybody", Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(DAY_NAMES[dayIndex], dayBoxX, dayBoxCy - 24)

  ctx.fillStyle = COL.white
  ctx.font = '900 46px "Anybody", "Arial Black", sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(d.getDate()).padStart(2, '0'), dayBoxX, dayBoxCy + 8)

  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '600 12px system-ui, Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(MONTHS_IT[d.getMonth()].slice(0, 3).toUpperCase(), dayBoxX + 62, dayBoxCy + 8)

  // Divider verticale
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x + dayBoxW + 10, y + 12)
  ctx.lineTo(x + dayBoxW + 10, y + rowH - 12)
  ctx.stroke()
  ctx.restore()

  // Eventi (a destra)
  const evX = x + dayBoxW + 25
  const evW = w - dayBoxW - 40
  const evTopY = y + 12
  const evBottomY = y + rowH - 12
  const evH = evBottomY - evTopY

  if (isEmpty) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.font = 'italic 600 20px system-ui, Arial, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('💤  Riposo', evX, y + rowH / 2)
    return
  }

  // Se troppi eventi (>3), impila con font più piccolo
  const evs = day.events.slice(0, 4)
  const perEvH = evH / evs.length
  for (let i = 0; i < evs.length; i++) {
    drawEvent(ctx, evX, evTopY + i * perEvH, evW, perEvH, evs[i], evs.length)
  }
}

function drawEvent(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  ev: PlannerEvent,
  totalEvs: number
) {
  const cy = y + h / 2
  const isMatch = ev.kind === 'match' || ev.kind === 'tournament'
  const iconLetter = isMatch ? 'P' : 'A'
  const iconBg = isMatch ? COL.red : COL.blueBrand

  // Badge tipo (P/A)
  const badgeR = totalEvs <= 2 ? 15 : 12
  ctx.save()
  ctx.fillStyle = iconBg
  ctx.beginPath()
  ctx.arc(x + badgeR, cy, badgeR, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = COL.white
  ctx.font = `900 ${totalEvs <= 2 ? 14 : 12}px "Anybody", Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(iconLetter, x + badgeR, cy + 1)
  ctx.restore()

  // Ora inizio (grande)
  const oraStr = ev.time || '—'
  const oraSize = totalEvs <= 2 ? 22 : 17
  const hasRange = !!ev.endTime && !!ev.time
  const oraY = hasRange ? cy - (oraSize * 0.35) : cy
  ctx.fillStyle = COL.white
  ctx.font = `900 ${oraSize}px "Anybody", Arial, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const oraX = x + badgeR * 2 + 14
  ctx.fillText(oraStr, oraX, oraY)
  const oraW = ctx.measureText(oraStr).width

  // Ora fine (piccola, sotto la principale)
  let endW = 0
  if (hasRange) {
    const endStr = `→ ${ev.endTime}`
    const endSize = totalEvs <= 2 ? 13 : 11
    ctx.font = `700 ${endSize}px system-ui, Arial, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.62)'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    const endY = cy + (endSize * 0.65)
    ctx.fillText(endStr, oraX, endY)
    endW = ctx.measureText(endStr).width
  }

  // Testo evento (compatto): la X di partenza è dopo il blocco orario più largo
  const oraBlockW = Math.max(oraW, endW)
  const textX = oraX + oraBlockW + 14
  const textMaxW = x + w - textX - 4

  // v1.9.108: layout partita con etichetta esplicita "LOCALITÀ:".
  // Richiesta Davide: avere la città in una riga dedicata, dichiarata — non
  // mescolata con l'avversario — così si capisce al volo DOVE si gioca.
  //
  // Layout per le partite (totalEvs ≤ 2, c'è spazio verticale):
  //   Line 1 (grande, bianco):      UNDER 14 ANNATA 2013
  //   Line 2 (media, bianco):       🏠 vs ANDEZENO
  //   Line 3 (media, giallo soft):  LOCALITÀ: Poirino
  //   Line 4 (piccola, opaca):      Pre-Campionato U14 Prov. · G1 · 1ª g Rit (solo se c'è competition)
  //
  // Giorni densi (totalEvs ≥ 3): si torna al layout compatto a 2 righe
  // (team + "🏠 Poirino · vs Andezeno") per non rompere la densità.
  // Allenamenti: 2 righe (team + location) come prima.
  const nameSize = totalEvs <= 2 ? 17 : 14
  const descSize = totalEvs <= 2 ? 14 : 11

  // Preparo le info match
  let city = ''
  let icon = ''
  let opponentLine = ''
  let compactComp: string | null = null
  if (isMatch) {
    const parts = formatEventLocationParts({
      venue: ev.venue ?? null,
      location: ev.location ?? null,
      locationAddress: ev.locationAddress ?? null,
      competition: ev.competition ?? null,
      kind: ev.kind === 'tournament' ? 'tournament' : 'match',
    })
    icon = parts?.icon || (ev.venue === 'home' ? '🏠' : '✈')
    city = parts?.primary || ''
    const opponent = ev.opponent || '—'
    opponentLine = `${icon} vs ${opponent}`
    if (ev.competition) {
      compactComp = compactCompetitionLabel(ev.competition)
    }
  }

  // Decide quante righe: match con spazio e città → layout "espanso" (3 o 4 righe)
  // Match senza spazio o allenamenti → layout "compatto" (2 righe)
  const matchExpanded = isMatch && totalEvs <= 2 && !!city
  const matchCompact = isMatch && !matchExpanded
  const useFourLines = matchExpanded && !!compactComp && totalEvs === 1

  // Coordinate Y per il layout espanso (3 o 4 righe)
  let line1Y = 0, line2Y = 0, line3Y = 0, line4Y = 0
  if (useFourLines) {
    // 4 righe, 22-24px di passo verticale
    line1Y = cy - 32
    line2Y = cy - 10
    line3Y = cy + 10
    line4Y = cy + 30
  } else if (matchExpanded) {
    // 3 righe (team + vs + LOCALITÀ:)
    line1Y = totalEvs === 1 ? cy - 22 : cy - 15
    line2Y = cy
    line3Y = totalEvs === 1 ? cy + 22 : cy + 15
  } else {
    // 2 righe standard
    line1Y = totalEvs === 1 ? cy - 10 : cy - (nameSize * 0.6)
    line2Y = totalEvs === 1 ? cy + 12 : cy + (descSize * 0.7)
  }

  // Line 1: squadra (grande, bianco pieno)
  ctx.font = `700 ${nameSize}px system-ui, Arial, sans-serif`
  ctx.fillStyle = COL.white
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  drawTruncatedText(ctx, ev.teamName.toUpperCase(), textX, line1Y, textMaxW)

  if (matchExpanded) {
    // Line 2: "🏠 vs AVVERSARIO" (medio, bianco pieno)
    ctx.font = `700 ${descSize}px system-ui, Arial, sans-serif`
    ctx.fillStyle = COL.white
    drawTruncatedText(ctx, opponentLine, textX, line2Y, textMaxW)

    // Line 3: "LOCALITÀ: Poirino" con la label dichiarata.
    // La label è in giallo soft (crema) e la città in bianco pieno per farla risaltare.
    const locSize = descSize
    const labelText = 'LOCALITÀ: '
    ctx.font = `800 ${locSize}px system-ui, Arial, sans-serif`
    const labelW = ctx.measureText(labelText).width
    ctx.fillStyle = COL.cream
    ctx.fillText(labelText, textX, line3Y)
    // Città subito dopo la label, con troncamento sul resto della larghezza
    ctx.font = `700 ${locSize}px system-ui, Arial, sans-serif`
    ctx.fillStyle = COL.white
    drawTruncatedText(ctx, city, textX + labelW, line3Y, Math.max(0, textMaxW - labelW))

    // Line 4 (opzionale, solo se un unico evento nel giorno): nome torneo abbreviato
    if (useFourLines && compactComp) {
      ctx.font = `500 12px system-ui, Arial, sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.62)'
      drawTruncatedText(ctx, compactComp, textX, line4Y, textMaxW)
    }
  } else if (matchCompact) {
    // 2 righe compatte (giorni densi): tutto su line 2 con separatore medio
    ctx.font = `600 ${descSize}px system-ui, Arial, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    const compactLine = city
      ? `${icon} ${city} · vs ${ev.opponent || '—'}`
      : `${icon} vs ${ev.opponent || '—'}`
    drawTruncatedText(ctx, compactLine, textX, line2Y, textMaxW)
  } else {
    // Allenamento o fallback
    ctx.font = `600 ${descSize}px system-ui, Arial, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    drawTruncatedText(ctx, ev.location || 'Allenamento', textX, line2Y, textMaxW)
  }
}

/**
 * Abbrevia il nome competizione per entrarci nella line 3 del poster
 * settimanale senza perdere informazione utile.
 *
 * Esempi di normalizzazione:
 *   "Torneo Pre-Campionato U14 Provinciale - Girone 1 - 1ª giornata ritorno"
 *     → "Pre-Campionato U14 Provinciale · G1 · 1ª Rit"
 *   "Prima categoria — Girone E · G.1 (andata)"
 *     → "Prima categoria · G.E · G.1 (A)"
 *   "Coppa Piemonte Prima categoria — Girone 14 · G.1 (andata)"
 *     → "Coppa Piemonte · G.14 · G.1 (A)"
 *   "Amichevole" → "Amichevole"  (invariato)
 */
function compactCompetitionLabel(competition: string): string {
  let s = competition.trim()
  // Rimuovo "Torneo " iniziale (ridondante col badge P rosso)
  s = s.replace(/^torneo\s+/i, '')
  // Normalizza separatori: " — " e " - " → " · "
  s = s.replace(/\s+[-—]\s+/g, ' · ')
  // "Girone 1" → "G1", "Girone 14" → "G14", "Girone E" → "G.E"
  s = s.replace(/\bgirone\s+(\d+)\b/gi, 'G$1')
  s = s.replace(/\bgirone\s+([A-Z])\b/gi, 'G.$1')
  // "1ª giornata" / "2ª giornata" → "1ª g" (solo in coda)
  s = s.replace(/\b(\d+ª)\s+giornata\b/gi, '$1 g')
  // "andata" → "A", "ritorno" → "Rit"
  s = s.replace(/\bandata\b/gi, 'A')
  s = s.replace(/\britorno\b/gi, 'Rit')
  // Compatto spazi doppi
  s = s.replace(/\s{2,}/g, ' ').trim()
  return s
}

// ============================================================
// HELPERS
// ============================================================

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Impossibile caricare immagine: ${src}`))
    img.src = src
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawTruncatedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  let toDraw = text
  if (ctx.measureText(toDraw).width > maxWidth) {
    while (toDraw.length > 3 && ctx.measureText(toDraw + '…').width > maxWidth) {
      toDraw = toDraw.slice(0, -1)
    }
    toDraw += '…'
  }
  ctx.fillText(toDraw, x, y)
}

function formatDateRange(start: Date, end: Date): string {
  const dStart = start.getDate()
  const dEnd = end.getDate()
  const mStart = MONTHS_IT[start.getMonth()]
  const mEnd = MONTHS_IT[end.getMonth()]
  const yEnd = end.getFullYear()
  if (start.getMonth() === end.getMonth()) {
    return `${dStart}–${dEnd} ${mStart} ${yEnd}`
  }
  return `${dStart} ${mStart} – ${dEnd} ${mEnd} ${yEnd}`
}

// ============================================================
// DOWNLOAD / SHARE (riuso pattern locandina)
// ============================================================

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}

export async function shareOrDownload(blob: Blob, filename: string, title: string) {
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean
    share?: (data: { title?: string; files?: File[] }) => Promise<void>
  }
  if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
    try {
      await nav.share({ title, files: [file] })
      return
    } catch { /* fallback */ }
  }
  downloadBlob(blob, filename)
}
