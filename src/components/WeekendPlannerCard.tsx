import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Icon } from './Icon'
import { BottomSheet } from './BottomSheet'
import {
  buildSectorWeekendPng,
  downloadBlob,
  shareOrDownload,
  type SectorPlannerData,
} from '../lib/weekendSectorPlannerBuilder'
import { formatEventLocationParts } from '../lib/eventLocation'

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
  // v1.9.104: estesi con indirizzo + competition per poter mostrare la
  // città (location_address) e il nome torneo nel riga location.
  location_address: string | null
  competition: string | null
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

// Converte un EventRow interno al formato richiesto dal builder PNG.
// Lascio il builder definire etichette/colori: qui passo solo dati grezzi.
function mapForExport(e: EventRow) {
  return {
    date: e.date,
    startTime: e.startTime,
    endTime: e.endTime,
    kind: e.kind,
    teamName: e.team_name,
    teamColor: e.team_color,
    title: e.title,
    opponent: e.opponent,
    venue: e.venue,
    location: e.location,
    locationAddress: e.location_address,
    competition: e.competition,
  }
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
  // Export PNG: anteprima + condividi/scarica
  const [exportOpen, setExportOpen] = useState(false)
  const [exportBlob, setExportBlob] = useState<Blob | null>(null)
  const [exportUrl, setExportUrl] = useState<string | null>(null)
  const [exportLoading, setExportLoading] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

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
            .select('id, match_date, team_id, opponent, venue, location, location_address, kickoff_field, competition')
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
            location_address: null,
            competition: null,
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
            location_address: m.location_address || null,
            competition: m.competition || null,
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

  // Costruisco il payload per il builder PNG partendo da `grouped`.
  // Chiamato al tap del bottone Esporta: evita di generare l'immagine fino
  // a quando l'utente non la vuole davvero.
  async function handleOpenExport() {
    setExportOpen(true)
    if (exportBlob) return // già generato
    setExportLoading(true)
    setExportError(null)
    try {
      const data: SectorPlannerData = {
        saturdayISO: satISO,
        sundayISO: sunISO,
        sections: {
          prima: grouped.prima.map(mapForExport),
          agonistica: grouped.agonistica.map(mapForExport),
          scuola: grouped.scuola.map(mapForExport),
        },
      }
      const blob = await buildSectorWeekendPng(data)
      setExportBlob(blob)
      setExportUrl(URL.createObjectURL(blob))
    } catch (e: any) {
      setExportError(e?.message || 'Errore generazione PNG')
    } finally {
      setExportLoading(false)
    }
  }

  // Cleanup URL quando si chiude
  useEffect(() => {
    if (!exportOpen && exportUrl) {
      URL.revokeObjectURL(exportUrl)
      setExportUrl(null)
      setExportBlob(null)
    }
  }, [exportOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const exportFilename = `Weekend_Club_${satISO}.png`

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

      {/* Sheet anteprima + condivisione PNG */}
      <BottomSheet open={exportOpen} onClose={() => setExportOpen(false)} title="Weekend del club · PNG">
        <div style={{ padding: '8px 14px 24px' }}>
          {exportLoading && (
            <div style={{ padding: 40, textAlign: 'center', color: '#707882', fontSize: 13 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🎨</div>
              Genero l'immagine…
            </div>
          )}
          {exportError && (
            <div style={{
              padding: 12, background: '#ffe4e4', color: '#7a0000',
              borderRadius: 8, fontSize: 12, fontWeight: 600,
            }}>
              ⚠ {exportError}
            </div>
          )}
          {!exportLoading && !exportError && exportUrl && (
            <>
              <div style={{ fontSize: 11.5, color: '#707882', marginBottom: 8, textAlign: 'center' }}>
                Formato 9:16 · perfetto per WhatsApp e gruppo dirigenti
              </div>
              <div style={{
                borderRadius: 12, overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                marginBottom: 12, background: '#000',
                maxHeight: '55vh',
                display: 'flex', justifyContent: 'center',
              }}>
                <img src={exportUrl} alt="Anteprima weekend del club"
                  style={{ maxWidth: '100%', maxHeight: '55vh', display: 'block', objectFit: 'contain' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  onClick={() => exportBlob && shareOrDownload(exportBlob, exportFilename, 'Weekend del club')}
                  style={{
                    padding: '12px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                    color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    fontFamily: 'inherit',
                  }}
                >
                  <Icon name="share" size={16} color="#fff" />
                  Condividi
                </button>
                <button
                  onClick={() => exportBlob && downloadBlob(exportBlob, exportFilename)}
                  style={{
                    padding: '12px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg, #7a0071 0%, #a71a9a 100%)',
                    color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    fontFamily: 'inherit',
                  }}
                >
                  <Icon name="download" size={16} color="#fff" />
                  Scarica PNG
                </button>
              </div>
              <div style={{
                marginTop: 10, padding: '8px 10px',
                background: '#f0f7ff', borderRadius: 8,
                fontSize: 10.5, color: '#004a78', lineHeight: 1.45,
              }}>
                💡 Su mobile <strong>Condividi</strong> apre il selettore nativo (WhatsApp, Instagram…). Su desktop scarica il file.
              </div>
            </>
          )}
        </div>
      </BottomSheet>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          {/* Bottone Esporta PNG: visibile sempre, abilitato solo se ci sono eventi.
              Permette di condividere il weekend del club su WhatsApp / Instagram Stories. */}
          {!loading && !error && (
            <button
              onClick={handleOpenExport}
              disabled={totalCount === 0}
              style={{
                width: '100%', marginBottom: 12,
                padding: '10px 14px', borderRadius: 10,
                border: 'none',
                background: totalCount === 0
                  ? '#e6e8ee'
                  : 'linear-gradient(135deg, #7a0071, #a71a9a)',
                color: totalCount === 0 ? '#8993a3' : '#fff',
                fontSize: 12.5, fontWeight: 800,
                cursor: totalCount === 0 ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: totalCount === 0 ? 'none' : '0 4px 10px rgba(122,0,113,0.25)',
              }}
            >
              <Icon name="image" size={14} color={totalCount === 0 ? '#8993a3' : '#fff'} />
              Esporta come immagine
            </button>
          )}
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

  // v1.9.104 + fix v1.9.105: riga location UNIFORME. Città sulla prima riga,
  // nome torneo (eventuale) su una SECONDA riga sotto, con wrap libero così
  // non viene troncato quando è lungo (es. "Torneo Pre-Campionato U14
  // Provinciale - Girone 1 - 1ª giornata").
  const locationParts = formatEventLocationParts({
    venue: ev.venue,
    location: ev.location,
    locationAddress: ev.location_address,
    competition: ev.competition,
    kind: ev.kind,
  })

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
        </div>
        <div style={{
          fontSize: 12, fontWeight: 700, color: '#181c20',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {ev.title}
        </div>
        {locationParts && (
          <>
            {/* v1.9.109: etichetta esplicita "LOCALITÀ:" per i match */}
            {ev.kind === 'match' ? (
              <div style={{
                fontSize: 10.5, lineHeight: 1.3,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                <span style={{ color: '#707882' }}>{locationParts.icon}&nbsp;</span>
                <span style={{ color: '#7a0071', fontWeight: 800 }}>LOCALITÀ:&nbsp;</span>
                <span style={{ color: '#181c20', fontWeight: 700 }}>{locationParts.primary}</span>
              </div>
            ) : (
              <div style={{
                fontSize: 10.5, color: '#707882',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {locationParts.icon} {locationParts.primary}
              </div>
            )}
            {locationParts.secondary && (
              <div style={{
                fontSize: 10.5, color: '#707882',
                lineHeight: 1.3,
              }}>
                {locationParts.secondary}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
