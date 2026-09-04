/**
 * Generatore locandina convocazione per WhatsApp/social.
 * Rende un canvas 1080x1350 (formato 4:5) e ritorna un Blob PNG.
 */

export interface ConvocationPosterData {
  teamName: string
  opponent: string
  matchDate: string
  matchTime?: string | null
  meetingTime?: string | null       // Ora ritrovo (di solito 1h prima del kickoff)
  venue: 'home' | 'away'
  location?: string | null
  locationAddress?: string | null   // Indirizzo specifico del campo
  competition?: string | null
  players: Array<{
    number?: number | null
    firstName: string
    lastName: string
    isCaptain?: boolean
  }>
  coachName?: string | null
  dressNote?: string | null         // Frase fissa "Presentarsi con divisa di rappresentanza"
}

const W = 1080
const H = 1350

const COL = {
  blueDark: '#0d1f3d',
  blueMid: '#1e3a75',
  blueBrand: '#1e5fb6',
  blueLight: '#4a90d9',
  red: '#c73434',
  redDark: '#a02525',
  white: '#ffffff',
  cream: '#f5f5f0',
  numberBadge: '#0d2b5c',
  slate: '#404751',
  slateSoft: '#707882',
}

export async function generateConvocationPoster(
  data: ConvocationPosterData,
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

  // Bande decorative agli angoli
  ctx.save()
  ctx.globalAlpha = 0.35
  ctx.fillStyle = COL.red
  ctx.beginPath()
  ctx.moveTo(0, 0); ctx.lineTo(240, 0); ctx.lineTo(0, 220); ctx.closePath(); ctx.fill()
  ctx.fillStyle = COL.blueLight
  ctx.beginPath()
  ctx.moveTo(W - 300, 0); ctx.lineTo(W, 0); ctx.lineTo(W, 260); ctx.closePath(); ctx.fill()
  ctx.fillStyle = COL.red
  ctx.beginPath()
  ctx.moveTo(W, H); ctx.lineTo(W, H - 200); ctx.lineTo(W - 220, H); ctx.closePath(); ctx.fill()
  ctx.fillStyle = COL.blueLight
  ctx.beginPath()
  ctx.moveTo(0, H); ctx.lineTo(300, H); ctx.lineTo(0, H - 240); ctx.closePath(); ctx.fill()
  ctx.restore()

  // Watermark logo
  ctx.save()
  ctx.globalAlpha = 0.05
  const wmSize = 900
  ctx.drawImage(logo, W / 2 - wmSize / 2, H / 2 - wmSize / 2, wmSize, wmSize)
  ctx.restore()

  // ==================== HEADER: logo + titolo ====================
  const logoSize = 210
  const logoX = 55
  const logoY = 50
  ctx.save()
  ctx.beginPath()
  ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 8, 0, Math.PI * 2)
  ctx.fillStyle = COL.white
  ctx.shadowColor = 'rgba(0,0,0,0.4)'
  ctx.shadowBlur = 20
  ctx.shadowOffsetY = 6
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2)
  ctx.clip()
  ctx.drawImage(logo, logoX, logoY, logoSize, logoSize)
  ctx.restore()

  // Titolo CONVOCAZIONI
  ctx.fillStyle = COL.white
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 4
  ctx.font = '900 82px "Anybody", "Arial Black", sans-serif'
  ctx.fillText('CONVOCAZIONI', 300, 75)
  ctx.restore()

  // Sottotitolo categoria + competizione (in linea)
  ctx.fillStyle = COL.white
  ctx.font = '800 44px "Anybody", Arial, sans-serif'
  ctx.fillText(data.teamName.toUpperCase(), 300, 175)

  if (data.competition) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.font = '600 22px system-ui, Arial, sans-serif'
    ctx.fillText(data.competition.toUpperCase(), 300, 232)
  }

  // ==================== ROW: TEAM vs OPPONENT ====================
  const vsY = 300
  const vsHeight = 100
  drawChevronBox(ctx, 40, vsY, W - 80, vsHeight, COL.blueBrand, COL.red)

  const cy = vsY + vsHeight / 2
  const homeLabel = data.venue === 'home' ? 'ASD LENCI POIRINO' : data.opponent.toUpperCase()
  const awayLabel = data.venue === 'home' ? data.opponent.toUpperCase() : 'ASD LENCI POIRINO'

  // Testo squadre: font auto-scaling per stare dentro il quadrante (fino a max 34px)
  ctx.fillStyle = COL.white
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const centerLeft = W * 0.28
  const centerRight = W * 0.72
  const maxTeamWidth = 400
  drawAutoSizedText(ctx, homeLabel, centerLeft, cy, maxTeamWidth, 34, 22, '"Anybody", "Arial Black", sans-serif', '900', COL.white)
  drawAutoSizedText(ctx, awayLabel, centerRight, cy, maxTeamWidth, 34, 22, '"Anybody", "Arial Black", sans-serif', '900', COL.white)

  // Badge VS al centro (losanga bianca con VS rosso)
  const vsCx = W / 2
  const vsCy = cy
  ctx.save()
  ctx.translate(vsCx, vsCy)
  ctx.rotate(Math.PI / 4)
  ctx.fillStyle = COL.white
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 12
  ctx.fillRect(-42, -42, 84, 84)
  ctx.restore()
  ctx.save()
  ctx.fillStyle = COL.red
  ctx.font = '900 44px "Anybody", "Arial Black", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('VS', vsCx, vsCy + 2)
  ctx.restore()

  // ==================== ROW: DATA | ORA | CAMPO ====================
  const infoY = 435
  const infoH = 135
  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  roundRect(ctx, 40, infoY, W - 80, infoH, 14)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.restore()

  // 3 colonne uguali centrate
  const colW = (W - 80) / 3
  drawInfoCol(ctx, 40 + colW * 0.5, infoY, infoH, 'calendar', 'DATA', formatDateIT(data.matchDate), null, colW - 20)

  // Colonna ORA: se ritrovo presente, mostra "Ritrovo 17:00" grande + "Gara 18:00" piccolo sotto
  const oraMain = data.meetingTime ? `Ritrovo ${data.meetingTime}` : (data.matchTime || '—')
  const oraSub = data.meetingTime ? `Gara ${data.matchTime || '—'}` : null
  drawInfoCol(ctx, 40 + colW * 1.5, infoY, infoH, 'clock', 'ORARI', oraMain, oraSub, colW - 20)

  // Colonna CAMPO: nome + indirizzo (se presente)
  const campoMain = data.location || (data.venue === 'home' ? 'IN CASA' : 'IN TRASFERTA')
  const campoSub = data.locationAddress || null
  drawInfoCol(ctx, 40 + colW * 2.5, infoY, infoH, 'pin', 'CAMPO', campoMain, campoSub, colW - 20)

  // Divider verticali tra colonne
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(40 + colW, infoY + 20)
  ctx.lineTo(40 + colW, infoY + infoH - 20)
  ctx.moveTo(40 + colW * 2, infoY + 20)
  ctx.lineTo(40 + colW * 2, infoY + infoH - 20)
  ctx.stroke()
  ctx.restore()

  // ==================== GRIGLIA GIOCATORI ====================
  const gridY = 600
  const gridH = H - gridY - 275  // -275 per lasciare spazio a dress-note + mister + slogan
  ctx.save()
  ctx.fillStyle = COL.white
  roundRect(ctx, 40, gridY, W - 80, gridH, 16)
  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 8
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = COL.red
  ctx.fillRect(40, gridY, 8, gridH)
  ctx.fillStyle = COL.blueBrand
  ctx.fillRect(W - 48, gridY, 8, gridH)

  const playersToShow = data.players.slice(0, 20)
  const perCol = Math.max(9, Math.ceil(playersToShow.length / 2))
  const colWidth = (W - 80 - 40) / 2
  const rowH = (gridH - 40) / perCol
  const padX = 30

  for (let i = 0; i < playersToShow.length; i++) {
    const p = playersToShow[i]
    const col = i < perCol ? 0 : 1
    const row = i - col * perCol
    const cx = 40 + padX + col * colWidth + 5
    const cy = gridY + 25 + row * rowH + rowH / 2
    const num = i + 1

    // Badge numero (chevron blu)
    ctx.save()
    ctx.fillStyle = COL.numberBadge
    ctx.beginPath()
    ctx.moveTo(cx, cy - 20)
    ctx.lineTo(cx + 50, cy - 20)
    ctx.lineTo(cx + 62, cy)
    ctx.lineTo(cx + 50, cy + 20)
    ctx.lineTo(cx, cy + 20)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = COL.white
    ctx.font = '900 24px "Anybody", "Arial Black", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(num), cx + 27, cy + 1)
    ctx.restore()

    // Linea sotto il nome
    const nameStartX = cx + 74
    const nameEndX = cx + colWidth - 25
    ctx.strokeStyle = '#c0c7d2'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(nameStartX, cy + 22)
    ctx.lineTo(nameEndX, cy + 22)
    ctx.stroke()

    // Nome giocatore - font auto-scaling
    const name = `${(p.lastName || '').toUpperCase()} ${p.firstName || ''}`.trim()
    const nameToDraw = p.isCaptain ? `(C) ${name}` : name
    const availWidth = nameEndX - nameStartX - 20  // -20 per riservare spazio al numero maglia
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    drawAutoSizedText(
      ctx, nameToDraw, nameStartX, cy + 3, availWidth, 24, 18,
      'system-ui, Arial, sans-serif', p.isCaptain ? '900' : '700', COL.slate,
      { alignLeft: true }
    )

    // Numero maglia (piccolo, a destra)
    if (p.number != null) {
      ctx.fillStyle = COL.red
      ctx.font = '900 18px "Anybody", Arial, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(`#${p.number}`, nameEndX, cy + 3)
    }
  }

  // ==================== DRESS NOTE (frase fissa) ====================
  if (data.dressNote) {
    const noteY = H - 230
    const noteH = 42
    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,0.10)'
    roundRect(ctx, 80, noteY, W - 160, noteH, 8)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()

    // Icona maglietta (simboletto) + testo
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = COL.white
    ctx.font = '700 17px system-ui, Arial, sans-serif'
    ctx.fillText(`👕  ${data.dressNote}`, W / 2, noteY + noteH / 2 + 1)
    ctx.restore()
  }

  // ==================== FOOTER: Mister ====================
  const mistY = H - 175
  const mistH = 60
  // Banda mister: bianca continua con doppio bordo (rosso a sx, blu a dx) per stile brand
  ctx.save()
  ctx.fillStyle = COL.white
  roundRect(ctx, 120, mistY, W - 240, mistH, 14)
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 3
  ctx.fill()
  ctx.restore()
  // Bordini colorati laterali
  ctx.fillStyle = COL.red
  roundRect(ctx, 120, mistY, 8, mistH, 4)
  ctx.fill()
  ctx.fillStyle = COL.blueBrand
  roundRect(ctx, W - 128, mistY, 8, mistH, 4)
  ctx.fill()

  // Icona persona (cerchio con "M")
  ctx.save()
  ctx.fillStyle = COL.blueBrand
  ctx.beginPath()
  ctx.arc(165, mistY + mistH / 2, 20, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = COL.white
  ctx.font = '900 22px "Anybody", Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('M', 165, mistY + mistH / 2 + 1)
  ctx.restore()

  // "Mister:" + nome centrato nell'area utile
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = COL.slate
  ctx.font = '800 22px system-ui, Arial, sans-serif'
  const misterLabel = 'Mister:'
  const misterLabelW = ctx.measureText(misterLabel).width
  const nameAvailW = (W - 128 - 15) - (200 + misterLabelW + 12)
  const coachName = (data.coachName || '—').toUpperCase()
  // Renderizza label + name
  ctx.fillText(misterLabel, 200, mistY + mistH / 2)
  drawAutoSizedText(
    ctx, coachName, 200 + misterLabelW + 12, mistY + mistH / 2,
    nameAvailW, 24, 16, '"Anybody", Arial, sans-serif', '900', COL.red,
    { alignLeft: true }
  )

  // ==================== SLOGAN FINALE ====================
  drawSlogan(ctx, W / 2, H - 100)

  // ==================== EXPORT ====================
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Errore generazione PNG'))),
      'image/png',
      0.95
    )
  })
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

