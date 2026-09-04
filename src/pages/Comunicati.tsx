import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { isAdmin, isCoach } from '../lib/types'
import { Icon } from '../components/Icon'
import { sortTeamsByAge } from '../lib/teamOrder'

// ============================================================
// TYPES
// ============================================================

interface Comunicato {
  id: string
  titolo: string
  categoria: string | null
  categoria_slug: string | null
  data_pubblicazione: string
  link: string | null
  sintesi: string | null
  team_id: string | null
}

type Criterio = 'societa' | 'disciplinare' | 'scadenze' | 'gare'

interface Rilievo {
  id: string
  comunicato_id: string
  criterio: Criterio
  testo: string
  scadenza: string | null
  fonte: string | null
  team_id: string | null
  comunicato?: {
    titolo: string
    data_pubblicazione: string
    link: string | null
  } | null
}

interface Gara {
  id: string
  competizione: string
  girone: string | null
  giornata: number | null
  fase: string | null
  data: string
  ora: string | null
  avversario: string
  in_casa: boolean
  fonte: string | null
  team_id: string | null
}

interface TeamLite {
  id: string
  name: string
  color: string | null
  category: string | null
  age_range: string | null
}

// ============================================================
// META
// ============================================================

const CRITERIO_META: Record<Criterio, { label: string; icon: string; color: string; bg: string }> = {
  societa: { label: 'Società', icon: 'business', color: '#005f98', bg: '#e0f0ff' },
  disciplinare: { label: 'Disciplinare', icon: 'gavel', color: '#93000a', bg: '#ffe4e4' },
  scadenze: { label: 'Scadenze', icon: 'schedule', color: '#7c4700', bg: '#fff4e6' },
  gare: { label: 'Gare', icon: 'sports_soccer', color: '#006e25', bg: '#dcf1e2' },
}

const TAB_META: Array<{ key: Tab; label: string; icon: string }> = [
  { key: 'rilievi',    label: 'Rilievi',     icon: 'checklist' },
  { key: 'comunicati', label: 'Comunicati',  icon: 'article' },
  { key: 'gare',       label: 'Gare 1ª sq.', icon: 'sports_soccer' },
]
type Tab = 'rilievi' | 'comunicati' | 'gare'

// ============================================================
// PAGE
// ============================================================

