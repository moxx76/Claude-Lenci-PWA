import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Icon } from './Icon'
import { StaffAttendanceDetailSheet } from './StaffAttendanceDetailSheet'
import { ShuttleHistorySheet, type ShuttleService } from './ShuttleServiceCard'

interface StaffRow {
  profile_id: string
  full_name: string
  kind: 'training' | 'match'
  total_events: number
  present_count: number
  absent_count: number
  late_count: number
  excused_count: number
  tracked_count: number
  percent_present: number
}

interface ShuttleRow {
  driver_id: string
  full_name: string
  total_services: number
  month_services: number
  last_service: string | null
}

type Tab = 'training' | 'match' | 'shuttle'

const TAB_META: Record<Tab, { label: string; icon: string; color: string }> = {
  training: { label: 'Allenamenti', icon: 'fitness_center', color: '#005f98' },
  match:    { label: 'Partite',     icon: 'sports_soccer',  color: '#c1006c' },
  shuttle:  { label: 'Navetta',     icon: 'airport_shuttle', color: '#c47f00' },
}

/**
 * Card riservata ad admin/director: panoramica presenze staff (allenamenti+partite)
 * e servizi navetta di ogni autista. Alimentata da due RPC SECURITY DEFINER che
 * verificano i permessi lato server, quindi safe da mostrare solo dalla UI.
 */
export function AdminStaffOverviewCard() {
  const [tab, setTab] = useState<Tab>('training')
  const [staffRows, setStaffRows] = useState<StaffRow[]>([])
  const [shuttleRows, setShuttleRows] = useState<ShuttleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Sheet dettaglio presenze staff
  const [staffSheet, setStaffSheet] = useState<{ profileId: string; fullName: string; kind: 'training' | 'match' } | null>(null)

  // Sheet dettaglio servizi navetta (driver diverso ogni volta)
  const [shuttleSheet, setShuttleSheet] = useState<{ driverId: string; driverName: string } | null>(null)
  const [shuttleServices, setShuttleServices] = useState<ShuttleService[]>([])

  const loadAll = () => {
    setLoading(true); setError(null)
    Promise.all([
      supabase.rpc('admin_staff_attendance_overview'),
      supabase.rpc('admin_shuttle_overview'),
    ]).then(([staffRes, shuttleRes]) => {
      if (staffRes.error) throw staffRes.error
      if (shuttleRes.error) throw shuttleRes.error
      setStaffRows((staffRes.data ?? []) as StaffRow[])
      setShuttleRows((shuttleRes.data ?? []) as ShuttleRow[])
    }).catch((e: any) => setError(e.message || 'Errore caricamento'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadAll() }, [])

  // Quando l'admin apre lo sheet servizi navetta di un autista, faccio fetch dei suoi servizi
  const openShuttleSheet = async (driverId: string, driverName: string) => {
    const { data } = await supabase.from('shuttle_services')
      .select('id, service_date, notes, created_at')
      .eq('driver_id', driverId)
      .order('service_date', { ascending: false })
    setShuttleServices((data ?? []) as ShuttleService[])
    setShuttleSheet({ driverId, driverName })
  }

  const reloadShuttleServices = async () => {
    if (!shuttleSheet) return
    const { data } = await supabase.from('shuttle_services')
      .select('id, service_date, notes, created_at')
      .eq('driver_id', shuttleSheet.driverId)
      .order('service_date', { ascending: false })
    setShuttleServices((data ?? []) as ShuttleService[])
    loadAll()  // aggiorno anche i contatori della card principale
  }

  const activeMeta = TAB_META[tab]

  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: 16,
      boxShadow: '0 6px 20px rgba(0,120,191,0.05)',
      border: '1px solid #e6e8ee',
    }}>
      {/* Header */}
      <div style={{
        fontSize: 10.5, fontWeight: 800, color: '#005f98',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Icon name="admin_panel_settings" size={13} color="#005f98" />
        Panoramica staff · solo admin
      </div>

      {/* Tab switcher */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4,
        background: '#f1f3fa', padding: 3, borderRadius: 10, marginBottom: 12,
      }}>
        {(Object.keys(TAB_META) as Tab[]).map(t => {
          const m = TAB_META[t]
          const active = t === tab
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 4px', borderRadius: 8, border: 'none',
                background: active ? '#fff' : 'transparent',
                color: active ? m.color : '#707882',
                fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: active ? '0 2px 6px rgba(0,60,94,0.08)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                transition: 'all 0.15s',
              }}
            >
              <Icon name={m.icon} size={13} color={active ? m.color : '#707882'} />
              {m.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {loading && <div style={{ textAlign: 'center', padding: 20, color: '#707882', fontSize: 12 }}>Carico dati…</div>}
      {error && (
        <div style={{ background: '#ffe4e4', color: '#93000a', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
          ⚠ {error}
        </div>
      )}
      {!loading && !error && (
        <>
          {tab === 'training' && (
            <StaffList
              rows={staffRows.filter(r => r.kind === 'training')}
              accent={activeMeta.color}
              emptyText="Nessuna presenza registrata agli allenamenti"
              onRowClick={(r) => setStaffSheet({ profileId: r.profile_id, fullName: r.full_name, kind: 'training' })}
            />
          )}
          {tab === 'match' && (
            <StaffList
              rows={staffRows.filter(r => r.kind === 'match')}
              accent={activeMeta.color}
              emptyText="Nessuna presenza registrata alle partite"
              onRowClick={(r) => setStaffSheet({ profileId: r.profile_id, fullName: r.full_name, kind: 'match' })}
            />
          )}
          {tab === 'shuttle' && (
            <ShuttleList
              rows={shuttleRows}
              onRowClick={(r) => openShuttleSheet(r.driver_id, r.full_name)}
            />
          )}
        </>
      )}

      {/* Sheet dettaglio presenze staff (correggibili) */}
      {staffSheet && (
        <StaffAttendanceDetailSheet
          open={true}
          onClose={() => setStaffSheet(null)}
          profileId={staffSheet.profileId}
          fullName={staffSheet.fullName}
          kind={staffSheet.kind}
          onChanged={loadAll}
        />
      )}

      {/* Sheet dettaglio servizi navetta autista (add/delete date) */}
      {shuttleSheet && (
        <ShuttleHistorySheet
          open={true}
          onClose={() => setShuttleSheet(null)}
          services={shuttleServices}
          onChanged={reloadShuttleServices}
          driverId={shuttleSheet.driverId}
          driverName={shuttleSheet.driverName}
        />
      )}
    </div>
  )
}

// =====================================================
// Lista presenze staff (per allenamenti o partite)
// Righe cliccabili → aprono lo sheet detail per correzioni
// =====================================================
function StaffList({ rows, accent, emptyText, onRowClick }: {
  rows: StaffRow[]; accent: string; emptyText: string
  onRowClick: (r: StaffRow) => void
}) {
  if (rows.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 20, color: '#707882', fontSize: 12, fontStyle: 'italic' }}>
        {emptyText}
      </div>
    )
  }

  // Ordina per % presenza discendente (chi è più presente in alto)
  const sorted = [...rows].sort((a, b) => b.percent_present - a.percent_present)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {sorted.map(r => {
        const pct = r.percent_present
        const pctColor = pct >= 80 ? '#2e7d32' : pct >= 60 ? '#8e6300' : '#c62828'
        const untracked = r.total_events - r.tracked_count
        return (
          <button
            key={r.profile_id}
            onClick={() => onRowClick(r)}
            style={{
              background: '#f7f9ff', border: '1px solid #d5e5ff', borderRadius: 10,
              padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#eef7ff')}
            onMouseLeave={e => (e.currentTarget.style.background = '#f7f9ff')}
          >
            {/* % grande a sinistra */}
            <div style={{
              minWidth: 52, textAlign: 'center',
              background: '#fff', borderRadius: 8, padding: '6px 4px',
              border: `1px solid ${pctColor}30`,
            }}>
              <div style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 16, color: pctColor, lineHeight: 1 }}>
                {pct}%
              </div>
              <div style={{ fontSize: 8.5, color: '#707882', fontWeight: 700, marginTop: 2 }}>
                {r.present_count + r.late_count}/{r.total_events}
              </div>
            </div>

            {/* Info persona */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#181c20', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.full_name}
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                {r.present_count > 0 && <Pill val={r.present_count} label="ok" bg="#e8f5e9" color="#2e7d32" />}
                {r.late_count > 0 && <Pill val={r.late_count} label="ritardo" bg="#fff4e6" color="#8e6300" />}
                {r.excused_count > 0 && <Pill val={r.excused_count} label="giust." bg="#eef7ff" color="#004a78" />}
                {r.absent_count > 0 && <Pill val={r.absent_count} label="ass." bg="#ffe4e4" color="#c62828" />}
                {untracked > 0 && <Pill val={untracked} label="non firmate" bg="#f1f3fa" color="#707882" />}
              </div>
            </div>

            <Icon name="edit" size={14} color={accent} />
          </button>
        )
      })}
    </div>
  )
}