function drawChevronBox(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  colorLeft: string, colorRight: string
) {
  const halfW = w / 2
  ctx.save()
  ctx.fillStyle = colorLeft
  ctx.beginPath()
  ctx.moveTo(x + 20, y)
  ctx.lineTo(x + halfW - 10, y)
  ctx.lineTo(x + halfW + 15, y + h / 2)
  ctx.lineTo(x + halfW - 10, y + h)
  ctx.lineTo(x + 20, y + h)
  ctx.lineTo(x, y + h / 2)
  ctx.closePath()
  ctx.shadowColor = 'rgba(0,0,0,0.4)'
  ctx.shadowBlur = 12
  ctx.shadowOffsetY = 4
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.fillStyle = colorRight
  ctx.beginPath()
  ctx.moveTo(x + halfW + 15, y + h / 2)
  ctx.lineTo(x + halfW + 10, y)
  ctx.lineTo(x + w - 20, y)
  ctx.lineTo(x + w, y + h / 2)
  ctx.lineTo(x + w - 20, y + h)
  ctx.lineTo(x + halfW + 10, y + h)
  ctx.closePath()
  ctx.shadowColor = 'rgba(0,0,0,0.4)'
  ctx.shadowBlur = 12
  ctx.shadowOffsetY = 4
  ctx.fill()
  ctx.restore()
}