export function ComunicatiPage() {
  const { profile } = useAuth()
  const isStaff = isAdmin(profile?.role) || isCoach(profile?.role)

  const [tab, setTab] = useState<Tab>('rilievi')
  const [comunicati, setComunicati] = useState<Comunicato[]>([])
  const [rilievi, setRilievi] = useState<Rilievo[]>([])
  const [gare, setGare] = useState<Gara[]>([])
  const [teams, setTeams] = useState<TeamLite[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const [cRes, rRes, gRes, tRes] = await Promise.all([
          supabase.from('lnd_comunicati')
            .select('id, titolo, categoria, categoria_slug, data_pubblicazione, link, sintesi, team_id')
            .order('data_pubblicazione', { ascending: false }),
          supabase.from('lnd_rilievi')
            .select('id, comunicato_id, criterio, testo, scadenza, fonte, team_id, comunicato:lnd_comunicati(titolo, data_pubblicazione, link)')
            .order('scadenza', { ascending: true, nullsFirst: false }),
          supabase.from('lnd_gare')
            .select('id, competizione, girone, giornata, fase, data, ora, avversario, in_casa, fonte, team_id')
            .order('data', { ascending: true }),
          supabase.from('teams')
            .select('id, name, color, category, age_range')
            .order('name'),
        ])
        if (cRes.error) throw cRes.error
        if (rRes.error) throw rRes.error
        if (gRes.error) throw gRes.error
        if (tRes.error) throw tRes.error
        if (!alive) return
        setComunicati((cRes.data ?? []) as Comunicato[])
        const rows = (rRes.data ?? []) as any[]
        setRilievi(rows.map(r => ({
          ...r,
          comunicato: Array.isArray(r.comunicato) ? r.comunicato[0] : r.comunicato,
        })) as Rilievo[])
        setGare((gRes.data ?? []) as Gara[])
        setTeams(sortTeamsByAge((tRes.data ?? []) as TeamLite[]))
      } catch (e: unknown) {
        if (!alive) return
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  // Filtro per squadra selezionata:
  // - "Tutte" (null): mostra tutto
  // - Squadra X: mostra i record con team_id = X OPPURE team_id = NULL (trasversali)
  const filterByTeam = <T extends { team_id: string | null }>(items: T[]): T[] => {
    if (!selectedTeamId) return items
    return items.filter(x => x.team_id === selectedTeamId || x.team_id === null)
  }

  const filteredRilievi    = useMemo(() => filterByTeam(rilievi),    [rilievi,    selectedTeamId])
  const filteredComunicati = useMemo(() => filterByTeam(comunicati), [comunicati, selectedTeamId])
  const filteredGare       = useMemo(() => filterByTeam(gare),       [gare,       selectedTeamId])

  const scopeLabel = useMemo(() => {
    if (!selectedTeamId) return 'Tutte le squadre'
    return teams.find(t => t.id === selectedTeamId)?.name || 'Squadra'
  }, [selectedTeamId, teams])

  if (!isStaff) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#707882' }}>
        Area riservata allo staff societario.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 4px' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #005f98 0%, #003c5e 100%)',
        color: '#fff', padding: '14px 16px', borderRadius: 14,
      }}>
        <div style={{ fontSize: 11, letterSpacing: 0.4, opacity: 0.85, fontWeight: 700, textTransform: 'uppercase' }}>
          Lega Nazionale Dilettanti
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'Anybody, Arial Black, sans-serif', marginTop: 2 }}>
          COMUNICATI UFFICIALI
        </div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
          {filteredComunicati.length} comunicati · {filteredRilievi.length} rilievi · {filteredGare.length} gare
        </div>
      </div>

      {/* Selettore squadra */}
      <div>
        <label style={{
          display: 'block', fontSize: 10.5, fontWeight: 700, color: '#404751',
          textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 5,
        }}>
          Filtra per squadra
        </label>
        <select
          value={selectedTeamId ?? ''}
          onChange={e => setSelectedTeamId(e.target.value || null)}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 10,
            border: '1px solid #c0c7d2', background: '#fff',
            fontSize: 13, fontWeight: 700, color: '#181c20',
            fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          <option value="">🏆 Tutte le squadre</option>
          {teams.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {selectedTeamId && (
          <div style={{ marginTop: 6, fontSize: 10.5, color: '#707882' }}>
            💡 Sono mostrati gli argomenti specifici di <b>{scopeLabel}</b> più quelli trasversali (validi per tutte le squadre)
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }} className="hide-scrollbar">
        {TAB_META.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: '0 0 auto',
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 14px', borderRadius: 999,
              background: tab === t.key ? '#005f98' : '#fff',
              color: tab === t.key ? '#fff' : '#404751',
              border: '1px solid ' + (tab === t.key ? '#005f98' : '#c0c7d2'),
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            <Icon name={t.icon} size={14} color={tab === t.key ? '#fff' : '#404751'} />
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: '#707882', fontSize: 13 }}>
          Carico i comunicati…
        </div>
      )}

      {error && (
        <div style={{ padding: 12, background: '#ffe4e4', color: '#7a0000', borderRadius: 8, fontSize: 12 }}>
          ⚠ {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {tab === 'rilievi'    && <RilieviTab    rilievi={filteredRilievi} />}
          {tab === 'comunicati' && <ComunicatiTab comunicati={filteredComunicati} />}
          {tab === 'gare'       && <GareTab       gare={filteredGare} />}
        </>
      )}
    </div>
  )
}

// ============================================================
// TAB: RILIEVI (con filtro categoria)
// ============================================================

