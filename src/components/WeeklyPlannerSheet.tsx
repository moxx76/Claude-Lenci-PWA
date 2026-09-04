import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { useToast } from './Toast'
import {
  generateWeeklyPlannerPoster,
  shareOrDownload,
  downloadBlob,
  type PlannerEvent,
  type WeeklyPlannerData,
} from '../lib/weeklyPlannerPoster'
import jsPDF from 'jspdf'

interface Props {
  open: boolean
  onClose: () => void
  /** Se null, mostra tutte le squadre */
  teamFilter: string | null
  /** Lista squadre note (per costruire il label) */
  teams: Array<{ id: string; name: string; color: string | null; category?: string | null; age_range?: string | null }>
}

/**
 * Formatta una Date in "YYYY-MM-DD" usando i componenti LOCALI
 * (non UTC). Evita che toISOString() sposti la data indietro
 * di 1 giorno per utenti in fuso orario positivo.
 */
function toLocalDateIso(d: Date): string {
  const yr = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dy = String(d.getDate()).padStart(2, '0')
  return `${yr}-${mo}-${dy}`
}

/**
 * Ritorna la data (YYYY-MM-DD) del lunedì della settimana della data data.
 */
function getMondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const wd = d.getDay() // 0=dom,1=lun,...
  const diff = wd === 0 ? -6 : 1 - wd
  d.setDate(d.getDate() + diff)
  return toLocalDateIso(d)
}

function todayIso(): string {
  return toLocalDateIso(new Date())
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toLocalDateIso(d)
}

const MONTHS_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

