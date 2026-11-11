// v1.9.172: generatore PDF ricevute pagamento quote
// Produce una ricevuta formato A4 in portrait, intestata con i dati
// della ASD (presi da club_settings) e contenente: numero + anno,
// data, importo, metodo pagamento, causale, dati del giocatore.
// Una ricevuta per acconto, una per saldo (separate, come deciso con Davide).

import { jsPDF } from 'jspdf'

export interface ClubSettings {
  denominazione: string | null
  codice_fiscale: string | null
  partita_iva: string | null
  sede_via: string | null
  sede_cap: string | null
  sede_citta: string | null
  sede_provincia: string | null
  iban: string | null
  firmatario_nome: string | null
  firmatario_ruolo: string | null
  logo_data_uri: string | null
}

export interface ReceiptData {
  tipo: 'acconto' | 'saldo'
  numero: string          // es. "0042/2026"
  data: string            // YYYY-MM-DD
  importo: number
  metodo: string          // Contanti / Bonifico / POS / Assegno / Carta / Altro
  giocatoreNome: string
  giocatoreCognome: string
  giocatoreCF?: string | null
  squadra: string         // es. "Under 14"
  stagione: string        // es. "2026/2027"
  settings: ClubSettings
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
function fmtEuro(n: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
}

export function generateReceiptPDF(opts: ReceiptData): jsPDF {
  const { settings: s } = opts
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  const pageW = 210
  const marginX = 20
  let y = 20

  // ─── LOGO (opzionale) ───
  if (s.logo_data_uri && s.logo_data_uri.startsWith('data:image/')) {
    try {
      doc.addImage(s.logo_data_uri, 'PNG', marginX, y, 22, 22)
    } catch { /* immagine non valida, salto */ }
  }

  // ─── INTESTAZIONE ASD ───
  const headX = marginX + 28
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
  doc.text(s.denominazione || 'ASD Lenci O.N.L.U.S. Poirino', headX, y + 6)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90)
  const headLines: string[] = []
  const indir = [s.sede_via, [s.sede_cap, s.sede_citta].filter(Boolean).join(' '), s.sede_provincia ? `(${s.sede_provincia})` : '']
    .filter(Boolean).join(' · ')
  if (indir) headLines.push(indir)
  const fiscali = [s.codice_fiscale ? `C.F. ${s.codice_fiscale}` : '', s.partita_iva ? `P.IVA ${s.partita_iva}` : '']
    .filter(Boolean).join(' · ')
  if (fiscali) headLines.push(fiscali)
  headLines.forEach((t, i) => doc.text(t, headX, y + 12 + i * 4.5))
  doc.setTextColor(0)

  y += 30
  doc.setDrawColor(200); doc.setLineWidth(0.4)
  doc.line(marginX, y, pageW - marginX, y)
  y += 10

  // ─── TITOLO RICEVUTA ───
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(0, 95, 152)
  doc.text(`RICEVUTA N. ${opts.numero}`, pageW / 2, y, { align: 'center' })
  y += 7
  doc.setFontSize(10); doc.setTextColor(90); doc.setFont('helvetica', 'normal')
  doc.text(`Emessa il ${fmtDate(opts.data)} · Stagione sportiva ${opts.stagione}`, pageW / 2, y, { align: 'center' })
  y += 12
  doc.setTextColor(0)

  // ─── CORPO RICEVUTA ───
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11)
  doc.text('Ricevuto dal/dalla Sig./ra:', marginX, y); y += 6
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
  doc.text(`${opts.giocatoreCognome.toUpperCase()} ${opts.giocatoreNome}`, marginX, y)
  y += 6
  if (opts.giocatoreCF) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90)
    doc.text(`C.F. tesserato: ${opts.giocatoreCF}`, marginX, y); doc.setTextColor(0); y += 6
  }

  y += 2
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11)
  doc.text('la somma di:', marginX, y); y += 8

  // Importo box
  doc.setFillColor(240, 247, 255); doc.setDrawColor(0, 95, 152); doc.setLineWidth(0.6)
  doc.roundedRect(marginX, y - 6, pageW - 2 * marginX, 16, 3, 3, 'FD')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(0, 95, 152)
  doc.text(fmtEuro(opts.importo), pageW / 2, y + 4, { align: 'center' })
  y += 18
  doc.setTextColor(0)

  // Causale + metodo
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11)
  const causaleLabel = opts.tipo === 'acconto' ? 'acconto / iscrizione' : 'saldo quota annuale'
  doc.text('a titolo di:', marginX, y); y += 6
  doc.setFont('helvetica', 'bold')
  doc.text(`Quota associativa ${causaleLabel} — settore ${opts.squadra}`, marginX, y); y += 6
  doc.setFont('helvetica', 'normal')
  doc.text(`Stagione sportiva ${opts.stagione}.`, marginX, y); y += 10

  doc.text('Modalità di pagamento:', marginX, y)
  doc.setFont('helvetica', 'bold'); doc.text(opts.metodo, marginX + 50, y); y += 10
  doc.setFont('helvetica', 'normal')

  if (s.iban && (opts.metodo.toLowerCase().includes('bonific'))) {
    doc.setFontSize(9); doc.setTextColor(90)
    doc.text(`Accreditato su: ${s.iban}`, marginX, y); y += 6
    doc.setFontSize(11); doc.setTextColor(0)
  }

  y += 6
  doc.setFontSize(9); doc.setTextColor(90)
  doc.text(
    'La presente quota associativa, versata in favore di associazione sportiva dilettantistica senza scopo di lucro, '
    + 'non è soggetta a IVA ex art. 4 DPR 633/72 e beneficia delle disposizioni di cui al D.Lgs. 36/2021. '
    + 'Documento valido ai soli fini interni dell\'associazione.',
    marginX, y, { maxWidth: pageW - 2 * marginX, align: 'justify' }
  )
  doc.setTextColor(0)

  // ─── FIRMA ───
  const firmaY = 255
  doc.setFontSize(10); doc.setFont('helvetica', 'normal')
  doc.text(`Poirino, ${fmtDate(opts.data)}`, marginX, firmaY)

  doc.setDrawColor(100); doc.setLineWidth(0.3)
  doc.line(pageW - marginX - 70, firmaY + 10, pageW - marginX, firmaY + 10)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  if (s.firmatario_nome) doc.text(s.firmatario_nome, pageW - marginX - 35, firmaY + 15, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90)
  doc.text(s.firmatario_ruolo || 'Il Presidente', pageW - marginX - 35, firmaY + 20, { align: 'center' })
  doc.text('firma e timbro', pageW - marginX - 35, firmaY + 24, { align: 'center' })
  doc.setTextColor(0)

  // ─── FOOTER ───
  doc.setFontSize(7.5); doc.setTextColor(140); doc.setFont('helvetica', 'italic')
  doc.text(
    'Generato automaticamente da Lenci LAB · ' + new Date().toLocaleString('it-IT'),
    pageW / 2, 287, { align: 'center' }
  )

  return doc
}

export function downloadReceipt(opts: ReceiptData) {
  const doc = generateReceiptPDF(opts)
  const safe = (s: string) => s.replace(/[^A-Za-z0-9]/g, '_')
  const fname = `Ricevuta_${opts.numero.replace('/', '_')}_${safe(opts.giocatoreCognome)}_${opts.tipo}.pdf`
  doc.save(fname)
}