function RilieviTab({ rilievi }: { rilievi: Rilievo[] }) {
  const [filter, setFilter] = useState<Criterio | 'all'>('all')

  const counts = useMemo(() => {
    const c: Record<Criterio | 'all', number> = { all: rilievi.length, societa: 0, disciplinare: 0, scadenze: 0, gare: 0 }
    for (const r of rilievi) if (r.criterio in c) c[r.criterio]++
    return c
  }, [rilievi])

  const filtered = useMemo(() => {
    const arr = filter === 'all' ? rilievi : rilievi.filter(r => r.criterio === filter)
    // Ordino dal più recente al meno recente per data pubblicazione del comunicato.
    // A parità di data, i rilievi con scadenza più imminente vengono prima.
    return [...arr].sort((a, b) => {
      const dA = a.comunicato?.data_pubblicazione || ''
      const dB = b.comunicato?.data_pubblicazione || ''
      if (dA !== dB) return dB.localeCompare(dA)
      const sA = a.scadenza || '9999-12-31'
      const sB = b.scadenza || '9999-12-31'
      return sA.localeCompare(sB)
    })
  }, [rilievi, filter])

  const today = new Date().toISOString().slice(0, 10)

  return (
    <>
      {/* Filtri categoria */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <FilterPill
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label={`Tutti (${counts.all})`}
          color="#404751"
        />
        {(Object.keys(CRITERIO_META) as Criterio[]).map(k => (
          <FilterPill
            key={k}
            active={filter === k}
            onClick={() => setFilter(k)}
            label={`${CRITERIO_META[k].label} (${counts[k]})`}
            color={CRITERIO_META[k].color}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: 30, textAlign: 'center', color: '#707882', fontSize: 13 }}>
          Nessun rilievo per questo filtro.
        </div>
      )}

      <div style={{ display: 'grid', gap: 8 }}>
        {filtered.map(r => {
          const meta = CRITERIO_META[r.criterio] ?? CRITERIO_META.societa
          const scadenzaPassata = r.scadenza && r.scadenza < today
          const scadenzaVicina = r.scadenza && !scadenzaPassata && new Date(r.scadenza).getTime() - new Date(today).getTime() < 7 * 86400000

          return (
            <div key={r.id} style={{
              background: '#fff', border: '1px solid #e6e8ee', borderRadius: 12,
              padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8,
              borderLeft: `4px solid ${meta.color}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', borderRadius: 999,
                  background: meta.bg, color: meta.color,
                  fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3,
                }}>
                  <Icon name={meta.icon} size={12} color={meta.color} />
                  {meta.label}
                </span>

                {r.scadenza && (
                  <span style={{
                    padding: '3px 8px', borderRadius: 999,
                    background: scadenzaPassata ? '#ffe4e4' : scadenzaVicina ? '#fff4e6' : '#eef7ff',
                    color: scadenzaPassata ? '#93000a' : scadenzaVicina ? '#7c4700' : '#004a78',
                    fontSize: 10.5, fontWeight: 700,
                  }}>
                    {scadenzaPassata ? '⚠ Scaduto il ' : scadenzaVicina ? '⏰ Scade il ' : 'Scadenza: '}
                    {formatDate(r.scadenza)}
                  </span>
                )}
              </div>

              <div style={{ fontSize: 13.5, color: '#181c20', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                {highlightLenci(r.testo)}
              </div>

              {r.comunicato && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: '#707882', flexWrap: 'wrap' }}>
                  <Icon name="article" size={12} color="#707882" />
                  <span>{r.comunicato.titolo}</span>
                  <span>·</span>
                  <span>{formatDate(r.comunicato.data_pubblicazione)}</span>
                  {r.fonte && (<><span>·</span><span style={{ fontStyle: 'italic' }}>{r.fonte}</span></>)}
                  {r.comunicato.link && (
                    <>
                      <span>·</span>
                      <a href={r.comunicato.link} target="_blank" rel="noopener noreferrer"
                        style={{ color: '#005f98', fontWeight: 700, textDecoration: 'none' }}>
                        Apri PDF ↗
                      </a>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

// ============================================================
// TAB: COMUNICATI
// ============================================================

function ComunicatiTab({ comunicati }: { comunicati: Comunicato[] }) {
  if (comunicati.length === 0) {
    return <div style={{ padding: 30, textAlign: 'center', color: '#707882', fontSize: 13 }}>Nessun comunicato in archivio.</div>
  }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {comunicati.map(c => (
        <div key={c.id} style={{
          background: '#fff', border: '1px solid #e6e8ee', borderRadius: 12,
          padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              padding: '3px 8px', borderRadius: 999,
              background: '#eef7ff', color: '#004a78',
              fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3,
            }}>
              {c.categoria || 'Comunicato'}
            </span>
            <span style={{ fontSize: 11, color: '#707882', fontWeight: 700 }}>
              {formatDate(c.data_pubblicazione)}
            </span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#181c20', lineHeight: 1.35 }}>
            {highlightLenci(c.titolo)}
          </div>
          {c.sintesi && (
            <div style={{ fontSize: 12.5, color: '#404751', lineHeight: 1.5 }}>
              {highlightLenci(c.sintesi)}
            </div>
          )}
          {c.link && (
            <div style={{ marginTop: 4 }}>
              <a href={c.link} target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '7px 12px', borderRadius: 8,
                background: '#005f98', color: '#fff',
                fontSize: 11.5, fontWeight: 700, textDecoration: 'none',
              }}>
                <Icon name="picture_as_pdf" size={13} color="#fff" />
                Apri PDF ufficiale
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ============================================================
// TAB: GARE 1ª SQUADRA
// ============================================================

function GareTab({ gare }: { gare: Gara[] }) {
  const today = new Date().toISOString().slice(0, 10)

  if (gare.length === 0) {
    return <div style={{ padding: 30, textAlign: 'center', color: '#707882', fontSize: 13 }}>Nessuna gara in archivio.</div>
  }

  const nextIdx = gare.findIndex(g => g.data >= today)

  return (
    <>
      {gare[0]?.girone && (
        <div style={{
          padding: '10px 12px', background: '#f7f9ff', borderRadius: 10,
          fontSize: 12, color: '#404751',
        }}>
          <b>{gare[0].competizione}</b>{gare[0].girone ? ` — ${gare[0].girone}` : ''}
        </div>
      )}

      <div style={{ display: 'grid', gap: 6 }}>
        {gare.map((g, i) => {
          const past = g.data < today
          const isNext = i === nextIdx
          return (
            <div key={g.id} style={{
              background: '#fff',
              border: '1px solid ' + (isNext ? '#005f98' : '#e6e8ee'),
              borderRadius: 10,
              padding: '10px 12px',
              display: 'flex', alignItems: 'center', gap: 10,
              opacity: past ? 0.75 : 1,
              boxShadow: isNext ? '0 3px 12px rgba(0,95,152,0.20)' : 'none',
            }}>
              <div style={{
                width: 44, textAlign: 'center', flexShrink: 0,
                padding: '6px 4px', borderRadius: 8,
                background: isNext ? '#005f98' : past ? '#f0f2f5' : '#eef7ff',
                color: isNext ? '#fff' : past ? '#707882' : '#004a78',
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>G.</div>
                <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'Anybody, Arial Black, sans-serif', lineHeight: 1 }}>
                  {g.giornata ?? '—'}
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#181c20', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{g.in_casa ? '🏠' : '✈'}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.avversario}</span>
                  {isNext && (
                    <span style={{ fontSize: 9, background: '#005f98', color: '#fff', padding: '2px 6px', borderRadius: 999, fontWeight: 800 }}>
                      PROSSIMA
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#707882', marginTop: 2 }}>
                  {formatDate(g.data)}{g.ora ? ` · ${g.ora.slice(0, 5)}` : ''}
                  {g.fase ? ` · ${g.fase}` : ''}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ============================================================
// HELPERS
// ============================================================

function FilterPill({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 11px', borderRadius: 999,
        background: active ? color : '#fff',
        color: active ? '#fff' : color,
        border: `1px solid ${color}`,
        fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''))
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Evidenzia con <mark> giallo tenue e grassetto qualsiasi occorrenza di "Lenci"
// (con o senza "Poirino" subito dopo), preservando le newline del testo originale.
function highlightLenci(text: string): React.ReactNode[] {
  if (!text) return [text]
  // Divido il testo mantenendo i match tramite gruppo di cattura.
  // La regex qui è LOCALE (non riusata) per evitare il bug del lastIndex con flag g.
  const parts = text.split(/(\bLenci(?:\s+Poirino)?\b)/gi)
  return parts.map((part, i) => {
    // I match del gruppo capturing ricadono negli indici dispari (1, 3, 5...).
    // Per sicurezza, verifico esplicitamente col test non-globale.
    const isMatch = /^Lenci(?:\s+Poirino)?$/i.test(part)
    return isMatch
      ? <mark key={i} style={{
          background: '#fff3a0', color: '#5c3800', fontWeight: 800,
          padding: '0 3px', borderRadius: 3,
        }}>{part}</mark>
      : part
  })
}
