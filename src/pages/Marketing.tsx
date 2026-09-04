import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { Icon } from '../components/Icon'
import { MarketingEventEditSheet } from '../components/MarketingEventEditSheet'
import { MarketingPublishSheet } from '../components/MarketingPublishSheet'
import {
  CATEGORY_META, STATUS_META,
  type MarketingCategory, type MarketingStatus, type MarketingEvent,
} from '../lib/marketing'

const MONTH_LABELS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
const DOW_LABELS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

export function MarketingPage() {
  const { profile } = useAuth()
  const isMarketingUser = profile?.is_marketing === true

  const [view, setView] = useState<'calendar' | 'list' | 'kpi'>('calendar')
  const [events, setEvents] = useState<MarketingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<MarketingEvent | null>(null)
  const [creating, setCreating] = useState(false)
  const [publishing, setPublishing] = useState<MarketingEvent | null>(null)
  const [clubId, setClubId] = useState<string | null>(null)

  const [categoryFilter, setCategoryFilter] = useState<MarketingCategory | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<MarketingStatus | 'all'>('all')
  const [kpiFilter, setKpiFilter] = useState<'upcoming' | 'completed' | 'budget' | 'margin' | null>(null)

  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  useEffect(() => { if (isMarketingUser) load() }, [isMarketingUser])

  const load = async () => {
    setLoading(true)
    const [evRes, clubRes] = await Promise.all([
      supabase.from('marketing_events').select('*, responsible:profiles!responsible_id(id, full_name)').order('event_date'),
      supabase.from('clubs').select('id').limit(1).single(),
    ])
    setEvents((evRes.data ?? []) as any)
    setClubId(clubRes.data?.id ?? null)
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    let list = events.filter(e => {
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (kpiFilter === 'upcoming' && (e.event_date < todayStr || e.status === 'cancelled')) return false
      if (kpiFilter === 'completed' && e.status !== 'completed') return false
      if (kpiFilter === 'budget' && !(e.budget_actual ?? e.budget_estimated)) return false
      // 'margin' non filtra, ma ordina più sotto
      return true
    })
    // Ordinamento in base a kpiFilter
    if (kpiFilter === 'budget') {
      list = [...list].sort((a, b) => (b.budget_actual ?? b.budget_estimated ?? 0) - (a.budget_actual ?? a.budget_estimated ?? 0))
    } else if (kpiFilter === 'margin') {
      list = [...list].sort((a, b) => {
        const marginA = (a.revenue_actual ?? a.revenue_estimated ?? 0) - (a.budget_actual ?? a.budget_estimated ?? 0)
        const marginB = (b.revenue_actual ?? b.revenue_estimated ?? 0) - (b.budget_actual ?? b.budget_estimated ?? 0)
        return marginB - marginA
      })
    }
    return list
  }, [events, categoryFilter, statusFilter, kpiFilter])

  const KPI_LABELS: Record<Exclude<typeof kpiFilter, null>, string> = {
    upcoming:  'Solo prossimi eventi',
    completed: 'Solo eventi conclusi',
    budget:    'Ordinato per budget decrescente',
    margin:    'Ordinato per margine decrescente',
  }

  const openKpi = (k: 'upcoming' | 'completed' | 'budget' | 'margin') => {
    setKpiFilter(k)
    setCategoryFilter('all')
    setStatusFilter('all')
    setView('list')
  }

  // KPI aggregati
  const kpi = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const upcoming = events.filter(e => e.event_date >= today && e.status !== 'cancelled')
    const completed = events.filter(e => e.status === 'completed')
    const totalBudget = events.reduce((s, e) => s + (e.budget_actual ?? e.budget_estimated ?? 0), 0)
    const totalRevenue = events.reduce((s, e) => s + (e.revenue_actual ?? e.revenue_estimated ?? 0), 0)
    const totalAttendance = events.reduce((s, e) => s + (e.actual_attendance ?? e.estimated_attendance ?? 0), 0)
    return {
      total: events.length,
      upcoming: upcoming.length,
      completed: completed.length,
      totalBudget, totalRevenue, margin: totalRevenue - totalBudget,
      totalAttendance,
    }
  }, [events])

  if (!profile) return null
  if (!isMarketingUser) return <Navigate to="/" replace />

  return (
    <div className="max-w-md md:max-w-3xl mx-auto" style={{ padding: '18px 16px 32px' }}>
      {/* HEADER */}
      <div style={{
        background: 'linear-gradient(135deg, #7a0071 0%, #4a0044 100%)',
        borderRadius: 18, padding: '16px 18px', color: '#fff',
        boxShadow: '0 12px 28px rgba(122,0,113,0.25)', marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="campaign" size={18} color="#ffd100" />
          <span style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 800 }}>
            Area riservata Marketing
          </span>
        </div>
        <h1 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 22, margin: '4px 0 2px' }}>
          Eventi & Attività
        </h1>
        <p style={{ fontSize: 12.5, opacity: 0.9, margin: 0 }}>
          Pianifica, organizza e monitora eventi sociali e di fundraising per il club.
        </p>
      </div>

      {/* KPI STRIP - cliccabili */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12,
      }}>
        <KpiCard label="Prossimi" value={kpi.upcoming} icon="event" color="#005f98"
          active={kpiFilter === 'upcoming'} onClick={() => openKpi('upcoming')} />
        <KpiCard label="Conclusi" value={kpi.completed} icon="task_alt" color="#006e25"
          active={kpiFilter === 'completed'} onClick={() => openKpi('completed')} />
        <KpiCard label="Budget €" value={kpi.totalBudget.toFixed(0)} icon="account_balance_wallet" color="#8e6300"
          active={kpiFilter === 'budget'} onClick={() => openKpi('budget')} />
        <KpiCard label="Margine €" value={kpi.margin.toFixed(0)}
          icon={kpi.margin >= 0 ? 'trending_up' : 'trending_down'}
          color={kpi.margin >= 0 ? '#006e25' : '#ba1a1a'}
          active={kpiFilter === 'margin'} onClick={() => openKpi('margin')} />
      </div>

      {/* SWITCHER VIEW + Nuovo evento */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <div style={{
          display: 'flex', gap: 4, background: '#fff', padding: 4, borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,60,94,0.08)', flex: 1,
        }}>
          <ViewTab active={view === 'calendar'} onClick={() => { setView('calendar'); setKpiFilter(null) }} icon="calendar_month" label="Calendario" />
          <ViewTab active={view === 'list'} onClick={() => setView('list')} icon="list" label="Lista" />
          <ViewTab active={view === 'kpi'} onClick={() => { setView('kpi'); setKpiFilter(null) }} icon="analytics" label="Analisi" />
        </div>
        <button onClick={() => setCreating(true)}
          style={{
            padding: '10px 14px', borderRadius: 10, border: 'none',
            background: '#7a0071', color: '#fff', fontWeight: 800, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5,
            boxShadow: '0 4px 12px rgba(122,0,113,0.30)',
          }}>
          <Icon name="add" size={14} color="#fff" /> Nuovo
        </button>
      </div>

      {/* FILTRI (solo in lista/kpi) */}
      {view !== 'calendar' && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          <FilterChip label="Tutte" active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')} />
          {(Object.keys(CATEGORY_META) as MarketingCategory[]).map(c => (
            <FilterChip key={c} label={`${CATEGORY_META[c].emoji} ${CATEGORY_META[c].label}`}
              active={categoryFilter === c}
              onClick={() => setCategoryFilter(c)}
              color={CATEGORY_META[c].color} bg={CATEGORY_META[c].bg} />
          ))}
        </div>
      )}

      {/* Banner filtro KPI attivo */}
      {kpiFilter && view === 'list' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', marginBottom: 10, borderRadius: 10,
          background: '#7a0071', color: '#fff',
          boxShadow: '0 4px 12px rgba(122,0,113,0.20)',
        }}>
          <Icon name="filter_alt" size={14} color="#ffd100" />
          <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700 }}>
            {KPI_LABELS[kpiFilter]} · {filtered.length} {filtered.length === 1 ? 'evento' : 'eventi'}
          </span>
          <button onClick={() => setKpiFilter(null)}
            style={{
              background: 'rgba(255,255,255,0.20)', border: 'none',
              padding: '4px 8px', borderRadius: 6,
              display: 'inline-flex', alignItems: 'center', gap: 3,
              color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}>
            <Icon name="close" size={11} color="#fff" /> Rimuovi
          </button>
        </div>
      )}

      {/* CONTENT */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#707882' }}>Caricamento…</div>
      ) : view === 'calendar' ? (
        <CalendarView
          events={filtered} monthCursor={monthCursor} setMonthCursor={setMonthCursor}
          onEventClick={setEditing}
        />
      ) : view === 'list' ? (
        <ListView events={filtered} onEventClick={setEditing} />
      ) : (
        <AnalyticsView events={events} />
      )}

      {/* SHEETS */}
      <MarketingEventEditSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        event={editing}
        clubId={clubId}
        onSaved={() => { setEditing(null); load() }}
        onDeleted={() => { setEditing(null); load() }}
        onOpenPublish={(ev) => { setEditing(null); setPublishing(ev) }}
      />
      <MarketingEventEditSheet
        open={creating}
        onClose={() => setCreating(false)}
        event={null}
        clubId={clubId}
        onSaved={() => { setCreating(false); load() }}
      />
      <MarketingPublishSheet
        open={publishing !== null}
        onClose={() => setPublishing(null)}
        event={publishing}
        onPublished={() => { setPublishing(null); load() }}
      />
    </div>
  )
}

