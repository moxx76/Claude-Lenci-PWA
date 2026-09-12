import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Icon } from './Icon'

/**
 * Picker per convocare giocatori da SQUADRE DIVERSE da quella della partita.
 * Uso tipico: distinte "miste" nella scuola calcio dove si accorpano giocatori
 * di annate diverse (es. Piccoli Amici 2020-21 + Primi Calci 2019 in un solo
 * torneo tornei). Non tocca il flusso principale della convocazione: aggiunge
 * solo la possibilità di pescare giocatori extra dal roster di altre squadre.
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
}

interface BorrowPlayerPickerSheetProps {
  open: boolean
  onClose: () => void
  excludeTeamId: string          // ID della squadra corrente (esclusa dal picker)
  excludePlayerIds: string[]     // ID di giocatori già selezionati (esclusi dal picker)
  onSelect: (selected: BorrowablePlayer[]) => void
}

export function BorrowPlayerPickerSheet({
  open, onClose, excludeTeamId, excludePlayerIds, onSelect,
}: BorrowPlayerPickerSheetProps) {
  const [loading, setLoading] = useState(false)
  const [allPlayers, setAllPlayers] = useState<BorrowablePlayer[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!open) return
    setSelected({})
    setQuery('')
    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('players')
        .select('id, first_name, last_name, birth_date, position, jersey_number, card_number, fiscal_code, medical_expiry, team_id, team:teams(name)')
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
        }))
        .filter(p => !excludePlayerIds.includes(p.id))
      setAllPlayers(players)
      setLoading(false)
    }
    load()
  }, [open, excludeTeamId, excludePlayerIds.join(',')])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allPlayers
    return allPlayers.filter(p =>
      p.first_name.toLowerCase().includes(q) ||
      p.last_name.toLowerCase().includes(q) ||
      p.team_name.toLowerCase().includes(q)
    )
  }, [allPlayers, query])

  // Raggruppo per squadra per rendering
  const grouped = useMemo(() => {
    const groups: { teamName: string; players: BorrowablePlayer[] }[] = []
    const byTeam: Record<string, BorrowablePlayer[]> = {}
    for (const p of filtered) {
      if (!byTeam[p.team_id]) byTeam[p.team_id] = []
      byTeam[p.team_id].push(p)
    }
    for (const teamId of Object.keys(byTeam)) {
      groups.push({ teamName: byTeam[teamId][0].team_name, players: byTeam[teamId] })
    }
    return groups.sort((a, b) => a.teamName.localeCompare(b.teamName))
  }, [filtered])

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
              Convoca giocatori da altre categorie
            </div>
            <div style={{ fontSize: 11.5, color: '#707882', marginTop: 2 }}>
              Utile per distinte miste (es. tornei scuola calcio)
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

        {/* Search */}
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
          {!loading && grouped.map(g => (
            <div key={g.teamName} style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: '#005f98',
                textTransform: 'uppercase', letterSpacing: 0.5,
                padding: '6px 6px 4px',
              }}>
                {g.teamName} · {g.players.length} gioc.
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
          ))}
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
