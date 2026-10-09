/**
 * Parser PDF tabulato FIGC "Settore Giovanile" / "Dilettanti" / etc.
 *
 * Formato riscontrato (print_26.pdf, 2026/2027, A.S.D. LENCI POIRINO, 142 giocatori):
 *   RIGA PRIMARIA : MATR(7cifre) COGNOME NOME DISCIPLINA GG/MM/AAAA GG/MM/AAAA AAAA
 *   RIGA SECONDARIA: CF(16 char) CODICE_TIPO(1-3 cifre) DESCRIZIONE_TIPO
 *
 * Metadati pagina:
 *   - "Stagione Sportiva 2026/2027"  → season
 *   - "Tabulato calciatori della società: 941840 A.S.D. ..." → figc_club_id
 *   - "09/10/2026 09:13" angolo in alto a destra → document_timestamp
 *
 * MODULO PURO: non chiama DB, non ha side effect. Prende un File/ArrayBuffer,
 * torna una FigcDocument con warning e warning per riga.
 */

export interface FigcPlayerRow {
  figc_player_id: string         // matricola
  full_name_raw: string           // "ROSSI MARIO"
  first_name: string | null       // best-effort split
  last_name: string | null        // best-effort split
  birth_date: string | null       // ISO YYYY-MM-DD
  tax_code: string | null         // 16 char uppercase
  discipline: string | null       // "Calcio a 11", "Attività SGS", ...
  registered_at: string | null    // ISO YYYY-MM-DD
  expiry_year: number | null
  registration_type_code: string | null   // "66", "67", "68"
  registration_type_label: string | null  // "Settore Giovanile Italiano Formato T"
  source_page: number
  raw_primary: string
  raw_secondary: string
  parse_warnings: string[]
}

export interface FigcDocument {
  parser_version: string
  figc_club_id: string | null
  figc_club_name: string | null
  season: string | null
  document_timestamp: string | null  // ISO datetime
  players: FigcPlayerRow[]
  warnings: string[]
  stats: {
    pages: number
    primary_lines: number
    secondary_lines: number
    paired: number
    unpaired_primary: number
    unpaired_secondary: number
  }
}

const PARSER_VERSION = 'v1.0.0'

// Regex riga primaria: inizio con 7 cifre matricola
// Esempio: "4922001            AKOWUAH MICHEL                                      Calcio a 11    16/12/2015 06/09/2026 2027"
const RE_PRIMARY = /^(\d{7})\s+(.+?)\s{2,}(Calcio a (?:11|7|5)|Attività SGS|Giovanissimi|Allievi|Juniores|Esordienti|Pulcini|Primi Calci|[A-Z][a-zà-ú]+(?: [A-Z][a-zà-ú]+)*)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{4})\s*$/

// Regex riga secondaria: 16 char CF + spazi + codice + spazi + descrizione
// Esempio: "KWHMHL15T16A124X   66 Settore Giovanile Italiano Formato T"
const RE_SECONDARY = /^([A-Z0-9]{16})\s+(\d{1,3})\s+(.+?)\s*$/

// Metadati
const RE_SEASON = /Stagione Sportiva\s+(\d{4}\/\d{4})/i
const RE_CLUB_HEADER = /Tabulato calciatori della società:\s*(\d+)\s+(.+?)$/i
const RE_DOC_TIMESTAMP = /^\s*(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})\s*$/

/**
 * Normalizza una data in formato DD/MM/YYYY → ISO YYYY-MM-DD.
 * Torna null se non valida.
 */
function parseItalianDate(s: string): string | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const [, dd, mm, yyyy] = m
  const d = Number(dd), mo = Number(mm), y = Number(yyyy)
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null
  // Validazione date reale (es. 31/02 → invalid)
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Split best-effort del nome "COGNOME NOME [NOMI MULTIPLI]".
 * Senza elenco cognomi italiani non c'è certezza; convenzione tabulato FIGC:
 * di solito la PRIMA parola è il cognome, il resto sono nomi. Per cognomi composti
 * (es. "DE LUCA MARIO") questa logica fallisce → segnalato con warning.
 * Ritorna {first, last, warnings}.
 */
function splitFullName(full: string): { first_name: string | null; last_name: string | null; warnings: string[] } {
  const warnings: string[] = []
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return { first_name: null, last_name: null, warnings: ['nome vuoto'] }
  }
  if (parts.length === 1) {
    warnings.push('nome con un solo token: assumo sia il cognome')
    return { first_name: null, last_name: parts[0], warnings }
  }
  // Default: primo = cognome, resto = nome
  // Edge case: particelle italiane note (DE, DEL, DI, LA, LO, DA, VAN, VON) → attach a cognome
  const PARTICLES = new Set(['DE', 'DEL', 'DI', 'LA', 'LO', 'DA', 'VAN', 'VON', 'DELLA', 'DELLO', 'DELLE'])
  let lastEnd = 1
  while (lastEnd < parts.length && PARTICLES.has(parts[lastEnd - 1].toUpperCase())) {
    lastEnd++
  }
  if (parts.length - lastEnd === 0) {
    warnings.push('possibile cognome composto, nome mancante')
  }
  const last = parts.slice(0, lastEnd).join(' ')
  const first = parts.slice(lastEnd).join(' ') || null
  if (parts.length > 2 && lastEnd === 1) {
    warnings.push('più di 2 token: assumo primo=cognome, altri=nome (verificare per nomi/cognomi composti)')
  }
  return { first_name: first, last_name: last, warnings }
}

