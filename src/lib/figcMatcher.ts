/**
 * Matcher deterministico FIGC → anagrafica interna players.
 *
 * Ordine di identificazione (spec sez. 4.2):
 *   1. card_number (matricola FIGC già memorizzata), se univoco e coerente
 *   2. fiscal_code (CF), se valido/univoco/coerente
 *   3. cognome+nome+data_nascita, normalizzati, se univoco
 *
 * Regole di sicurezza:
 *   - MAI aggiornare automaticamente CF, matricola, nome/cognome, data nascita
 *     se difformi dal valore già registrato → CONFLICT
 *   - MAI matchare con più candidati → AMBIGUOUS
 *   - MAI matchare se chiavi diverse puntano a persone diverse → CONFLICT
 *   - Fuzzy name solo per suggerimento manuale, mai per update automatico
 *
 * Output per riga: MatchDecision con status + proposte di modifica.
 *
 * MODULO PURO: non chiama DB; prende i candidati già caricati dal chiamante.
 */

import type { FigcPlayerRow } from './figcParser'

export interface PlayerLite {
  id: string
  team_id: string
  first_name: string
  last_name: string
  birth_date: string           // ISO
  fiscal_code: string | null
  card_number: string | null   // matricola FIGC
  // Campi FIGC già presenti (da aggiornare se diversi)
  figc_season: string | null
  figc_discipline: string | null
  figc_registered_at: string | null
  figc_expiry_year: number | null
  figc_registration_type_code: string | null
  figc_registration_type_label: string | null
  figc_club_id: string | null
}

export type MatchStatus =
  | 'ready_to_update'   // match sicuro + ci sono campi da aggiornare
  | 'unchanged'         // match sicuro + tutti i campi coincidono
  | 'not_found'         // nessun candidato
  | 'ambiguous'         // più candidati plausibili
  | 'conflict'          // chiavi contrastanti
  | 'parse_error'       // riga non processabile

export interface FieldChange {
  field: string
  current_value: unknown
  proposed_value: unknown
  requires_review: boolean    // true per campi anagrafici non sovrascrivibili
}

export interface MatchDecision {
  row: FigcPlayerRow
  status: MatchStatus
  matched_player_id: string | null
  match_rule: 'card_number' | 'fiscal_code' | 'name_birth' | null
  changes: FieldChange[]
  warnings: string[]
  // Per AMBIGUOUS/CONFLICT: id dei candidati che hanno creato l'ambiguità
  candidate_ids: string[]
}

// Campi anagrafici: mai overwrite silent, solo review
const ANAG_FIELDS = new Set(['first_name', 'last_name', 'birth_date', 'fiscal_code', 'card_number'])

/**
 * Normalizza una stringa per confronto nome: uppercase, no accenti, spazi singoli.
 */
