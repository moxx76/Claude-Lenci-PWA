import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Icon } from './Icon'

/**
 * WeekendPlannerCard — Pannello dashboard che mostra gli impegni del weekend
 * (sabato + domenica) raggruppati per i 3 settori di club:
 *   - Prima Squadra (adulti)
 *   - Settore Giovanile Agonistico (Juniores U19, Allievi U16, Giovanissimi U14)
 *   - Scuola Calcio / Attività di Base (Esordienti, Pulcini, Primi Calci, Piccoli Amici)
 *
 * Richiesto da Luca Palermo (admin/director) per avere a colpo d'occhio il
 * weekend diviso per settore senza passare dal calendario intero.
 * Montato in DirectorDashboard e AdminDashboard — RLS già filtra per club.
 *
 * Regole di raggruppamento (convenzione FIGC):
 *   - category == 'Prima Squadra' → Prima Squadra
 *   - category IN ('Juniores', 'U-14', 'U-15', 'U-16', 'U-17') OR name ILIKE 'Under 1_' → Agonistica
 *   - categorie 'Esordienti', 'Pulcini', 'Primi Calci', 'Piccoli Amici' → Scuola Calcio
 *   - fallback → Scuola Calcio (categorie di base nuove che non riconosco)
 */

type Sector = 'prima' | 'agonistica' | 'scuola'

interface TeamRow {
  id: string
  name: string
  category: string | null
  color: string | null
}

interface EventRow {
  id: string
  kind: 'training' | 'match'
  date: string           // YYYY-MM-DD
  startTime: string      // HH:MM
  endTime: string | null
  title: string
  team_id: string | null
  team_name: string | null
  team_color: string | null
  venue: 'home' | 'away' | null
  opponent: string | null
  location: string | null
}

const SECTOR_META: Record<Sector, { label: string; icon: string; accent: string; bg: string }> = {
  prima:      { label: 'Prima Squadra',    icon: 'military_tech',  accent: '#93000a', bg: '#ffdad6' },
  agonistica: { label: 'Settore Giovanile', icon: 'sports_soccer', accent: '#005f98', bg: '#cfe5ff' },
  scuola:     { label: 'Scuola Calcio',    icon: 'child_care',    accent: '#8e6300', bg: '#fff2b3' },
}

function teamSector(t: { category: string | null; name: string }): Sector {
  const cat = (t.category || '').trim()
  const nm = (t.name || '').trim().toLowerCase()
  if (cat === 'Prima Squadra') return 'prima'
  if (cat === 'Juniores') return 'agonistica'
  // U-14, U-15, U-16, U-17 (categoria FIGC con trattino) o nome "Under 14/15/16/17"
  if (/^U-?1[4567]$/i.test(cat)) return 'agonistica'
  if (/^under\s*1[4567]$/i.test(nm)) return 'agonistica'
  // Scuola calcio: tutto il resto di base
  if (['Esordienti', 'Pulcini', 'Primi Calci', 'Piccoli Amici'].includes(cat)) return 'scuola'
  return 'scuola'
}