/**
 * Estrae il testo pagina per pagina da un ArrayBuffer PDF usando pdfjs-dist.
 * Ricostruisce le righe raggruppando text items per coordinata Y (riga logica).
 */
async function extractPageLines(pdfData: ArrayBuffer): Promise<string[][]> {
  const pdfjsLib = await import('pdfjs-dist')
  // Il worker viene configurato dal chiamante tramite setWorkerSrc; se non lo è,
  // usiamo l'URL del worker nativo che Vite risolve a build time.
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
  }

  const loadingTask = pdfjsLib.getDocument({ data: pdfData })
  const doc = await loadingTask.promise
  const pages: string[][] = []

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    // Raggruppa text items per riga (Y coordinate con tolleranza 1pt)
    type Item = { x: number; y: number; text: string }
    const items: Item[] = []
    for (const it of content.items as Array<{ str: string; transform: number[] }>) {
      if (!it.str) continue
      const x = it.transform[4]
      const y = it.transform[5]
      items.push({ x, y, text: it.str })
    }
    // Group by Y (round)
    const rows = new Map<number, Item[]>()
    for (const it of items) {
      const yKey = Math.round(it.y)
      if (!rows.has(yKey)) rows.set(yKey, [])
      rows.get(yKey)!.push(it)
    }
    // Sort Y descending (PDF has origin bottom-left), then X ascending in each row
    const sortedYs = [...rows.keys()].sort((a, b) => b - a)
    const pageLines: string[] = []
    for (const y of sortedYs) {
      const row = rows.get(y)!.sort((a, b) => a.x - b.x)
      // Join items con spazio quando il gap X è > 1 unit (approssimazione char width)
      let line = ''
      let prevEndX: number | null = null
      for (const it of row) {
        if (prevEndX !== null && it.x - prevEndX > 2) {
          // Multiple spaces per preservare "layout" per regex (es. doppio spazio)
          const gap = Math.min(20, Math.round((it.x - prevEndX) / 3))
          line += ' '.repeat(Math.max(1, gap))
        }
        line += it.text
        prevEndX = it.x + (it.text.length * 5) // stima molto rough della larghezza
      }
      pageLines.push(line)
    }
    pages.push(pageLines)
  }

  await doc.destroy()
  return pages
}