/**
 * Colonna info: icona in alto-centro, label + valore (+ subvalue opzionale) centrati sotto.
 */
function drawInfoCol(
  ctx: CanvasRenderingContext2D,
  centerX: number, boxY: number, boxH: number,
  iconKind: 'calendar' | 'clock' | 'pin',
  label: string, value: string, subvalue: string | null,
  maxWidth: number
) {
  // Icona 28x28 in alto (Y=12..40)
  drawInlineIcon(ctx, iconKind, centerX - 14, boxY + 12, 28, 'rgba(255,255,255,0.9)')

  // Label piccolo (Y=58)
  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.65)'
  ctx.font = '700 12px system-ui, Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(label, centerX, boxY + 58)
  ctx.restore()

  // Valore principale auto-fit
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const valueY = subvalue ? boxY + 85 : boxY + 100
  drawAutoSizedText(
    ctx, value, centerX, valueY,
    maxWidth, subvalue ? 20 : 22, 13,
    'system-ui, Arial, sans-serif', '800', COL.white
  )

  // Subvalue (indirizzo campo o secondo orario)
  if (subvalue) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    drawAutoSizedText(
      ctx, subvalue, centerX, boxY + 112,
      maxWidth, 15, 11,
      'system-ui, Arial, sans-serif', '600', 'rgba(255,255,255,0.85)'
    )
  }

  void boxH
}