function normName(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')  // togli diacritici
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * "COGNOME NOME" vs ("Rossi", "Mario") → confronta i set di token (ordine libero).
 * Torna true se tutti i token di B sono presenti in A (o viceversa).
 */
function nameTokensMatch(fullA: string, lastB: string | null, firstB: string | null): boolean {
  const a = new Set(normName(fullA).split(' ').filter(Boolean))
  const b = [normName(lastB), normName(firstB)].flatMap(s => s.split(' ')).filter(Boolean)
  if (b.length === 0) return false
  return b.every(tok => a.has(tok))
}

interface ReconcileContext {
  season: string | null
  figc_club_id: string | null
}

export function reconcileRow(
  row: FigcPlayerRow,
  candidates: PlayerLite[],
  ctx: ReconcileContext,
): MatchDecision {
  const warnings: string[] = []
  const candidateIds = new Set<string>()

  // 0) Row-level parse errors: senza matricola o senza nome non possiamo matchare
  if (!row.figc_player_id) {
    return {
      row, status: 'parse_error', matched_player_id: null, match_rule: null,
      changes: [], warnings: ['matricola FIGC mancante'], candidate_ids: [],
    }
  }

  // 1) Candidati per card_number
  const byCard = candidates.filter(p => p.card_number && p.card_number === row.figc_player_id)
  byCard.forEach(p => candidateIds.add(p.id))

  // 2) Candidati per fiscal_code
  const byCf = row.tax_code
    ? candidates.filter(p => p.fiscal_code && p.fiscal_code.toUpperCase() === row.tax_code!.toUpperCase())
    : []
  byCf.forEach(p => candidateIds.add(p.id))

  // 3) Candidati per nome+data
  const byNameBirth = row.birth_date
    ? candidates.filter(p => p.birth_date === row.birth_date && nameTokensMatch(row.full_name_raw, p.last_name, p.first_name))
    : []
  byNameBirth.forEach(p => candidateIds.add(p.id))

  // Decisione
  let picked: PlayerLite | null = null
  let rule: MatchDecision['match_rule'] = null

  if (byCard.length === 1) {
    picked = byCard[0]
    rule = 'card_number'
    // Sicurezza: se CF nel PDF è diverso dal CF del picked e il picked ha un CF valorizzato → CONFLICT
    if (row.tax_code && picked.fiscal_code && picked.fiscal_code.toUpperCase() !== row.tax_code.toUpperCase()) {
      return {
        row, status: 'conflict', matched_player_id: null, match_rule: null,
        changes: [], warnings: [`Matricola ${row.figc_player_id} corrisponde a "${picked.last_name} ${picked.first_name}" ma CF diverso: PDF=${row.tax_code} interno=${picked.fiscal_code}`],
        candidate_ids: [picked.id],
      }
    }
    // Se la ricerca per CF/nome-data ha identificato una PERSONA DIVERSA → CONFLICT
    const others = [...byCf, ...byNameBirth].filter(p => p.id !== picked!.id)
    if (others.length > 0) {
      return {
        row, status: 'conflict', matched_player_id: null, match_rule: null,
        changes: [],
        warnings: [`Matricola ${row.figc_player_id} punta a "${picked.last_name} ${picked.first_name}" ma CF/nome puntano a: ${others.map(o => `${o.last_name} ${o.first_name}`).join(', ')}`],
        candidate_ids: [picked.id, ...others.map(o => o.id)],
      }
    }
  } else if (byCard.length > 1) {
    return {
      row, status: 'ambiguous', matched_player_id: null, match_rule: null,
      changes: [], warnings: [`${byCard.length} giocatori hanno matricola ${row.figc_player_id}`],
      candidate_ids: byCard.map(p => p.id),
    }
  } else if (byCf.length === 1) {
    picked = byCf[0]
    rule = 'fiscal_code'
    // Se picked ha una matricola valorizzata diversa dalla PDF → CONFLICT
    if (picked.card_number && picked.card_number !== row.figc_player_id) {
      return {
        row, status: 'conflict', matched_player_id: null, match_rule: null,
        changes: [], warnings: [`CF ${row.tax_code} corrisponde a "${picked.last_name} ${picked.first_name}" ma matricola interna diversa: PDF=${row.figc_player_id} interno=${picked.card_number}`],
        candidate_ids: [picked.id],
      }
    }
    const others = byNameBirth.filter(p => p.id !== picked!.id)
    if (others.length > 0) {
      return {
        row, status: 'conflict', matched_player_id: null, match_rule: null,
        changes: [], warnings: [`CF ${row.tax_code} punta a "${picked.last_name} ${picked.first_name}" ma nome+data punta a: ${others.map(o => `${o.last_name} ${o.first_name}`).join(', ')}`],
        candidate_ids: [picked.id, ...others.map(o => o.id)],
      }
    }
  } else if (byCf.length > 1) {
    return {
      row, status: 'ambiguous', matched_player_id: null, match_rule: null,
      changes: [], warnings: [`${byCf.length} giocatori hanno CF ${row.tax_code}`],
      candidate_ids: byCf.map(p => p.id),
    }
  } else if (byNameBirth.length === 1) {
    picked = byNameBirth[0]
    rule = 'name_birth'
  } else if (byNameBirth.length > 1) {
    return {
      row, status: 'ambiguous', matched_player_id: null, match_rule: null,
      changes: [], warnings: [`${byNameBirth.length} giocatori con stesso nome e data di nascita`],
      candidate_ids: byNameBirth.map(p => p.id),
    }
  } else {
    return {
      row, status: 'not_found', matched_player_id: null, match_rule: null,
      changes: [], warnings: ['nessuna corrispondenza per matricola, CF o nome+data'],
      candidate_ids: [],
    }
  }

  // Picked ≠ null: calcolo diff
  const changes: FieldChange[] = []

  const proposed: Record<string, unknown> = {
    card_number: row.figc_player_id,
    fiscal_code: row.tax_code,
    first_name: row.first_name,
    last_name: row.last_name,
    birth_date: row.birth_date,
    figc_season: ctx.season,
    figc_discipline: row.discipline,
    figc_registered_at: row.registered_at,
    figc_expiry_year: row.expiry_year,
    figc_registration_type_code: row.registration_type_code,
    figc_registration_type_label: row.registration_type_label,
    figc_club_id: ctx.figc_club_id,
  }

  const current: Record<string, unknown> = {
    card_number: picked.card_number,
    fiscal_code: picked.fiscal_code,
    first_name: picked.first_name,
    last_name: picked.last_name,
    birth_date: picked.birth_date,
    figc_season: picked.figc_season,
    figc_discipline: picked.figc_discipline,
    figc_registered_at: picked.figc_registered_at,
    figc_expiry_year: picked.figc_expiry_year,
    figc_registration_type_code: picked.figc_registration_type_code,
    figc_registration_type_label: picked.figc_registration_type_label,
    figc_club_id: picked.figc_club_id,
  }

  for (const [field, prop] of Object.entries(proposed)) {
    if (prop === null || prop === undefined) continue  // nulla da proporre
    const curr = current[field]
    const isAnag = ANAG_FIELDS.has(field)

    // Normalizza per confronto
    const same = (field === 'fiscal_code' || field === 'card_number')
      ? String(curr || '').toUpperCase() === String(prop || '').toUpperCase()
      : (field === 'first_name' || field === 'last_name')
        ? normName(String(curr || '')) === normName(String(prop || ''))
        : curr === prop

    if (same) continue
    if (curr === null || curr === '' || curr === undefined) {
      // Campo vuoto → compilabile
      changes.push({ field, current_value: curr, proposed_value: prop, requires_review: false })
    } else {
      // Campo valorizzato ma diverso: anag richiede review, altri (campi FIGC stagione) sono aggiornabili
      changes.push({ field, current_value: curr, proposed_value: prop, requires_review: isAnag })
    }
  }

  const status: MatchStatus = changes.length === 0 ? 'unchanged' : 'ready_to_update'

  return {
    row, status, matched_player_id: picked.id, match_rule: rule,
    changes, warnings,
    candidate_ids: [picked.id],
  }
}

export interface ReconcileReport {
  decisions: MatchDecision[]
  counts: Record<MatchStatus, number>
}

export function reconcileAll(
  rows: FigcPlayerRow[],
  candidates: PlayerLite[],
  ctx: ReconcileContext,
): ReconcileReport {
  const decisions = rows.map(r => reconcileRow(r, candidates, ctx))
  const counts: Record<MatchStatus, number> = {
    ready_to_update: 0, unchanged: 0, not_found: 0, ambiguous: 0, conflict: 0, parse_error: 0,
  }
  for (const d of decisions) counts[d.status]++
  return { decisions, counts }
}