export async function parseFigcPdf(pdfBytes: ArrayBuffer): Promise<FigcDocument> {
  const warnings: string[] = []
  const players: FigcPlayerRow[] = []

  let season: string | null = null
  let figc_club_id: string | null = null
  let figc_club_name: string | null = null
  let document_timestamp: string | null = null

  let pages: string[][]
  try {
    pages = await extractPageLines(pdfBytes)
  } catch (e: any) {
    throw new Error(`Estrazione PDF fallita: ${e?.message || String(e)}`)
  }

  if (pages.length === 0) {
    throw new Error('PDF vuoto o non processabile.')
  }

  // Metadati: cerca in tutte le pagine, prima occorrenza vince
  for (const page of pages) {
    for (const line of page) {
      if (!season) {
        const m = line.match(RE_SEASON)
        if (m) season = m[1]
      }
      if (!figc_club_id) {
        const m = line.match(RE_CLUB_HEADER)
        if (m) {
          figc_club_id = m[1]
          figc_club_name = m[2].trim()
        }
      }
      if (!document_timestamp) {
        const m = line.match(RE_DOC_TIMESTAMP)
        if (m) {
          const iso = parseItalianDate(m[1])
          if (iso) document_timestamp = `${iso}T${m[2]}:00`
        }
      }
    }
  }

  let primaryCount = 0
  let secondaryCount = 0
  let paired = 0
  let unpairedPrimary = 0
  let unpairedSecondary = 0

  // Parsing a stato: cerco riga primaria, quando trovo mi aspetto la secondaria dopo.
  let rowIndex = 0
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p]
    let pendingPrimary: {
      figc_player_id: string
      full_name_raw: string
      discipline: string
      registered_at: string | null
      expiry_year: number | null
      birth_date: string | null
      raw_primary: string
      warnings: string[]
    } | null = null

    for (const line of page) {
      const primary = line.match(RE_PRIMARY)
      if (primary) {
        primaryCount++
        if (pendingPrimary) {
          // La precedente primaria non ha trovato la secondaria → errore
          unpairedPrimary++
          const nameSplit = splitFullName(pendingPrimary.full_name_raw)
          players.push({
            figc_player_id: pendingPrimary.figc_player_id,
            full_name_raw: pendingPrimary.full_name_raw,
            first_name: nameSplit.first_name,
            last_name: nameSplit.last_name,
            birth_date: pendingPrimary.birth_date,
            tax_code: null,
            discipline: pendingPrimary.discipline,
            registered_at: pendingPrimary.registered_at,
            expiry_year: pendingPrimary.expiry_year,
            registration_type_code: null,
            registration_type_label: null,
            source_page: p + 1,
            raw_primary: pendingPrimary.raw_primary,
            raw_secondary: '',
            parse_warnings: [...pendingPrimary.warnings, ...nameSplit.warnings, 'riga secondaria (CF/tipologia) mancante'],
          })
          rowIndex++
        }
        const [, matr, name, disc, nato, tess, scad] = primary
        const birth = parseItalianDate(nato)
        const reg = parseItalianDate(tess)
        const warns: string[] = []
        if (!birth) warns.push(`data nascita non valida: ${nato}`)
        if (!reg) warns.push(`data tesseramento non valida: ${tess}`)
        pendingPrimary = {
          figc_player_id: matr,
          full_name_raw: name.trim(),
          discipline: disc.trim(),
          registered_at: reg,
          expiry_year: Number(scad) || null,
          birth_date: birth,
          raw_primary: line,
          warnings: warns,
        }
        continue
      }

      const secondary = line.match(RE_SECONDARY)
      if (secondary && pendingPrimary) {
        secondaryCount++
        const [, cf, code, label] = secondary
        const nameSplit = splitFullName(pendingPrimary.full_name_raw)
        const warns = [...pendingPrimary.warnings, ...nameSplit.warnings]
        // Validazione CF (sintassi codice fiscale italiano)
        if (!/^[A-Z]{6}\d{2}[A-EHLMPRST]\d{2}[A-Z]\d{3}[A-Z]$/.test(cf)) {
          warns.push(`CF con sintassi irregolare: ${cf}`)
        }
        players.push({
          figc_player_id: pendingPrimary.figc_player_id,
          full_name_raw: pendingPrimary.full_name_raw,
          first_name: nameSplit.first_name,
          last_name: nameSplit.last_name,
          birth_date: pendingPrimary.birth_date,
          tax_code: cf,
          discipline: pendingPrimary.discipline,
          registered_at: pendingPrimary.registered_at,
          expiry_year: pendingPrimary.expiry_year,
          registration_type_code: code,
          registration_type_label: label.trim(),
          source_page: p + 1,
          raw_primary: pendingPrimary.raw_primary,
          raw_secondary: line,
          parse_warnings: warns,
        })
        paired++
        rowIndex++
        pendingPrimary = null
        continue
      }

      if (secondary && !pendingPrimary) {
        // Secondaria orfana
        unpairedSecondary++
        warnings.push(`Riga secondaria orfana (pag. ${p + 1}): "${line.slice(0, 60)}"`)
      }
    }

    // Fine pagina con primaria pendente → se la secondaria è nella pagina successiva?
    // Nel tabulato FIGC le due righe stanno sempre nella stessa pagina. Se splittato,
    // segnaliamo e lasciamo pending per il wrap. Per sicurezza, se pending resta a
    // fine documento, lo flushiamo nel loop successivo o alla fine.
    if (pendingPrimary && p === pages.length - 1) {
      unpairedPrimary++
      const nameSplit = splitFullName(pendingPrimary.full_name_raw)
      players.push({
        figc_player_id: pendingPrimary.figc_player_id,
        full_name_raw: pendingPrimary.full_name_raw,
        first_name: nameSplit.first_name,
        last_name: nameSplit.last_name,
        birth_date: pendingPrimary.birth_date,
        tax_code: null,
        discipline: pendingPrimary.discipline,
        registered_at: pendingPrimary.registered_at,
        expiry_year: pendingPrimary.expiry_year,
        registration_type_code: null,
        registration_type_label: null,
        source_page: p + 1,
        raw_primary: pendingPrimary.raw_primary,
        raw_secondary: '',
        parse_warnings: [...pendingPrimary.warnings, ...nameSplit.warnings, 'riga secondaria mancante a fine documento'],
      })
      rowIndex++
    }
  }

  // Deduplica per matricola (il PDF non dovrebbe averle, ma controlliamo)
  const seen = new Map<string, number>()
  for (const p of players) {
    seen.set(p.figc_player_id, (seen.get(p.figc_player_id) ?? 0) + 1)
  }
  for (const [matr, n] of seen) {
    if (n > 1) warnings.push(`Matricola ${matr} compare ${n} volte nel PDF`)
  }

  return {
    parser_version: PARSER_VERSION,
    figc_club_id,
    figc_club_name,
    season,
    document_timestamp,
    players,
    warnings,
    stats: {
      pages: pages.length,
      primary_lines: primaryCount,
      secondary_lines: secondaryCount,
      paired,
      unpaired_primary: unpairedPrimary,
      unpaired_secondary: unpairedSecondary,
    },
  }
}