function measureLabelAndValue(_ctx: CanvasRenderingContext2D, _label: string, _value: string, _maxWidth: number) {
  return { labelHalf: 0 }
}
void measureLabelAndValue // riservato per usi futuri

/**
 * Icone vettoriali (calendar, clock, pin) disegnate su canvas.
 * x,y = angolo alto-sinistra del bounding box.
 */
function drawInlineIcon(
  ctx: CanvasRenderingContext2D,
  kind: 'calendar' | 'clock' | 'pin',
  x: number, y: number, size: number, color: string
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  const cx = x + size / 2
  const cy = y + size / 2
  const r = size / 2

  if (kind === 'calendar') {
    // Corpo
    ctx.beginPath()
    roundRectPath(ctx, x + 2, y + 5, size - 4, size - 7, 3)
    ctx.stroke()
    // 2 "gancetti" in cima
    ctx.beginPath()
    ctx.moveTo(x + 7, y); ctx.lineTo(x + 7, y + 8)
    ctx.moveTo(x + size - 7, y); ctx.lineTo(x + size - 7, y + 8)
    ctx.stroke()
    // Linea header
    ctx.beginPath()
    ctx.moveTo(x + 2, y + 10); ctx.lineTo(x + size - 2, y + 10)
    ctx.stroke()
    // Punto centrale (data)
    ctx.beginPath()
    ctx.arc(cx, cy + 3, 2.5, 0, Math.PI * 2)
    ctx.fill()
  } else if (kind === 'clock') {
    // Cerchio
    ctx.beginPath()
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2)
    ctx.stroke()
    // Lancette (12 + 3)
    ctx.beginPath()
    ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - r + 5)
    ctx.moveTo(cx, cy); ctx.lineTo(cx + r - 6, cy)
    ctx.stroke()
  } else if (kind === 'pin') {
    // Goccia
    ctx.beginPath()
    ctx.moveTo(cx, y + size)
    ctx.bezierCurveTo(cx - r, cy + r / 2, cx - r, cy - r, cx, y + 1)
    ctx.bezierCurveTo(cx + r, cy - r, cx + r, cy + r / 2, cx, y + size)
    ctx.closePath()
    ctx.stroke()
    // Pallino interno
    ctx.beginPath()
    ctx.arc(cx, cy - 1, 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath()
  roundRectPath(ctx, x, y, w, h, r)
}
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Auto-fit: prova font maxSize, se non entra scende fino a minSize; se ancora troppo grande, tronca con "…".
 */
function drawAutoSizedText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number,
  maxWidth: number, maxSize: number, minSize: number,
  fontFamily: string, weight: string, color: string,
  opts: { alignLeft?: boolean } = {}
) {
  let size = maxSize
  ctx.save()
  while (size >= minSize) {
    ctx.font = `${weight} ${size}px ${fontFamily}`
    if (ctx.measureText(text).width <= maxWidth) break
    size -= 1
  }
  let toDraw = text
  if (ctx.measureText(toDraw).width > maxWidth) {
    // Tronca con ellissi
    while (toDraw.length > 3 && ctx.measureText(toDraw + '…').width > maxWidth) {
      toDraw = toDraw.slice(0, -1)
    }
    toDraw += '…'
  }
  ctx.fillStyle = color
  if (!opts.alignLeft) {
    // già impostato dal caller ma per sicurezza
  }
  ctx.fillText(toDraw, x, y)
  ctx.restore()
}

