import jsPDF from 'jspdf'

export interface DistintaMatch {
  opponent: string
  match_date: string
  venue: 'home' | 'away'
  competition: string | null
  location: string | null
  location_address: string | null
  kickoff_field: string | null
  shirt_color_home: string | null
  shirt_color_gk: string | null
}

export interface DistintaTeam {
  name: string
  category: string | null
  club_name: string
}

export interface DistintaPlayer {
  shirt_number: number | null
  last_name: string
  first_name: string
  birth_date: string | null
  card_number: string | null
  fiscal_code: string | null
  position: string | null
  is_captain: boolean
  is_goalkeeper: boolean
}

export interface DistintaStaff {
  full_name: string
  role: string
  card_number?: string | null
}

export interface DistintaData {
  match: DistintaMatch
  team: DistintaTeam
  players: DistintaPlayer[]
  staff: DistintaStaff[]
  notes?: string | null
}

const NAVY = '#003c5e'
const GRAY = '#404751'
const GRAY_LT = '#707882'
const BORDER = '#c0c7d2'

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}
function fmtDateShort(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export async function generateDistintaPdf(data: DistintaData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true, precision: 2 })
  const pageW = 210
  const marginX = 12
  const contentW = pageW - marginX * 2

  // Carico logo Lenci (best effort, se fallisce continuiamo senza)
  const logoDataUrl = await loadLogoAsDataUrl('/lenci-logo-ufficiale.jpg').catch(() => null)

  // ==== HEADER FIGC ====
  doc.setFillColor(NAVY)
  doc.rect(0, 0, pageW, 22, 'F')

  // Logo Lenci in alto a sinistra (dentro l'header navy).
  // Il PNG è già mascherato circolarmente in caricamento, quindi non serve
  // nessun cerchio bianco di supporto sotto.
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', 3, 3, 16, 16, undefined, 'FAST')
    } catch {
      // Ignoro problemi runtime del PDF sull'immagine
    }
  }

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('F.I.G.C. – FEDERAZIONE ITALIANA GIUOCO CALCIO', pageW / 2, 8, { align: 'center' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Lega Nazionale Dilettanti – Settore Giovanile e Scolastico', pageW / 2, 13, { align: 'center' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('DISTINTA UFFICIALE DI GARA', pageW / 2, 18.5, { align: 'center' })

  // ==== INFO GARA ====
  let y = 28
  doc.setDrawColor(BORDER)
  doc.setLineWidth(0.2)

  const boxH = 8

  drawInfoRow(doc, marginX, y, contentW, [
    { label: 'CATEGORIA', value: data.team.category || '—', width: 40 },
    { label: 'COMPETIZIONE', value: data.match.competition || 'Amichevole', width: contentW - 40 },
  ], boxH)
  y += boxH

  drawInfoRow(doc, marginX, y, contentW, [
    { label: 'DATA', value: fmtDate(data.match.match_date), width: 40 },
    { label: 'ORA', value: fmtTime(data.match.match_date), width: 25 },
    { label: 'CAMPO', value: [data.match.kickoff_field || data.match.location, data.match.location_address].filter(Boolean).join(' – ') || '—', width: contentW - 65 },
  ], boxH)
  y += boxH

  const homeName = data.match.venue === 'home' ? data.team.club_name : data.match.opponent
  const awayName = data.match.venue === 'home' ? data.match.opponent : data.team.club_name
  drawInfoRow(doc, marginX, y, contentW, [
    { label: 'SQUADRA OSPITANTE', value: homeName, width: contentW / 2 },
    { label: 'SQUADRA OSPITE',    value: awayName, width: contentW / 2 },
  ], boxH)
  y += boxH

  drawInfoRow(doc, marginX, y, contentW, [
    { label: 'COLORI MAGLIE GIOCATORI', value: data.match.shirt_color_home || '—', width: contentW / 2 },
    { label: 'COLORI MAGLIA PORTIERE',  value: data.match.shirt_color_gk   || '—', width: contentW / 2 },
  ], boxH)
  y += boxH + 4

  // ==== TITOLO SEZIONE GIOCATORI ====
  doc.setFillColor(NAVY)
  doc.rect(marginX, y, contentW, 6, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(`ELENCO CALCIATORI CONVOCATI (${data.players.length})`, marginX + 2, y + 4.2)
  doc.text(data.team.club_name.toUpperCase(), pageW - marginX - 2, y + 4.2, { align: 'right' })
  y += 6

  // ==== TABELLA GIOCATORI ====
  // Colonne: # progressivo, MAGLIA, COGNOME E NOME, DATA NASCITA, MATRICOLA FIGC, DOCUMENTO
  const cols = [
    { key: 'idx',   label: 'N.',              w: 10, align: 'center' as const },
    { key: 'shirt', label: 'MAGLIA',          w: 16, align: 'center' as const },
    { key: 'name',  label: 'COGNOME E NOME',  w: 72, align: 'left'   as const },
    { key: 'birth', label: 'DATA NASCITA',    w: 26, align: 'center' as const },
    { key: 'card',  label: 'MATRICOLA FIGC',  w: 30, align: 'center' as const },
    { key: 'doc',   label: 'DOCUMENTO',       w: contentW - (10 + 16 + 72 + 26 + 30), align: 'center' as const },
  ]
  const rowH = 6.8
  const headH = 5.5

  // Header tabella
  doc.setFillColor(230, 232, 238)
  doc.rect(marginX, y, contentW, headH, 'F')
  doc.setDrawColor(BORDER)
  doc.rect(marginX, y, contentW, headH)
  doc.setTextColor(GRAY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  let cx = marginX
  for (const c of cols) {
    doc.text(c.label, cx + c.w / 2, y + 3.8, { align: 'center' })
    doc.line(cx, y, cx, y + headH)
    cx += c.w
  }
  y += headH

  // Righe giocatori
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(24, 28, 32)
  for (let i = 0; i < data.players.length; i++) {
    const p = data.players[i]
    if (i % 2 === 0) {
      doc.setFillColor(250, 251, 253)
      doc.rect(marginX, y, contentW, rowH, 'F')
    }
    doc.setDrawColor(BORDER)
    doc.rect(marginX, y, contentW, rowH)

    let x = marginX
    for (const c of cols) {
      doc.line(x, y, x, y + rowH)
      let val = ''
      switch (c.key) {
        case 'idx':   val = String(i + 1); break
        case 'shirt': val = p.shirt_number != null ? String(p.shirt_number) : ''; break
        case 'name':
          // Prefisso solo per capitano e portiere
          val = `${p.last_name.toUpperCase()} ${p.first_name}`
          if (p.is_captain) val = val + '  (C)'
          if (p.is_goalkeeper) val = 'P  ' + val
          break
        case 'birth': val = fmtDateShort(p.birth_date); break
        case 'card':  val = p.card_number || '—'; break
        case 'doc':   val = p.fiscal_code || '—'; break
      }
      const textX = c.align === 'center' ? x + c.w / 2 : x + 2
      const align = c.align === 'center' ? 'center' : 'left'
      if (c.key === 'name' && p.is_captain) doc.setFont('helvetica', 'bold')
      else doc.setFont('helvetica', 'normal')
      doc.text(val, textX, y + rowH / 2 + 1.6, { align })
      x += c.w
    }
    y += rowH
  }

  // Righe vuote — min 2 di padding, mai più di 18 totali (partite giovanili)
  const targetRows = Math.min(18, Math.max(data.players.length + 2, 14))
  const emptyRows = Math.max(0, targetRows - data.players.length)
  for (let i = 0; i < emptyRows; i++) {
    doc.setDrawColor(BORDER)
    doc.rect(marginX, y, contentW, rowH)
    let x = marginX
    for (const c of cols) {
      doc.line(x, y, x, y + rowH)
      x += c.w
    }
    y += rowH
  }

  // Legenda
  y += 3
  doc.setFontSize(7)
  doc.setTextColor(GRAY_LT)
  doc.setFont('helvetica', 'italic')
  doc.text('P = Portiere    |    (C) = Capitano', marginX, y)
  y += 6

  // ==== SEZIONE STAFF ====
  doc.setFillColor(NAVY)
  doc.rect(marginX, y, contentW, 6, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('DIRIGENTI E STAFF TECNICO', marginX + 2, y + 4.2)
  y += 6

  const staffCols = [
    { key: 'role', label: 'RUOLO',           w: 60 },
    { key: 'name', label: 'COGNOME E NOME',  w: 90 },
    { key: 'card', label: 'MATRICOLA FIGC',  w: contentW - 60 - 90 },
  ]
  doc.setFillColor(230, 232, 238)
  doc.rect(marginX, y, contentW, headH, 'F')
  doc.setDrawColor(BORDER)
  doc.rect(marginX, y, contentW, headH)
  doc.setTextColor(GRAY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  let sx = marginX
  for (const c of staffCols) {
    doc.text(c.label, sx + c.w / 2, y + 3.8, { align: 'center' })
    doc.line(sx, y, sx, y + headH)
    sx += c.w
  }
  y += headH

  // Solo righe reali + 1 vuota di padding
  const staffRows = data.staff.length + 1
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(24, 28, 32)
  for (let i = 0; i < staffRows; i++) {
    const s = data.staff[i]
    if (i % 2 === 0) {
      doc.setFillColor(250, 251, 253)
      doc.rect(marginX, y, contentW, rowH, 'F')
    }
    doc.setDrawColor(BORDER)
    doc.rect(marginX, y, contentW, rowH)
    let x = marginX
    for (const c of staffCols) {
      doc.line(x, y, x, y + rowH)
      let val = ''
      if (s) {
        if (c.key === 'role') val = s.role
        else if (c.key === 'name') val = s.full_name
        else if (c.key === 'card') val = s.card_number || '—'
      }
      doc.text(val, x + 2, y + rowH / 2 + 1.6)
      x += c.w
    }
    y += rowH
  }

  // ==== FIRME ====
  y += 10
  const sigW = (contentW - 6) / 2
  drawSignatureBox(doc, marginX, y, sigW, 'Firma Dirigente Accompagnatore')
  drawSignatureBox(doc, marginX + sigW + 6, y, sigW, 'Firma Arbitro')

  // ==== FOOTER ====
  doc.setFontSize(7)
  doc.setTextColor(GRAY_LT)
  doc.setFont('helvetica', 'italic')
  doc.text(
    `Documento generato il ${new Date().toLocaleString('it-IT')} · ASD Lenci Poirino · App gestionale`,
    pageW / 2, 290, { align: 'center' }
  )

  return doc
}

function drawInfoRow(doc: jsPDF, x: number, y: number, totalW: number, cells: Array<{ label: string; value: string; width: number }>, height: number) {
  doc.setDrawColor(BORDER)
  doc.rect(x, y, totalW, height)
  let cx = x
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]
    if (i > 0) doc.line(cx, y, cx, y + height)
    doc.setTextColor(GRAY_LT)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.text(cell.label, cx + 2, y + 3)
    doc.setTextColor(24, 28, 32)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.text(cell.value, cx + 2, y + 6.5)
    cx += cell.width
  }
}

function drawSignatureBox(doc: jsPDF, x: number, y: number, w: number, label: string) {
  const h = 26
  doc.setDrawColor(BORDER)
  doc.rect(x, y, w, h)
  doc.setFontSize(7.5)
  doc.setTextColor(GRAY_LT)
  doc.setFont('helvetica', 'bold')
  doc.text(label.toUpperCase(), x + w / 2, y + 4, { align: 'center' })
  doc.setDrawColor('#999999')
  doc.setLineWidth(0.3)
  doc.line(x + 6, y + h - 4, x + w - 6, y + h - 4)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(GRAY_LT)
  doc.text('firma leggibile', x + w / 2, y + h - 1.5, { align: 'center' })
}

// Cache per non riscaricare il logo ad ogni PDF nella stessa sessione
let LOGO_CACHE: string | null = null

/**
 * Carica il logo Lenci, applica una maschera circolare (elimina gli angoli
 * bianchi del JPG originale) e lo converte in PNG data URL trasparente.
 * Il risultato è cachato in memoria.
 */
async function loadLogoAsDataUrl(path: string): Promise<string> {
  if (LOGO_CACHE) return LOGO_CACHE

  // Carico l'immagine come HTMLImageElement
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.crossOrigin = 'anonymous'
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error(`Logo non trovato: ${path}`))
    el.src = path
  })

  // Applico maschera circolare via canvas
  // Uso una risoluzione target ragionevole: il logo appare a 16mm nel PDF,
  // a 300dpi bastano ~190px. Uso 256 per un buon margine senza sprecare byte.
  // (Prima usavo la risoluzione nativa del jpg = spesso 512+ px = 4x più byte)
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D non disponibile per maschera logo')

  // Clip circolare
  ctx.save()
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  // Disegno il logo scalato per riempire il canvas mantenendo aspect ratio
  const nw = img.naturalWidth || 1
  const nh = img.naturalHeight || 1
  const scale = Math.max(size / nw, size / nh)
  const dw = nw * scale
  const dh = nh * scale
  ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh)
  ctx.restore()

  // Esporto come PNG (mantiene la trasparenza fuori dal cerchio)
  const dataUrl = canvas.toDataURL('image/png')
  LOGO_CACHE = dataUrl
  return dataUrl
}