function formatWeekLabel(start: string): string {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(s.getTime() + 6 * 86400000)
  const sM = MONTHS_IT[s.getMonth()]
  const eM = MONTHS_IT[e.getMonth()]
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${e.getDate()} ${sM} ${e.getFullYear()}`
  }
  return `${s.getDate()} ${sM} – ${e.getDate()} ${eM} ${e.getFullYear()}`
}

export function WeeklyPlannerSheet({ open, onClose, teamFilter, teams }: Props) {
  const { showToast } = useToast()

  const [weekStart, setWeekStart] = useState(() => getMondayOf(todayIso()))
  const [posterUrl, setPosterUrl] = useState<string | null>(null)
  const [posterBlob, setPosterBlob] = useState<Blob | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Ricalcola settimana corrente sul reopen
  useEffect(() => {
    if (open) {
      setWeekStart(getMondayOf(todayIso()))
      setPosterUrl(null)
      setPosterBlob(null)
      setError(null)
    }
  }, [open])

  const scopeLabel = useMemo(() => {
    if (teamFilter) {
      const t = teams.find(t => t.id === teamFilter) as any
      if (!t) return 'Squadra'
      const name = t.name || t.category || 'Squadra'
      const range = t.age_range
      if (range && !String(name).toLowerCase().includes(String(range).toLowerCase())) {
        return `${name} annata ${range}`
      }
      return name
    }
    return 'Tutte le squadre'
  }, [teamFilter, teams])

  const buildPlannerData = useCallback(async (): Promise<WeeklyPlannerData> => {
    const weekEnd = addDays(weekStart, 6)
    // Fetch allenamenti + partite della settimana
    let tq = supabase.from('trainings')
      .select('id, training_date, start_time, end_time, location, team_id, team:teams(name, color, category, age_range)')
      .gte('training_date', weekStart)
      .lte('training_date', weekEnd)
      .order('training_date').order('start_time')
    if (teamFilter) tq = tq.eq('team_id', teamFilter)

    let mq = supabase.from('matches')
      .select('id, match_date, opponent, venue, competition, location, team_id, team:teams(name, color, category, age_range)')
      .gte('match_date', `${weekStart}T00:00:00`)
      .lte('match_date', `${weekEnd}T23:59:59`)
      .order('match_date')
    if (teamFilter) mq = mq.eq('team_id', teamFilter)

    const [tRes, mRes] = await Promise.all([tq, mq])
    if (tRes.error) throw tRes.error
    if (mRes.error) throw mRes.error

    const eventsByDay: Record<string, PlannerEvent[]> = {}

    // Compone il nome squadra esteso: "Under 16 annata 2011"
    const formatTeamLabel = (team: any): string => {
      if (!team) return 'Squadra'
      const name = team.name || team.category || 'Squadra'
      const range = team.age_range
      if (range && !name.toLowerCase().includes(range.toLowerCase())) {
        return `${name} annata ${range}`
      }
      return name
    }

    for (const t of (tRes.data ?? []) as any[]) {
      const team = Array.isArray(t.team) ? t.team[0] : t.team
      const day = t.training_date
      if (!eventsByDay[day]) eventsByDay[day] = []
      eventsByDay[day].push({
        kind: 'training',
        time: t.start_time?.slice(0, 5) || null,
        endTime: t.end_time?.slice(0, 5) || null,
        teamName: formatTeamLabel(team),
        teamColor: team?.color ?? null,
        location: t.location ?? null,
      })
    }
    for (const m of (mRes.data ?? []) as any[]) {
      const team = Array.isArray(m.team) ? m.team[0] : m.team
      const md = new Date(m.match_date)
      // IMPORTANTE: usiamo la data locale (non UTC) per associare il match
      // al giorno visualizzato dall'utente in Italia
      const day = toLocalDateIso(md)
      const timeStr = `${String(md.getHours()).padStart(2, '0')}:${String(md.getMinutes()).padStart(2, '0')}`
      if (!eventsByDay[day]) eventsByDay[day] = []
      eventsByDay[day].push({
        kind: 'match',
        time: timeStr,
        teamName: formatTeamLabel(team),
        teamColor: team?.color ?? null,
        opponent: m.opponent,
        venue: m.venue,
        location: m.location ?? null,
        competition: m.competition ?? null,
      })
    }

    // Ordina eventi per ora dentro ogni giorno
    for (const day in eventsByDay) {
      eventsByDay[day].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
    }

    const days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i)
      return { date, events: eventsByDay[date] || [] }
    })

    return { weekStart, scopeLabel, days }
  }, [weekStart, teamFilter, scopeLabel])

  const regenerate = useCallback(async () => {
    setLoading(true)
    setError(null)
    setPosterUrl(null)
    setPosterBlob(null)
    try {
      const data = await buildPlannerData()
      const blob = await generateWeeklyPlannerPoster(data)
      const url = URL.createObjectURL(blob)
      setPosterBlob(blob)
      setPosterUrl(url)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      showToast('Errore generazione planner: ' + msg, 'error')
    } finally {
      setLoading(false)
    }
  }, [buildPlannerData, showToast])

  // Rigenera automaticamente al cambio di settimana o all'apertura
  useEffect(() => {
    if (open) regenerate()
    return () => {
      if (posterUrl) URL.revokeObjectURL(posterUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, weekStart, teamFilter])

  const goPrevWeek = () => setWeekStart(addDays(weekStart, -7))
  const goNextWeek = () => setWeekStart(addDays(weekStart, 7))
  const goThisWeek = () => setWeekStart(getMondayOf(todayIso()))

  const handleShare = async () => {
    if (!posterBlob) return
    const filename = `planner_lenci_${weekStart}.png`
    await shareOrDownload(posterBlob, filename, `Planner settimanale ${formatWeekLabel(weekStart)}`)
  }

  const handleDownloadPng = () => {
    if (!posterBlob) return
    const filename = `planner_lenci_${weekStart}.png`
    downloadBlob(posterBlob, filename)
    showToast('PNG scaricato', 'success')
  }

  const handleExportPdf = async () => {
    if (!posterBlob) return
    try {
      // Converti Blob PNG in dataURL e inserisci in un PDF A4 verticale
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onloadend = () => resolve(r.result as string)
        r.onerror = () => reject(new Error('Errore lettura PNG'))
        r.readAsDataURL(posterBlob)
      })
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
      // A4 = 210x297. Poster è 1080x1350 (ratio 0.8). A larghezza 190mm → altezza 237.5mm
      const pageW = 210
      const marginX = 10
      const imgW = pageW - marginX * 2
      const imgH = imgW * (1350 / 1080)
      pdf.addImage(dataUrl, 'PNG', marginX, 15, imgW, imgH)
      pdf.save(`planner_lenci_${weekStart}.pdf`)
      showToast('PDF salvato', 'success')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast('Errore PDF: ' + msg, 'error')
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Planner settimanale" maxHeight="94vh">
      <div style={{ padding: '4px 14px 30px' }}>
        {/* Selettore squadra info */}
        <div style={{
          padding: '10px 12px', background: '#f7f9ff', borderRadius: 10, marginBottom: 12,
          fontSize: 12, color: '#404751',
        }}>
          <b>Squadre incluse:</b> {scopeLabel}
        </div>

        {/* Navigatore settimana */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <button onClick={goPrevWeek} style={weekNavBtn}>
            <Icon name="chevron_left" size={20} color="#404751" />
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#707882', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Settimana
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#181c20', marginTop: 2 }}>
              {formatWeekLabel(weekStart)}
            </div>
          </div>
          <button onClick={goNextWeek} style={weekNavBtn}>
            <Icon name="chevron_right" size={20} color="#404751" />
          </button>
        </div>

        {weekStart !== getMondayOf(todayIso()) && (
          <button
            onClick={goThisWeek}
            style={{
              width: '100%', padding: 8, marginBottom: 10, borderRadius: 8,
              background: '#fff', border: '1px solid #c0c7d2', color: '#005f98',
              fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ↺ Torna alla settimana corrente
          </button>
        )}

        {/* Preview */}
        {loading && (
          <div style={{ padding: 60, textAlign: 'center', color: '#707882', fontSize: 13 }}>
            Genero il planner…
          </div>
        )}

        {error && !loading && (
          <div style={{ padding: 12, background: '#ffe4e4', color: '#7a0000', borderRadius: 8, fontSize: 12 }}>
            ⚠ {error}
          </div>
        )}

        {posterUrl && !loading && (
          <>
            <div style={{ fontSize: 10.5, color: '#707882', margin: '4px 0 6px', textAlign: 'center' }}>
              Formato 4:5 · Ottimo per WhatsApp, Instagram, Facebook
            </div>
            <div style={{
              borderRadius: 14, overflow: 'hidden', marginBottom: 14,
              boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
            }}>
              <img
                src={posterUrl}
                alt="Planner settimanale"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>

            {/* Azioni */}
            <div style={{ display: 'grid', gap: 8 }}>
              <button
                onClick={handleShare}
                style={{
                  padding: '13px', borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)',
                  color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 12px rgba(37,211,102,0.30)',
                }}
              >
                <Icon name="share" size={17} color="#fff" />
                Condividi (WhatsApp, ecc.)
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  onClick={handleDownloadPng}
                  style={secondaryBtn('#005f98')}
                >
                  <Icon name="download" size={15} color="#005f98" />
                  Scarica PNG
                </button>
                <button
                  onClick={handleExportPdf}
                  style={secondaryBtn('#7a0071')}
                >
                  <Icon name="picture_as_pdf" size={15} color="#7a0071" />
                  Scarica PDF
                </button>
              </div>

              <button
                onClick={regenerate}
                style={{
                  padding: '10px', borderRadius: 10,
                  background: '#fff', border: '1px solid #c0c7d2', color: '#404751',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Icon name="refresh" size={14} color="#404751" />
                Rigenera
              </button>
            </div>

            <div style={{
              marginTop: 12, padding: '9px 11px', background: '#eef7ff', borderRadius: 8,
              fontSize: 10.5, color: '#004a78', fontWeight: 600,
            }}>
              💡 <b>Condividi</b> apre il selettore nativo (WhatsApp, Instagram, ecc.) su mobile. Su desktop scarica direttamente.
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  )
}

const weekNavBtn: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 10,
  background: '#fff', border: '1px solid #c0c7d2',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', fontFamily: 'inherit',
}

function secondaryBtn(color: string): React.CSSProperties {
  return {
    padding: '11px', borderRadius: 10,
    background: '#fff', border: `1px solid ${color}`, color,
    fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  }
}
