import { useEffect, useState, useMemo } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'
import { PlayerEditSheet } from './PlayerEditSheet'
import type { PlayerDetailData } from './PlayerDetailSheet'
import { avatarBg } from '../lib/utils'

interface RowPlayer {
  id: string
  first_name: string
  last_name: string
  birth_date: string | null
  position: string | null
  jersey_number: number | null
  card_number: string | null
  fiscal_code: string | null
  medical_expiry: string | null
  team_id: string | null
  team: { id: string; name: string; category: string | null; color: string | null } | null
}

interface Props {
  open: boolean
  onClose: () => void
  onUpdated?: () => void
}

type Status = 'missing' | 'expired' | 'expiring'
const STATUS_META: Record<Status, { label: string; bg: string; fg: string; icon: string }> = {
  missing:  { label: 'MANCANTE',      bg: '#f4d0f2',              fg: '#7a0071', icon: 'help_center' },
  expired:  { label: 'SCADUTO',       bg: '#ffdad6',              fg: '#93000a', icon: 'error' },
  expiring: { label: 'IN SCADENZA',   bg: 'rgba(255,209,0,0.25)', fg: '#8e6300', icon: 'warning' },
}

export function MedicalComplianceSheet({ open, onClose, onUpdated }: Props) {
  const [players, setPlayers] = useState<RowPlayer[]>([])
  const [teamTotals, setTeamTotals] = useState<Record<string, number>>({}) // team_id → totale tesserati
  const [teamMeta, setTeamMeta] = useState<Array<{ id: string; name: string; category: string | null; color: string | null }>>([])
  const [activeTeamId, setActiveTeamId] = useState<string | 'all'>('all')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<PlayerDetailData | null>(null)

  useEffect(() => { if (open) load() }, [open])

  const load = async () => {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const in30d = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

    // Query in parallelo: (1) non-in-regola, (2) tutti i players per contare totali per squadra, (3) squadre
    const [notOkRes, allPlayersRes, teamsRes] = await Promise.all([
      supabase.from('players')
        .select('id, first_name, last_name, birth_date, position, jersey_number, card_number, fiscal_code, medical_expiry, team_id, team:teams(id, name, category, color)')
        .or(`medical_expiry.is.null,medical_expiry.lte.${in30d}`)
        .order('last_name'),
      supabase.from('players').select('team_id'),
      supabase.from('teams').select('id, name, category, color').order('category'),
    ])

    // Filter esplicito: solo missing, scaduti o in-scadenza
    const filtered = (notOkRes.data ?? []).filter((p: any) =>
      !p.medical_expiry || p.medical_expiry <= in30d
    ).map((p: any) => ({
      ...p,
      team: Array.isArray(p.team) ? (p.team[0] || null) : (p.team || null),
    })) as RowPlayer[]
    setPlayers(filtered)

    // Totali per squadra
    const totals: Record<string, number> = {}
    for (const p of (allPlayersRes.data ?? [])) {
      const k = p.team_id || 'nessuna'
      totals[k] = (totals[k] ?? 0) + 1
    }
    setTeamTotals(totals)
    setTeamMeta((teamsRes.data ?? []) as any)

    setLoading(false)
  }

  // Raggruppa per squadra (filtrato se necessario)
  const byTeam = useMemo(() => {
    const map = new Map<string, { name: string; color: string; category: string | null; items: RowPlayer[] }>()
    for (const p of players) {
      const key = p.team?.id || 'nessuna'
      if (activeTeamId !== 'all' && key !== activeTeamId) continue
      if (!map.has(key)) {
        map.set(key, {
          name: p.team?.name || 'Senza squadra',
          color: p.team?.color || '#707882',
          category: p.team?.category ?? null,
          items: [],
        })
      }
      map.get(key)!.items.push(p)
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }))
  }, [players, activeTeamId])

  // KPI per ogni squadra: totale tesserati vs non in regola
  const teamKpis = useMemo(() => {
    return teamMeta.map(t => {
      const notOk = players.filter(p => p.team?.id === t.id).length
      const total = teamTotals[t.id] ?? 0
      return { ...t, total, notOk }
    })
  }, [teamMeta, teamTotals, players])

  const statusOf = (p: RowPlayer): Status => {
    if (!p.medical_expiry) return 'missing'
    const today = new Date().toISOString().slice(0, 10)
    if (p.medical_expiry < today) return 'expired'
    return 'expiring'
  }

  const openPlayer = (p: RowPlayer) => {
    setSelected({
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      birthDate: p.birth_date,
      position: p.position,
      category: p.team?.category ?? null,
      previousClub: null,
      parentName: null, parentPhone: null, parentEmail: null,
      fiscalCode: p.fiscal_code,
      jerseyNumber: p.jersey_number,
      cardNumber: p.card_number,
      medicalExpiry: p.medical_expiry,
      source: 'player',
    })
  }

  const totalMissing  = players.filter(p => statusOf(p) === 'missing').length
  const totalExpired  = players.filter(p => statusOf(p) === 'expired').length
  const totalExpiring = players.filter(p => statusOf(p) === 'expiring').length

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title="Compliance sanitaria" maxHeight="95vh">
        <div style={{ padding: '4px 18px 24px' }}>
          {/* Header con counter */}
          <div style={{
            background: 'linear-gradient(135deg, #7a0071 0%, #4a0044 100%)',
            borderRadius: 14, padding: 14, color: '#fff',
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.85, marginBottom: 3 }}>
              <Icon name="medical_services" size={12} color="#ffd100" /> Giocatori non in regola
            </div>
            <div style={{ fontSize: 22, fontFamily: 'Anybody', fontWeight: 800, marginBottom: 5 }}>
              {players.length} totali
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {totalMissing > 0 && <CounterBadge label="mancanti" value={totalMissing} bg="rgba(244,208,242,0.25)" />}
              {totalExpired > 0 && <CounterBadge label="scaduti" value={totalExpired} bg="rgba(255,218,214,0.25)" />}
              {totalExpiring > 0 && <CounterBadge label="in scadenza" value={totalExpiring} bg="rgba(255,209,0,0.25)" />}
            </div>
          </div>

          {/* Switcher per squadra */}
          {teamMeta.length > 1 && (
            <div style={{
              display: 'flex', gap: 6, background: '#fff',
              padding: 4, borderRadius: 12, marginBottom: 12,
              boxShadow: '0 2px 8px rgba(0,60,94,0.08)', overflowX: 'auto',
            }}>
              <button
                onClick={() => setActiveTeamId('all')}
                style={{
                  flexShrink: 0, padding: '8px 12px', borderRadius: 8,
                  border: 'none', cursor: 'pointer',
                  background: activeTeamId === 'all' ? '#7a0071' : 'transparent',
                  color: activeTeamId === 'all' ? '#fff' : '#404751',
                  fontSize: 12, fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <Icon name="apps" size={12} color={activeTeamId === 'all' ? '#fff' : '#707882'} />
                Tutte ({players.length})
              </button>
              {teamMeta.map(t => {
                const isActive = activeTeamId === t.id
                const notOk = players.filter(p => p.team?.id === t.id).length
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTeamId(t.id)}
                    style={{
                      flexShrink: 0, padding: '8px 12px', borderRadius: 8,
                      border: 'none', cursor: 'pointer',
                      background: isActive ? (t.color || '#005f98') : 'transparent',
                      color: isActive ? '#fff' : '#404751',
                      fontSize: 12, fontWeight: 700,
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    <Icon name="shield" size={12} color={isActive ? '#fff' : (t.color || '#707882')} />
                    {t.name}
                    {notOk > 0 && (
                      <span style={{
                        background: isActive ? 'rgba(255,255,255,0.25)' : (t.color || '#005f98'),
                        color: '#fff',
                        padding: '1px 6px', borderRadius: 999,
                        fontSize: 10, fontWeight: 800,
                      }}>{notOk}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* KPI grid per squadra: totali vs non in regola */}
          {teamKpis.length > 0 && (
            <div style={{
              display: 'grid', gridTemplateColumns: `repeat(${Math.min(teamKpis.length, 3)}, 1fr)`,
              gap: 8, marginBottom: 14,
            }}>
              {teamKpis.map(t => {
                const compliancePct = t.total > 0
                  ? Math.round(((t.total - t.notOk) / t.total) * 100)
                  : 100
                const critical = t.notOk > 0
                return (
                  <div key={t.id} style={{
                    background: '#fff', borderRadius: 12, padding: 10,
                    border: `1px solid ${(t.color || '#c0c7d2')}30`,
                    borderTop: `3px solid ${t.color || '#c0c7d2'}`,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: t.color || '#404751', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {t.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 4 }}>
                      <span style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 20, color: '#181c20', lineHeight: 1 }}>
                        {t.total}
                      </span>
                      <span style={{ fontSize: 10, color: '#707882' }}>tesserati</span>
                    </div>
                    <div style={{
                      marginTop: 5, fontSize: 11, fontWeight: 800,
                      color: critical ? '#7a0071' : '#006e25',
                      display: 'flex', alignItems: 'center', gap: 3,
                    }}>
                      <Icon name={critical ? 'warning' : 'verified'} size={12} color={critical ? '#7a0071' : '#006e25'} />
                      {critical ? `${t.notOk} non in regola` : 'Tutti OK'}
                    </div>
                    <div style={{
                      marginTop: 5, height: 4, borderRadius: 2, background: '#e6e8ee',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', width: `${compliancePct}%`,
                        background: critical ? '#7a0071' : '#006e25',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#707882', fontSize: 13 }}>
              Caricamento…
            </div>
          ) : byTeam.length === 0 ? (
            <div style={{
              padding: 30, textAlign: 'center',
              background: 'rgba(128,249,139,0.15)', color: '#006e25',
              borderRadius: 12, fontSize: 13,
            }}>
              <Icon name="verified" size={32} color="#006e25" />
              <p style={{ margin: '8px 0 0', fontWeight: 700 }}>
                {activeTeamId === 'all'
                  ? 'Tutti in regola! 🎉'
                  : 'Nessun giocatore da segnalare in questa squadra 🎉'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {byTeam.map(t => (
                <div key={t.id}>
                  {/* Header squadra */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 4px', marginBottom: 8,
                    borderBottom: `2px solid ${t.color}`,
                  }}>
                    <Icon name="shield" size={16} color={t.color} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#181c20' }}>
                      {t.name}
                      {t.category && <span style={{ color: '#707882', fontWeight: 600, marginLeft: 4, fontSize: 11 }}>· {t.category}</span>}
                    </span>
                    <span style={{
                      marginLeft: 'auto',
                      background: t.color, color: '#fff',
                      padding: '2px 8px', borderRadius: 999,
                      fontSize: 10.5, fontWeight: 800,
                    }}>{t.items.length}</span>
                  </div>

                  {/* Lista giocatori */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {t.items.map(p => {
                      const s = statusOf(p)
                      const meta = STATUS_META[s]
                      const daysExpired = p.medical_expiry
                        ? Math.floor((new Date(p.medical_expiry).getTime() - Date.now()) / 86400000)
                        : null
                      const initials = ((p.first_name?.[0] || '') + (p.last_name?.[0] || '')).toUpperCase()
                      return (
                        <div
                          key={p.id}
                          style={{
                            background: '#fff', border: `1px solid ${meta.bg}`,
                            borderRadius: 10, padding: '9px 11px',
                            display: 'flex', alignItems: 'center', gap: 9,
                          }}
                        >
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: avatarBg(initials), color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, fontSize: 10.5, flexShrink: 0,
                          }}>{initials}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#181c20', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.last_name} {p.first_name}
                            </div>
                            {p.medical_expiry && (
                              <div style={{ fontSize: 10.5, color: '#707882', marginTop: 1 }}>
                                Scadenza {new Date(p.medical_expiry).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </div>
                            )}
                          </div>
                          <span style={{
                            background: meta.bg, color: meta.fg,
                            padding: '4px 8px', borderRadius: 999,
                            fontSize: 9.5, fontWeight: 800,
                            display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0,
                          }}>
                            <Icon name={meta.icon} size={10} color={meta.fg} />
                            {s === 'expired' && daysExpired != null
                              ? `${-daysExpired}gg fa`
                              : s === 'expiring' && daysExpired != null
                              ? `${daysExpired}gg`
                              : meta.label}
                          </span>
                          <button
                            onClick={() => openPlayer(p)}
                            title="Modifica anagrafica"
                            style={{
                              background: 'rgba(0,95,152,0.10)', border: 'none',
                              padding: '6px 10px', borderRadius: 8,
                              display: 'flex', alignItems: 'center', gap: 4,
                              fontSize: 11, fontWeight: 800, color: '#005f98',
                              cursor: 'pointer', flexShrink: 0,
                            }}
                          >
                            <Icon name="edit" size={12} color="#005f98" />
                            Modifica
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </BottomSheet>

      <PlayerEditSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        player={selected}
        onSaved={() => { setSelected(null); load(); onUpdated?.() }}
      />
    </>
  )
}

function CounterBadge({ label, value, bg }: { label: string; value: number; bg: string }) {
  return (
    <span style={{
      background: bg, color: '#fff',
      padding: '3px 9px', borderRadius: 999,
      fontSize: 11, fontWeight: 700,
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      <strong style={{ fontSize: 12.5 }}>{value}</strong> {label}
    </span>
  )
}
