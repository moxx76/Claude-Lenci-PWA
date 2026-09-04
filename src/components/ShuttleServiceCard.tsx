import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { Icon } from './Icon'
import { useToast } from './Toast'
import { BottomSheet } from './BottomSheet'

export interface ShuttleService {
  id: string
  service_date: string
  notes: string | null
  created_at: string
}

/**
 * Card visibile nella dashboard solo se profile.is_shuttle_driver = true.
 * Consente all'autista di:
 *   - Segnare "ho fatto il servizio navetta oggi" con un tap
 *   - Vedere il totale servizi svolti (stagione corrente + storico)
 *   - Aprire uno sheet per registrare/eliminare servizi di date passate
 */
export function ShuttleServiceCard() {
  const { profile } = useAuth()
  const { showToast } = useToast()
  const [services, setServices] = useState<ShuttleService[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  // Se non è autista, la card non si monta
  if (!profile?.is_shuttle_driver) return null

  const load = () => {
    if (!profile?.id) return
    setLoading(true)
    supabase.from('shuttle_services')
      .select('id, service_date, notes, created_at')
      .eq('driver_id', profile.id)
      .order('service_date', { ascending: false })
      .then(({ data }) => {
        setServices((data ?? []) as ShuttleService[])
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [profile?.id])

  // Data locale ISO (evito bug UTC)
  const todayIso = (() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })()

  const todayService = services.find(s => s.service_date === todayIso)
  const total = services.length

  // Statistica mese corrente
  const currentMonth = todayIso.slice(0, 7)
  const monthCount = services.filter(s => s.service_date.startsWith(currentMonth)).length

  const toggleToday = async () => {
    if (!profile?.id) return
    setToggling(true)
    try {
      if (todayService) {
        // Cancella il servizio di oggi
        const { error } = await supabase.from('shuttle_services').delete().eq('id', todayService.id)
        if (error) throw error
        showToast('Servizio di oggi annullato', 'success')
      } else {
        // Registra il servizio di oggi
        const { error } = await supabase.from('shuttle_services').insert({
          driver_id: profile.id,
          service_date: todayIso,
        })
        if (error) throw error
        showToast('Servizio navetta registrato', 'success')
      }
      load()
    } catch (e: any) {
      showToast(e.message || 'Errore salvataggio', 'error')
    } finally {
      setToggling(false)
    }
  }

  return (
    <>
      <div style={{
        background: 'linear-gradient(135deg, #005f98 0%, #003c5e 100%)',
        borderRadius: 18, padding: 18, color: '#fff',
        boxShadow: '0 10px 24px rgba(0,60,94,0.25)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="airport_shuttle" size={22} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.85 }}>
              Servizio navetta
            </div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>
              Registra i tuoi viaggi
            </div>
          </div>
        </div>

        {/* Contatori */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12,
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.14)', borderRadius: 10, padding: '10px 12px',
          }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.3 }}>
              Questo mese
            </div>
            <div style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 26, lineHeight: 1, marginTop: 2 }}>
              {monthCount}
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.14)', borderRadius: 10, padding: '10px 12px',
          }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.3 }}>
              Totale
            </div>
            <div style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 26, lineHeight: 1, marginTop: 2 }}>
              {total}
            </div>
          </div>
        </div>

        {/* Bottone toggle */}
        <button
          onClick={toggleToday}
          disabled={toggling || loading}
          style={{
            width: '100%', padding: '12px 16px', borderRadius: 12, border: 'none',
            background: todayService ? '#fff' : '#c47f00',
            color: todayService ? '#005f98' : '#fff',
            fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: (toggling || loading) ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
        >
          <Icon
            name={todayService ? 'check_circle' : 'add_circle'}
            size={17}
            color={todayService ? '#005f98' : '#fff'}
          />
          {todayService ? 'Servizio di oggi registrato — Annulla' : 'Segna servizio di oggi'}
        </button>

        {/* Link storico */}
        <button
          onClick={() => setHistoryOpen(true)}
          style={{
            width: '100%', padding: '8px', border: 'none', background: 'transparent',
            color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            textDecoration: 'underline', opacity: 0.85, marginTop: 6,
          }}
        >
          Vedi storico e aggiungi date passate →
        </button>
      </div>

      {/* Sheet storico */}
      <ShuttleHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        services={services}
        onChanged={load}
        driverId={profile.id}
      />
    </>
  )
}

