import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { useTeamStaff } from '../hooks/useTeamStaff'
import { Icon } from './Icon'
import { useToast } from './Toast'

type StaffStatus = 'present' | 'absent' | 'late' | 'excused'

interface Props {
  eventKind: 'training' | 'match'
  eventId: string
}

const STATUS_META: Record<StaffStatus, { label: string; color: string; bg: string }> = {
  present:  { label: 'Presente',   color: '#2e7d32', bg: '#e8f5e9' },
  absent:   { label: 'Assente',    color: '#c62828', bg: '#ffe4e4' },
  late:     { label: 'In ritardo', color: '#8e6300', bg: '#fff4e6' },
  excused:  { label: 'Giustif.',   color: '#004a78', bg: '#eef7ff' },
}

const STATUS_CYCLE: StaffStatus[] = ['present', 'absent', 'late', 'excused']

export function StaffAttendanceSection({ eventKind, eventId }: Props) {
  const { profile } = useAuth()
  const { showToast } = useToast()
  const [teamId, setTeamId] = useState<string | null>(null)
  const { staff, loading: staffLoading } = useTeamStaff(teamId)
  const [attendance, setAttendance] = useState<Record<string, StaffStatus>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)

  // Risolvo il teamId dall'event id (trainings o matches)
  useEffect(() => {
    if (!eventId) { setTeamId(null); return }
    const table = eventKind === 'training' ? 'trainings' : 'matches'
    supabase.from(table).select('team_id').eq('id', eventId).maybeSingle()
      .then(({ data }) => setTeamId(data?.team_id ?? null))
  }, [eventKind, eventId])

  useEffect(() => {
    if (!eventId) return
    setLoading(true)
    supabase.from('staff_attendances')
      .select('profile_id, status')
      .eq('event_kind', eventKind)
      .eq('event_id', eventId)
      .then(({ data }) => {
        const map: Record<string, StaffStatus> = {}
        for (const r of data ?? []) map[r.profile_id] = r.status as StaffStatus
        setAttendance(map)
        setLoading(false)
      })
  }, [eventKind, eventId])

  const cycleStatus = async (profileId: string) => {
    const current = attendance[profileId] ?? 'absent'
    const idx = STATUS_CYCLE.indexOf(current)
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
    setSaving(profileId)
    // Optimistic
    setAttendance(prev => ({ ...prev, [profileId]: next }))
    try {
      const { error } = await supabase.from('staff_attendances').upsert({
        event_kind: eventKind,
        event_id: eventId,
        profile_id: profileId,
        status: next,
        recorded_by: profile?.id ?? null,
        recorded_at: new Date().toISOString(),
      }, { onConflict: 'event_kind,event_id,profile_id' })
      if (error) throw error
    } catch (e: any) {
      // Rollback ottimistico
      setAttendance(prev => ({ ...prev, [profileId]: current }))
      showToast(e.message || 'Errore salvataggio', 'error')
    } finally {
      setSaving(null)
    }
  }

  if (staffLoading) return null
  if (staff.length === 0) return null  // nessuno staff assegnato → nulla da mostrare

  return (
    <div style={{
      background: '#f7f9ff', borderRadius: 12, padding: 12,
      border: '1px solid #d5e5ff', marginTop: 12,
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 800, color: '#004a78',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Icon name="badge" size={13} color="#004a78" />
        Presenze staff {loading && <span style={{ fontWeight: 500 }}>· carico…</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {staff.map(m => {
          const st = attendance[m.profile_id] ?? 'absent'
          const meta = STATUS_META[st]
          const isSaving = saving === m.profile_id
          return (
            <button
              key={m.profile_id}
              onClick={() => cycleStatus(m.profile_id)}
              disabled={isSaving}
              style={{
                background: '#fff', border: '1px solid #e6e8ee', borderRadius: 10,
                padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                opacity: isSaving ? 0.6 : 1,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#181c20', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.full_name}
                </div>
                <div style={{ fontSize: 10.5, color: '#707882', textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: 700 }}>
                  {m.role_label}
                </div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999,
                background: meta.bg, color: meta.color, whiteSpace: 'nowrap',
              }}>
                {meta.label}
              </span>
            </button>
          )
        })}
      </div>

      <div style={{ fontSize: 10.5, color: '#707882', marginTop: 8, fontStyle: 'italic', lineHeight: 1.4 }}>
        Tocca un membro dello staff per cambiare stato (Presente → Assente → In ritardo → Giustif.). Le presenze compaiono nel profilo del mister.
      </div>
    </div>
  )
}
