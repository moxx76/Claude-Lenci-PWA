import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Icon } from './Icon'

/**
 * Picker per convocare giocatori da SQUADRE DIVERSE da quella della partita.
 *
 * Due casi d'uso principali:
 *   1. Settore giovanile agonistico (richiesta Davide v1.9.112): un coach
 *      Under 14 può convocare giocatori 2014 (annata inferiore), un coach
 *      Juniores può convocare un 2011 (U16), ecc. Regole FIGC consentono
 *      il "sotto-età" nelle categorie superiori.
 *   2. Scuola calcio / tornei: distinte miste con giocatori di annate
 *      diverse (Piccoli Amici 2020-21 + Primi Calci 2019 in un torneo).
 *
 * Non tocca il flusso principale della convocazione: aggiunge solo la
 * possibilità di pescare giocatori extra dal roster di altre squadre.
 * Il picker ordina intelligentemente le squadre per vicinanza di categoria,
 * mettendo in cima la categoria immediatamente inferiore e marcandola come
 * "sotto-età" (il caso più comune).
 */

interface BorrowablePlayer {
  id: string
  first_name: string
  last_name: string
  birth_date: string
  position: string | null
  jersey_number: number | null
  card_number: string | null
  fiscal_code: string | null
  medical_expiry: string | null
  team_id: string
  team_name: string
  team_category: string | null
}

interface BorrowPlayerPickerSheetProps {
  open: boolean
  onClose: () => void
  excludeTeamId: string          // ID della squadra corrente (esclusa dal picker)
  excludePlayerIds: string[]     // ID di giocatori già selezionati (esclusi dal picker)
  /** Categoria FIGC della squadra corrente (per ordinare i gruppi per vicinanza). */
  currentTeamCategory?: string | null
  onSelect: (selected: BorrowablePlayer[]) => void
}

/**
 * Converte una categoria FIGC in un "tier" numerico decrescente che
 * rappresenta l'età indicativa (quanti anni ha un giocatore della
 * categoria). Serve per ordinare i gruppi per vicinanza nel picker.
 *   Prima Squadra → 99 (sentinella alto)
 *   Juniores     → 19
 *   U-19 / U-17 / U-16 / U-15 / U-14 → numero dopo "U-"
 *   Esordienti   → 13
 *   Pulcini      → 11
 *   Primi Calci  → 9
 *   Piccoli Amici → 7
 */
function categoryTier(category: string | null | undefined): number | null {
  if (!category) return null
  const c = category.trim().toLowerCase()
  if (!c) return null
  if (c.includes('prima')) return 99
  if (c.includes('juniores')) return 19
  const mUnder = c.match(/^u-?(\d{2})$/i)
  if (mUnder) return parseInt(mUnder[1], 10)
  if (c.includes('esordienti')) return 13
  if (c.includes('pulcini')) return 11
  if (c.includes('primi calci')) return 9
  if (c.includes('piccoli amici')) return 7
  return null
}