// ---------- CALENDAR VIEW ----------
function CalendarView({ events, monthCursor, setMonthCursor, onEventClick }: {
  events: MarketingEvent[]
  monthCursor: Date
  setMonthCursor: (d: Date) => void
  onEventClick: (e: MarketingEvent) => void
}) {
  const year = monthCursor.getFullYear()
  const month = monthCursor.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7 // lun=0
  const daysInMonth = lastDay.getDate()

  const days: Array<{ date: Date | null; events: MarketingEvent[] }> = []
  for (let i = 0; i < startDow; i++) days.push({ date: null, events: [] })
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d)
    const dtStr = dt.toISOString().slice(0, 10)
    days.push({ date: dt, events: events.filter(e => e.event_date === dtStr) })
  }
  while (days.length % 7 !== 0) days.push({ date: null, events: [] })

  const todayStr = new Date().toISOString().slice(0, 10)

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 14, boxShadow: '0 10px 24px rgba(0,120,191,0.06)' }}>
      {/* Nav mese */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button onClick={() => setMonthCursor(new Date(year, month - 1, 1))}
          style={navBtn}><Icon name="chevron_left" size={18} color="#005f98" /></button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 16, color: '#181c20' }}>
            {MONTH_LABELS[month]} {year}
          </div>
          <button onClick={() => { const t = new Date(); setMonthCursor(new Date(t.getFullYear(), t.getMonth(), 1)) }}
            style={{ background: 'transparent', border: 'none', color: '#005f98', fontSize: 10.5, fontWeight: 700, cursor: 'pointer', padding: 0, marginTop: 2 }}>
            Oggi
          </button>
        </div>
        <button onClick={() => setMonthCursor(new Date(year, month + 1, 1))}
          style={navBtn}><Icon name="chevron_right" size={18} color="#005f98" /></button>
      </div>

      {/* Header giorni settimana */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
        {DOW_LABELS.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 800, color: '#707882' }}>{d}</div>
        ))}
      </div>

      {/* Griglia giorni */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {days.map((d, i) => {
          if (!d.date) return <div key={i} />
          const isToday = d.date.toISOString().slice(0, 10) === todayStr
          return (
            <div key={i} style={{
              minHeight: 62, padding: 4, borderRadius: 6,
              background: isToday ? 'rgba(0,95,152,0.10)' : '#f7f9ff',
              display: 'flex', flexDirection: 'column', gap: 2,
              border: isToday ? '1px solid #005f98' : '1px solid transparent',
            }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: isToday ? '#005f98' : '#181c20', textAlign: 'right' }}>
                {d.date.getDate()}
              </div>
              {d.events.slice(0, 2).map(ev => {
                const meta = CATEGORY_META[ev.category]
                return (
                  <button key={ev.id} onClick={() => onEventClick(ev)}
                    title={ev.title}
                    style={{
                      background: meta.color, color: '#fff',
                      padding: '2px 4px', borderRadius: 4,
                      fontSize: 9, fontWeight: 700,
                      textAlign: 'left', border: 'none', cursor: 'pointer',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                    {meta.emoji} {ev.title}
                  </button>
                )
              })}
              {d.events.length > 2 && (
                <div style={{ fontSize: 8.5, color: '#707882', textAlign: 'center' }}>+{d.events.length - 2}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- LIST VIEW ----------
function ListView({ events, onEventClick }: { events: MarketingEvent[]; onEventClick: (e: MarketingEvent) => void }) {
  if (events.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#707882', background: '#fff', borderRadius: 14 }}>
        <Icon name="event_busy" size={32} color="#c0c7d2" />
        <p style={{ margin: '8px 0 0', fontSize: 13 }}>Nessun evento trovato per i filtri selezionati.</p>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {events.map(ev => {
        const meta = CATEGORY_META[ev.category]
        const stat = STATUS_META[ev.status]
        return (
          <button key={ev.id} onClick={() => onEventClick(ev)}
            style={{
              background: '#fff', border: `1px solid ${meta.color}30`,
              borderLeft: `4px solid ${meta.color}`,
              borderRadius: 12, padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
              display: 'flex', flexDirection: 'column', gap: 6,
              boxShadow: '0 4px 12px rgba(0,120,191,0.04)',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>{meta.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#181c20', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ev.title}
                </div>
                <div style={{ fontSize: 11, color: '#707882', marginTop: 1 }}>
                  {new Date(ev.event_date).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                  {ev.start_time && ` · ${ev.start_time.slice(0, 5)}`}
                  {ev.location && ` · ${ev.location}`}
                </div>
              </div>
              <span style={{
                background: stat.bg, color: stat.color, fontSize: 10, fontWeight: 800,
                padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap',
              }}>{stat.label}</span>
              {ev.is_published_calendar && (
                <span title="Pubblicato in calendario condiviso" style={{
                  background: '#006e25', color: '#fff', fontSize: 10, fontWeight: 800,
                  padding: '3px 6px', borderRadius: 999,
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                }}>
                  <Icon name="public" size={10} color="#fff" /> PUB
                </span>
              )}
            </div>
            {ev.description && (
              <div style={{ fontSize: 12, color: '#404751', lineHeight: 1.4 }}>
                {ev.description.length > 140 ? ev.description.slice(0, 140) + '…' : ev.description}
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#707882', flexWrap: 'wrap' }}>
              {ev.estimated_attendance != null && (
                <span><Icon name="groups" size={11} color="#707882" /> {ev.actual_attendance ?? ev.estimated_attendance} partecipanti</span>
              )}
              {(ev.budget_actual ?? ev.budget_estimated) != null && (
                <span><Icon name="euro" size={11} color="#707882" /> Budget € {(ev.budget_actual ?? ev.budget_estimated)?.toFixed(0)}</span>
              )}
              {(ev.revenue_actual ?? ev.revenue_estimated) != null && (
                <span><Icon name="trending_up" size={11} color="#006e25" /> Ricavi € {(ev.revenue_actual ?? ev.revenue_estimated)?.toFixed(0)}</span>
              )}
              {ev.checklist && ev.checklist.length > 0 && (
                <span><Icon name="checklist" size={11} color="#707882" /> {ev.checklist.filter(c => c.done).length}/{ev.checklist.length}</span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ---------- ANALYTICS VIEW ----------
function AnalyticsView({ events }: { events: MarketingEvent[] }) {
  // Aggregato per categoria
  const byCategory = useMemo(() => {
    const map = new Map<MarketingCategory, { count: number; budget: number; revenue: number }>()
    for (const e of events) {
      if (!map.has(e.category)) map.set(e.category, { count: 0, budget: 0, revenue: 0 })
      const v = map.get(e.category)!
      v.count++
      v.budget += (e.budget_actual ?? e.budget_estimated ?? 0)
      v.revenue += (e.revenue_actual ?? e.revenue_estimated ?? 0)
    }
    return Array.from(map.entries()).map(([cat, v]) => ({ cat, ...v })).sort((a, b) => b.count - a.count)
  }, [events])

  const totalCount = events.length

  if (totalCount === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#707882', background: '#fff', borderRadius: 14 }}>
        <Icon name="analytics" size={32} color="#c0c7d2" />
        <p style={{ margin: '8px 0 0', fontSize: 13 }}>Nessun dato ancora — crea il tuo primo evento per vedere le analisi.</p>
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 10px 24px rgba(0,120,191,0.06)' }}>
      <h3 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 15, color: '#181c20', margin: '0 0 12px' }}>
        Ripartizione per categoria
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {byCategory.map(c => {
          const meta = CATEGORY_META[c.cat]
          const pct = totalCount > 0 ? Math.round((c.count / totalCount) * 100) : 0
          const margin = c.revenue - c.budget
          return (
            <div key={c.cat}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3, fontSize: 12 }}>
                <span style={{ fontWeight: 700, color: meta.color }}>
                  {meta.emoji} {meta.label}
                </span>
                <span style={{ color: '#707882' }}>
                  {c.count} {c.count === 1 ? 'evento' : 'eventi'} · <strong>{pct}%</strong>
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: '#e6e8ee', overflow: 'hidden', marginBottom: 3 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: meta.color }} />
              </div>
              {(c.budget > 0 || c.revenue > 0) && (
                <div style={{ fontSize: 10.5, color: '#707882', display: 'flex', gap: 12 }}>
                  {c.budget > 0 && <span>Budget: € {c.budget.toFixed(0)}</span>}
                  {c.revenue > 0 && <span>Ricavi: € {c.revenue.toFixed(0)}</span>}
                  <span style={{ color: margin >= 0 ? '#006e25' : '#ba1a1a', fontWeight: 700 }}>
                    Margine: € {margin.toFixed(0)}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- SUB-COMPONENTS ----------
function KpiCard({ label, value, icon, color, active, onClick }: {
  label: string; value: string | number; icon: string; color: string;
  active?: boolean; onClick?: () => void;
}) {
  return (
    <button onClick={onClick}
      style={{
        background: active ? color : '#fff', borderRadius: 12, padding: 10,
        boxShadow: active ? `0 6px 18px ${color}40` : '0 4px 12px rgba(0,120,191,0.05)',
        display: 'flex', flexDirection: 'column', gap: 3,
        border: active ? `2px solid ${color}` : '2px solid transparent',
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left', transition: 'transform 0.1s, box-shadow 0.1s',
        transform: active ? 'translateY(-1px)' : 'translateY(0)',
      }}>
      <Icon name={icon} size={16} color={active ? '#fff' : color} />
      <div style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 17, color: active ? '#fff' : '#181c20', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 9.5, color: active ? 'rgba(255,255,255,0.9)' : '#707882', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
    </button>
  )
}

function ViewTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button onClick={onClick}
      style={{
        flex: 1, padding: '8px 10px', borderRadius: 8, border: 'none',
        background: active ? '#7a0071' : 'transparent',
        color: active ? '#fff' : '#404751',
        fontSize: 12, fontWeight: 700, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
      }}>
      <Icon name={icon} size={13} color={active ? '#fff' : '#707882'} /> {label}
    </button>
  )
}

function FilterChip({ label, active, onClick, color, bg }: { label: string; active: boolean; onClick: () => void; color?: string; bg?: string }) {
  return (
    <button onClick={onClick}
      style={{
        padding: '5px 10px', borderRadius: 999, border: 'none', cursor: 'pointer',
        background: active ? (color || '#7a0071') : (bg || '#fff'),
        color: active ? '#fff' : (color || '#404751'),
        fontSize: 11, fontWeight: 700,
      }}>{label}</button>
  )
}

const navBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, border: 'none',
  background: '#f7f9ff', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