// ============================================================
// Sheet storico servizi con possibilità aggiunta date passate + eliminazione
// Esportato per essere riutilizzato dalla dashboard admin (Palermo & co.)
// ============================================================

export function ShuttleHistorySheet({ open, onClose, services, onChanged, driverId, driverName }: {
  open: boolean
  onClose: () => void
  services: ShuttleService[]
  onChanged: () => void
  driverId: string
  driverName?: string  // opzionale: se admin apre lo sheet per un OTHER driver
}) {
  const { showToast } = useToast()
  const [newDate, setNewDate] = useState('')
  const [saving, setSaving] = useState(false)

  const todayIso = (() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })()

  const addPastService = async () => {
    if (!newDate) return
    if (newDate > todayIso) {
      showToast('Non puoi registrare un servizio nel futuro', 'error')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('shuttle_services').insert({
        driver_id: driverId, service_date: newDate,
      })
      if (error) {
        if (error.code === '23505') {
          showToast('Servizio già registrato per questa data', 'error')
        } else {
          throw error
        }
      } else {
        showToast('Servizio aggiunto', 'success')
        setNewDate('')
        onChanged()
      }
    } catch (e: any) {
      showToast(e.message || 'Errore salvataggio', 'error')
    } finally {
      setSaving(false)
    }
  }

  const deleteService = async (id: string) => {
    if (!confirm('Rimuovere questo servizio?')) return
    try {
      const { error } = await supabase.from('shuttle_services').delete().eq('id', id)
      if (error) throw error
      showToast('Servizio rimosso', 'success')
      onChanged()
    } catch (e: any) {
      showToast(e.message || 'Errore rimozione', 'error')
    }
  }

  // Raggruppa per mese (YYYY-MM) per mostrare header mese
  const byMonth = new Map<string, ShuttleService[]>()
  for (const s of services) {
    const m = s.service_date.slice(0, 7)
    if (!byMonth.has(m)) byMonth.set(m, [])
    byMonth.get(m)!.push(s)
  }
  const monthKeys = Array.from(byMonth.keys()).sort().reverse()

  const monthLabel = (yyyymm: string) => {
    const [y, m] = yyyymm.split('-')
    const d = new Date(Number(y), Number(m) - 1, 1)
    return d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  }

  const dayLabel = (iso: string) => {
    const d = new Date(iso + 'T12:00:00')  // mezzogiorno per evitare quirk timezone
    return d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' })
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={driverName ? `Servizi navetta · ${driverName}` : 'Storico servizi navetta'}
    >
      <div style={{ padding: '4px 4px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Aggiungi servizio passato */}
        <div style={{
          background: '#eef7ff', border: '1px solid #a0c4e6', borderRadius: 12, padding: 12,
        }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: '#004a78', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
            Aggiungi servizio di data passata
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="date"
              value={newDate}
              max={todayIso}
              onChange={e => setNewDate(e.target.value)}
              style={{
                flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #c0c7d2',
                fontSize: 12, fontFamily: 'inherit',
              }}
            />
            <button
              onClick={addPastService}
              disabled={!newDate || saving}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', background: '#005f98',
                color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                opacity: (!newDate || saving) ? 0.5 : 1,
              }}
            >
              Aggiungi
            </button>
          </div>
        </div>

        {/* Lista servizi raggruppati per mese */}
        {services.length === 0 && (
          <div style={{ fontSize: 12, color: '#707882', textAlign: 'center', padding: 20, fontStyle: 'italic' }}>
            Nessun servizio registrato ancora.
          </div>
        )}
        {monthKeys.map(mk => (
          <div key={mk}>
            <div style={{
              fontSize: 10.5, fontWeight: 800, color: '#404751',
              textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>{monthLabel(mk)}</span>
              <span style={{
                padding: '2px 8px', borderRadius: 999, background: '#005f98', color: '#fff',
                fontSize: 10, fontWeight: 800,
              }}>{byMonth.get(mk)!.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {byMonth.get(mk)!.map(s => (
                <div key={s.id} style={{
                  background: '#fff', border: '1px solid #e6e8ee', borderRadius: 8,
                  padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <Icon name="calendar_today" size={14} color="#005f98" />
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#181c20' }}>
                    {dayLabel(s.service_date)}
                  </span>
                  <button
                    onClick={() => deleteService(s.id)}
                    style={{
                      padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: '#c62828',
                    }}
                    title="Rimuovi"
                  >
                    <Icon name="delete" size={14} color="#c62828" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </BottomSheet>
  )
}