export function BorrowPlayerPickerSheet({
  open, onClose, excludeTeamId, excludePlayerIds, currentTeamCategory, onSelect,
}: BorrowPlayerPickerSheetProps) {
  const [loading, setLoading] = useState(false)
  const [allPlayers, setAllPlayers] = useState<BorrowablePlayer[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  // v1.9.112: filtro default "solo cat. inferiori" per il settore giovanile.
  // Un coach U14 convoca naturalmente dai 2014 (cat. inferiore), non dai U17.
  const [onlyLowerTiers, setOnlyLowerTiers] = useState(false)
  const currentTier = useMemo(() => categoryTier(currentTeamCategory), [currentTeamCategory])

  useEffect(() => {
    if (!open) return
    setSelected({})
    setQuery('')
    // Attivo di default il filtro "cat. inferiori" quando ha senso (team con
    // categoria riconosciuta); l'utente può disattivarlo con un tap.
    setOnlyLowerTiers(currentTier !== null)
    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('players')
        .select('id, first_name, last_name, birth_date, position, jersey_number, card_number, fiscal_code, medical_expiry, team_id, team:teams(name, category)')
        .neq('team_id', excludeTeamId)
        .order('team_id')
        .order('last_name')
      const players: BorrowablePlayer[] = ((data ?? []) as any[])
        .map(p => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          birth_date: p.birth_date,
          position: p.position,
          jersey_number: p.jersey_number,
          card_number: p.card_number,
          fiscal_code: p.fiscal_code,
          medical_expiry: p.medical_expiry,
          team_id: p.team_id,
          team_name: p.team?.name ?? '?',
          team_category: p.team?.category ?? null,
        }))
        .filter(p => !excludePlayerIds.includes(p.id))
      setAllPlayers(players)
      setLoading(false)
    }
    load()
  }, [open, excludeTeamId, excludePlayerIds.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    let base = allPlayers
    // Filtro "stesso tier o inferiore" (v1.9.138, prima era "<" cioè solo
    // inferiori strette): mantiene i giocatori di squadre con tier numericamente
    // uguale o inferiore al corrente. Fix segnalazione 2026-10-07: un allenatore
    // dei Pulcini 2016 deve poter convocare dai Pulcini 2017 (stesso tier
    // categoria, ma annata più piccola di maturazione) oltre che da Primi
    // Calci/Piccoli Amici. Il filtro resta utile per nascondere Juniores/
    // Prima Squadra agli allenatori giovanili.
    if (onlyLowerTiers && currentTier != null) {
      base = base.filter(p => {
        const t = categoryTier(p.team_category)
        return t != null && t <= currentTier
      })
    }
    const q = query.trim().toLowerCase()
    if (!q) return base
    return base.filter(p =>
      p.first_name.toLowerCase().includes(q) ||
      p.last_name.toLowerCase().includes(q) ||
      p.team_name.toLowerCase().includes(q) ||
      (p.team_category || '').toLowerCase().includes(q)
    )
  }, [allPlayers, query, onlyLowerTiers, currentTier])

  // Raggruppo per squadra. Ordinamento intelligente per "vicinanza di
  // categoria": le squadre con tier immediatamente inferiore al corrente
  // vengono mostrate per prime (il caso più naturale di convocazione
  // sotto-età), poi via via le altre, infine quelle senza categoria.
  const grouped = useMemo(() => {
    const byTeam: Record<string, BorrowablePlayer[]> = {}
    for (const p of filtered) {
      if (!byTeam[p.team_id]) byTeam[p.team_id] = []
      byTeam[p.team_id].push(p)
    }
    const groups = Object.keys(byTeam).map(teamId => {
      const first = byTeam[teamId][0]
      const tier = categoryTier(first.team_category)
      return {
        teamName: first.team_name,
        teamCategory: first.team_category,
        teamTier: tier,
        players: byTeam[teamId],
      }
    })
    // Ordinamento (v1.9.139 — segnalazione Fabio Pulcini 2016):
    //   1. Stesso tier del corrente in cima (es. Pulcini 2016 → Pulcini 2017
    //      per prime: l'altra annata della stessa categoria è il caso più
    //      naturale di prestito con compagni di pari livello).
    //   2. Poi tier inferiori stretti, dal più vicino al più lontano.
    //   3. Poi tier superiori, dal più basso al più alto.
    //   4. Infine squadre senza categoria.
    //   5. Fallback alfabetico sul nome squadra.
    return groups.sort((a, b) => {
      if (currentTier != null) {
        const aIsSame = a.teamTier === currentTier
        const bIsSame = b.teamTier === currentTier
        if (aIsSame && !bIsSame) return -1
        if (!aIsSame && bIsSame) return 1

        const aIsLower = a.teamTier != null && a.teamTier < currentTier
        const bIsLower = b.teamTier != null && b.teamTier < currentTier
        if (aIsLower && !bIsLower) return -1
        if (!aIsLower && bIsLower) return 1
        if (aIsLower && bIsLower) {
          // Entrambi inferiori: più vicino al corrente per primo
          return (currentTier - (a.teamTier!)) - (currentTier - (b.teamTier!))
        }
        // Entrambi superiori o senza tier: tier basso per primo (più vicino al corrente)
        if (a.teamTier != null && b.teamTier != null) return a.teamTier - b.teamTier
        if (a.teamTier != null) return -1
        if (b.teamTier != null) return 1
      }
      return a.teamName.localeCompare(b.teamName)
    })
  }, [filtered, currentTier])

  const selectedCount = Object.values(selected).filter(Boolean).length

  const handleConfirm = () => {
    const chosen = allPlayers.filter(p => selected[p.id])
    onSelect(chosen)
    onClose()
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(20,30,40,0.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560,
          background: '#fff',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px 10px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#181c20' }}>
              Convoca da altra categoria
            </div>
            <div style={{ fontSize: 11.5, color: '#707882', marginTop: 2 }}>
              {currentTier != null
                ? 'Giocatori dall\'annata inferiore (sotto-età) o distinte miste'
                : 'Giocatori di altre squadre (es. distinte miste scuola calcio)'}
            </div>
          </div>
          <button onClick={onClose} type="button"
            style={{
              width: 32, height: 32, border: 'none', background: 'transparent',
              cursor: 'pointer', color: '#404751',
            }}>
            <Icon name="close" size={20} color="#404751" />
          </button>
        </div>

        {/* Search + filtro sotto-età */}
        <div style={{ padding: '10px 18px', borderBottom: '1px solid #f0f2f5' }}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cerca per nome, cognome o categoria…"
            style={{
              width: '100%', padding: '9px 12px',
              border: '1px solid #c0c7d2', borderRadius: 10,
              fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
          {currentTier != null && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setOnlyLowerTiers(v => !v)}
                style={{
                  padding: '5px 10px', borderRadius: 999,
                  border: `1px solid ${onlyLowerTiers ? '#005f98' : '#c0c7d2'}`,
                  background: onlyLowerTiers ? '#005f98' : '#fff',
                  color: onlyLowerTiers ? '#fff' : '#404751',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                {onlyLowerTiers && <Icon name="check" size={12} color="#fff" />}
                Nascondi categorie superiori
              </button>
            </div>
          )}
        </div>

        {/* Lista giocatori raggruppati per categoria */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {loading && (
            <div style={{ padding: 30, textAlign: 'center', color: '#707882', fontSize: 13 }}>
              Caricamento…
            </div>
          )}
          {!loading && grouped.length === 0 && (
            <div style={{ padding: 30, textAlign: 'center', color: '#707882', fontSize: 13 }}>
              {query ? 'Nessun giocatore corrisponde alla ricerca' : 'Nessun giocatore disponibile in altre categorie'}
            </div>
          )}
          {!loading && grouped.map(g => {
            const isLowerTier = currentTier != null && g.teamTier != null && g.teamTier < currentTier
            const isSameTier = currentTier != null && g.teamTier != null && g.teamTier === currentTier
            const isUpperTier = currentTier != null && g.teamTier != null && g.teamTier > currentTier
            return (
            <div key={g.teamName} style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: '#005f98',
                textTransform: 'uppercase', letterSpacing: 0.5,
                padding: '6px 6px 4px',
                display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
              }}>
                <span>{g.teamName} · {g.players.length} gioc.</span>
                {isSameTier && (
                  <span style={{
                    background: '#cfe5ff', color: '#004a78',
                    padding: '1px 7px', borderRadius: 999,
                    fontSize: 9.5, fontWeight: 800, letterSpacing: 0.3,
                  }}>STESSA CATEGORIA</span>
                )}
                {isLowerTier && (
                  <span style={{
                    background: '#dcf5df', color: '#006e25',
                    padding: '1px 7px', borderRadius: 999,
                    fontSize: 9.5, fontWeight: 800, letterSpacing: 0.3,
                  }}>SOTTO-ETÀ</span>
                )}
                {isUpperTier && (
                  <span style={{
                    background: '#ffe8c7', color: '#8e6300',
                    padding: '1px 7px', borderRadius: 999,
                    fontSize: 9.5, fontWeight: 800, letterSpacing: 0.3,
                  }}>SOPRA-ETÀ</span>
                )}
              </div>
              {g.players.map(p => {
                const isSel = !!selected[p.id]
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 10px', width: '100%',
                      background: isSel ? '#e8f0f9' : '#fff',
                      border: `1px solid ${isSel ? '#005f98' : '#e5e7eb'}`,
                      borderRadius: 8, marginBottom: 4,
                      cursor: 'pointer', textAlign: 'left',
                    }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6,
                      border: `2px solid ${isSel ? '#005f98' : '#c0c7d2'}`,
                      background: isSel ? '#005f98' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {isSel && <Icon name="check" size={14} color="#fff" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#181c20' }}>
                        {p.last_name.toUpperCase()} {p.first_name}
                      </div>
                    </div>
                    {p.jersey_number != null && (
                      <div style={{
                        fontSize: 11, fontWeight: 800, color: '#c73434',
                        padding: '2px 8px', background: '#fef1f1', borderRadius: 6,
                      }}>
                        #{p.jersey_number}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            )
          })}
        </div>

        {/* Footer con Conferma */}
        <div style={{
          padding: 14, borderTop: '1px solid #e5e7eb',
          display: 'flex', gap: 10,
        }}>
          <button onClick={onClose} type="button"
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 10,
              border: '1px solid #c0c7d2', background: '#fff',
              fontSize: 13, fontWeight: 700, color: '#404751', cursor: 'pointer',
            }}>Annulla</button>
          <button onClick={handleConfirm} type="button" disabled={selectedCount === 0}
            style={{
              flex: 2, padding: '12px 16px', borderRadius: 10, border: 'none',
              background: selectedCount === 0 ? '#c0c7d2' : '#005f98',
              color: '#fff',
              fontSize: 13, fontWeight: 800, cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
            }}>
            {selectedCount === 0 ? 'Seleziona giocatori' : `Aggiungi ${selectedCount} giocator${selectedCount === 1 ? 'e' : 'i'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