/**
 * Slogan finale — composto in due colori affiancati con calcolo di larghezza.
 * «Casa non è un luogo, è una MAGLIA»
 */
function drawSlogan(ctx: CanvasRenderingContext2D, centerX: number, y: number) {
  const white = '«Casa non è un luogo, è una '
  const red = 'maglia'
  const closing = '»'

  ctx.save()
  const fWhite = 'italic 700 30px "Georgia", serif'
  const fRed = 'italic 900 36px "Georgia", serif'
  const fClose = 'italic 700 30px "Georgia", serif'

  ctx.font = fWhite
  const wWhite = ctx.measureText(white).width
  ctx.font = fRed
  const wRed = ctx.measureText(red).width
  ctx.font = fClose
  const wClose = ctx.measureText(closing).width

  const total = wWhite + wRed + wClose
  let cursorX = centerX - total / 2

  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 6

  ctx.font = fWhite
  ctx.fillStyle = COL.white
  ctx.fillText(white, cursorX, y)
  cursorX += wWhite

  ctx.font = fRed
  ctx.fillStyle = COL.red
  ctx.fillText(red, cursorX, y - 2)  // -2 per compensare font più grande e allinearsi visivamente
  cursorX += wRed

  ctx.font = fClose
  ctx.fillStyle = COL.white
  ctx.fillText(closing, cursorX, y)

  ctx.restore()
}

function formatDateIT(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ============================================================
// DOWNLOAD / SHARE
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
    } catch {
      // fallback
    }
  }
  downloadBlob(blob, filename)
}