// Weekend prossimo (lun→gio) o corrente (ven/sab/dom)
function computeWeekend(): [string, string] {
  const d = new Date()
  const dow = d.getDay() // 0 dom, 6 sab
  const sat = new Date(d)
  if (dow === 0) sat.setDate(d.getDate() - 1)         // dom → ieri
  else if (dow === 6) { /* sab = oggi */ }
  else if (dow === 5) sat.setDate(d.getDate() + 1)    // ven → domani
  else sat.setDate(d.getDate() + (6 - dow))           // lun-gio → sab prossimo
  const sun = new Date(sat); sun.setDate(sat.getDate() + 1)
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`
  return [iso(sat), iso(sun)]
}

export function WeekendPlannerCard() {
  const [satISO, sunISO] = useMemo(() => computeWeekend(), [])
  const [teams, setTeams] = useState<Record<string, TeamRow>>({})
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      try {
        const [teamsRes, trRes, matchRes] = await Promise.all([
          supabase.from('teams').select('id, name, category, color'),
          supabase.from('trainings')
            .select('id, training_date, start_time, end_time, team_id, focus, location')
            .gte('training_date', satISO).lte('training_date', sunISO),
          supabase.from('matches')
            .select('id, match_date, team_id, opponent, venue, location, kickoff_field, competition')
            .gte('match_date', satISO + 'T00:00:00')
            .lte('match_date', sunISO + 'T23:59:59'),
        ])
        if (cancelled) return
        if (teamsRes.error) throw teamsRes.error
        const tmap: Record<string, TeamRow> = {}
        for (const t of (teamsRes.data ?? []) as any[]) {
          tmap[t.id] = { id: t.id, name: t.name, category: t.category, color: t.color }
        }
        setTeams(tmap)
        const list: EventRow[] = []
        for (const t of (trRes.data ?? []) as any[]) {
          const team = tmap[t.team_id] || null
          list.push({
            id: `tr-${t.id}`, kind: 'training',
            date: t.training_date,
            startTime: (t.start_time as string)?.slice(0, 5) || '',
            endTime: (t.end_time as string)?.slice(0, 5) || null,
            title: t.focus || 'Allenamento',
            team_id: t.team_id,
            team_name: team?.name ?? null, team_color: team?.color ?? null,
            venue: null, opponent: null,
            location: t.location,
          })
        }
        for (const m of (matchRes.data ?? []) as any[]) {
          const team = tmap[m.team_id] || null
          const d = new Date(m.match_date)
          const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
          const hh = String(d.getHours()).padStart(2,'0'); const mm = String(d.getMinutes()).padStart(2,'0')
          list.push({
            id: `m-${m.id}`, kind: 'match',
            date,
            startTime: `${hh}:${mm}`,
            endTime: null,
            title: m.opponent ? `vs ${m.opponent}` : (m.competition || 'Partita'),
            team_id: m.team_id,
            team_name: team?.name ?? null, team_color: team?.color ?? null,
            venue: (m.venue === 'home' || m.venue === 'away') ? m.venue : null,
            opponent: m.opponent,
            location: m.kickoff_field || m.location || null,
          })
        }
        list.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
        setEvents(list)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Errore caricamento')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [satISO, sunISO])

  // Raggruppo per settore poi per giorno
  const grouped = useMemo(() => {
    const bySector: Record<Sector, EventRow[]> = { prima: [], agonistica: [], scuola: [] }
    for (const e of events) {
      const team = e.team_id ? teams[e.team_id] : null
      const sector = team ? teamSector(team) : 'scuola'
      bySector[sector].push(e)
    }
    return bySector
  }, [events, teams])

  const totalCount = events.length
  const fmtDay = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
    return `${days[dt.getDay()]} ${d}/${m}`
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: 14,
      boxShadow: '0 6px 16px rgba(0,60,95,0.06)', marginBottom: 14,
    }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
          padding: 0, display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'inherit',
        }}
      >
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'linear-gradient(135deg, #7a0071, #a71a9a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon name="weekend" size={20} color="#fff" />
        </div>
        <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#181c20' }}>Weekend del club</div>
          <div style={{ fontSize: 11.5, color: '#707882' }}>
            {fmtDay(satISO)} · {fmtDay(sunISO)}
            {!loading && ` · ${totalCount} impegn${totalCount === 1 ? 'o' : 'i'}`}
          </div>
        </div>
        <Icon name={expanded ? 'expand_less' : 'expand_more'} size={20} color="#707882" />
      </button>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          {loading && <div style={{ fontSize: 12, color: '#707882', textAlign: 'center', padding: 12 }}>Caricamento…</div>}
          {error && (
            <div style={{ padding: 10, background: '#ffdad6', color: '#93000a', borderRadius: 8, fontSize: 11.5, fontWeight: 600 }}>
              ⚠ {error}
            </div>
          )}
          {!loading && !error && totalCount === 0 && (
            <div style={{
              padding: 20, background: '#f5f7fb', borderRadius: 10, textAlign: 'center',
              fontSize: 12.5, color: '#707882',
            }}>
              Nessun impegno in programma per il weekend selezionato.
            </div>
          )}
          {!loading && !error && totalCount > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(['prima', 'agonistica', 'scuola'] as const).map(sector => {
                const items = grouped[sector]
                if (items.length === 0) return null
                const meta = SECTOR_META[sector]
                return (
                  <div key={sector} style={{
                    border: `1px solid ${meta.accent}22`, borderRadius: 10, overflow: 'hidden',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', background: meta.bg, color: meta.accent,
                    }}>
                      <Icon name={meta.icon} size={16} color={meta.accent} />
                      <span style={{ fontSize: 12.5, fontWeight: 800 }}>{meta.label}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, opacity: 0.75 }}>
                        {items.length} impegn{items.length === 1 ? 'o' : 'i'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {items.map(e => (
                        <SectorEventRow key={e.id} ev={e} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SectorEventRow({ ev }: { ev: EventRow }) {
  const [y, m, d] = ev.date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dayLabel = dt.getDay() === 6 ? 'SAB' : dt.getDay() === 0 ? 'DOM' : ''
  const kindBg = ev.kind === 'match' ? '#ffdad6' : '#cfe5ff'
  const kindColor = ev.kind === 'match' ? '#93000a' : '#004a78'
  const kindLabel = ev.kind === 'match' ? 'Partita' : 'Allenamento'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 10px', borderTop: '1px solid #f1f3fa',
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        minWidth: 42, padding: '3px 4px', background: '#f5f7fb', borderRadius: 6,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: '#8e6300', lineHeight: 1 }}>{dayLabel}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#181c20', lineHeight: 1.1 }}>{ev.startTime}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 9, fontWeight: 800, padding: '2px 5px', borderRadius: 4,
            background: kindBg, color: kindColor,
          }}>{kindLabel.toUpperCase()}</span>
          {ev.team_name && (
            <span style={{
              fontSize: 10.5, fontWeight: 700,
              color: ev.team_color || '#404751',
            }}>{ev.team_name}</span>
          )}
          {ev.kind === 'match' && ev.venue === 'home' && (
            <span style={{ fontSize: 10, color: '#8e6300' }}>🏠 Casa</span>
          )}
          {ev.kind === 'match' && ev.venue === 'away' && (
            <span style={{ fontSize: 10, color: '#8e6300' }}>✈️ Trasferta</span>
          )}
        </div>
        <div style={{
          fontSize: 12, fontWeight: 700, color: '#181c20',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {ev.title}
        </div>
        {ev.location && (
          <div style={{
            fontSize: 10.5, color: '#707882',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            📍 {ev.location}
          </div>
        )}
      </div>
    </div>
  )
}
