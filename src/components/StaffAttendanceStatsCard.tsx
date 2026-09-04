import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Icon } from './Icon'

interface StaffStatRow {
  kind: 'training' | 'match'
  total_events: number
  present_count: number
  absent_count: number
  late_count: number
  excused_count: number
  percent_present: number
}

/**
 * Mostra le statistiche presenze del profilo corrente ad allenamenti e partite.
 * Da montare nel Profile solo se il profilo è staff di almeno una squadra.
 */
export function StaffAttendanceStatsCard() {
  const [rows, setRows] = useState<StaffStatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [hasStaffRole, setHasStaffRole] = useState(false)

  useEffect(() => {
    supabase.rpc('my_staff_attendance_stats').then(({ data, error }) => {
      if (error) { setLoading(false); return }
      const stats = (data ?? []) as StaffStatRow[]
      setRows(stats)
      // Mostro la card solo se c'è almeno un evento in cui questo profilo era staff
      setHasStaffRole(stats.some(r => r.total_events > 0))
      setLoading(false)
    })
  }, [])

  if (loading) return null
  if (!hasStaffRole) return null  // nascondo se non ha eventi tracciati (es. genitori)

  const trainingRow = rows.find(r => r.kind === 'training')
  const matchRow = rows.find(r => r.kind === 'match')

  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: 18,
      boxShadow: '0 6px 20px rgba(0,120,191,0.06)',
      border: '1px solid #e6e8ee',
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 800, color: '#005f98',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Icon name="event_available" size={13} color="#005f98" />
        Le mie presenze
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: (trainingRow?.total_events || 0) > 0 && (matchRow?.total_events || 0) > 0 ? '1fr 1fr' : '1fr',
        gap: 10,
      }}>
        {trainingRow && trainingRow.total_events > 0 && (
          <StatBlock
            title="Allenamenti"
            icon="fitness_center"
            iconColor="#005f98"
            iconBg="#eef7ff"
            stat={trainingRow}
          />
        )}
        {matchRow && matchRow.total_events > 0 && (
          <StatBlock
            title="Partite"
            icon="sports_soccer"
            iconColor="#c1006c"
            iconBg="#faedf7"
            stat={matchRow}
          />
        )}
      </div>

      <div style={{ fontSize: 10.5, color: '#707882', marginTop: 10, fontStyle: 'italic', lineHeight: 1.4 }}>
        Le presenze le registrano gli allenatori o i dirigenti dopo l'evento. Se manca qualcosa, segnalalo a chi cura le presenze della squadra.
      </div>
    </div>
  )
}

function StatBlock({ title, icon, iconColor, iconBg, stat }: {
  title: string
  icon: string
  iconColor: string
  iconBg: string
  stat: StaffStatRow
}) {
  const pct = stat.percent_present
  const pctColor = pct >= 80 ? '#2e7d32' : pct >= 60 ? '#8e6300' : '#c62828'
  return (
    <div style={{
      background: '#f7f9ff', borderRadius: 12, padding: 12,
      border: '1px solid #d5e5ff',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={icon} size={17} color={iconColor} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#181c20' }}>
          {title}
        </div>
      </div>

      <div style={{
        fontFamily: 'Anybody', fontWeight: 800, fontSize: 26, color: pctColor,
        lineHeight: 1, marginBottom: 4,
      }}>
        {pct}%
      </div>
      <div style={{ fontSize: 11, color: '#404751', marginBottom: 8 }}>
        Presente in {stat.present_count + stat.late_count}/{stat.total_events} eventi
      </div>

      {/* Pill dettaglio */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {stat.present_count > 0 && <Pill label="Presente" val={stat.present_count} bg="#e8f5e9" color="#2e7d32" />}
        {stat.late_count > 0 && <Pill label="In ritardo" val={stat.late_count} bg="#fff4e6" color="#8e6300" />}
        {stat.excused_count > 0 && <Pill label="Giustif." val={stat.excused_count} bg="#eef7ff" color="#004a78" />}
        {stat.absent_count > 0 && <Pill label="Assente" val={stat.absent_count} bg="#ffe4e4" color="#c62828" />}
      </div>
    </div>
  )
}

function Pill({ label, val, bg, color }: { label: string; val: number; bg: string; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
      background: bg, color,
    }}>{val} {label}</span>
  )
}