// =====================================================
// Lista servizi navetta per autista - riga cliccabile per gestione dettaglio
// =====================================================
function ShuttleList({ rows, onRowClick }: {
  rows: ShuttleRow[]
  onRowClick: (r: ShuttleRow) => void
}) {
  if (rows.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 20, color: '#707882', fontSize: 12, fontStyle: 'italic' }}>
        Nessun autista designato al momento
      </div>
    )
  }

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—'
    const d = new Date(iso + 'T12:00:00')
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map(r => (
        <button
          key={r.driver_id}
          onClick={() => onRowClick(r)}
          style={{
            background: '#fff8e6', border: '1px solid #ffe0a3', borderRadius: 10,
            padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#fff0cc')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff8e6')}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 8, background: '#c47f00',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="airport_shuttle" size={18} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#181c20', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.full_name}
            </div>
            <div style={{ fontSize: 10.5, color: '#7c4700', marginTop: 2 }}>
              Ultimo: <b>{fmtDate(r.last_service)}</b>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 20, color: '#c47f00', lineHeight: 1 }}>
                {r.month_services}
              </div>
              <div style={{ fontSize: 8.5, color: '#7c4700', fontWeight: 700, marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                mese
              </div>
            </div>
            <div style={{ width: 1, height: 28, background: '#ffe0a3' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 20, color: '#5c3800', lineHeight: 1 }}>
                {r.total_services}
              </div>
              <div style={{ fontSize: 8.5, color: '#7c4700', fontWeight: 700, marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                totale
              </div>
            </div>
            <Icon name="edit" size={14} color="#c47f00" />
          </div>
        </button>
      ))}
    </div>
  )
}

function Pill({ val, label, bg, color }: { val: number; label: string; bg: string; color: string }) {
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
      background: bg, color,
    }}>{val} {label}</span>
  )
}
