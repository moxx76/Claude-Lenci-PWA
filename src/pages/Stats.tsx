import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { isAdmin, isCoach, isAthlete, isParent } from '../lib/types'
import { Icon } from '../components/Icon'

export function Stats() {
  const { profile } = useAuth()
  const showTeamStats = isAdmin(profile?.role) || isCoach(profile?.role)
  const showPersonalStats = isAthlete(profile?.role) || isParent(profile?.role)

  return (
    <div
      className="max-w-md md:max-w-2xl mx-auto flex flex-col"
      style={{ padding: '20px 18px', gap: 18 }}
    >
      <h2 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 22, color: '#181c20', margin: 0 }}>
        Statistiche
      </h2>

      {showTeamStats && <TeamStats />}
      {showPersonalStats && <PersonalStats />}
    </div>
  )
}

// Vista team (admin/coach)
function TeamStats() {
  const [kpis, setKpis] = useState<{ enrolled: number; total: number; tryout: number; contacted: number } | null>(null)

  useEffect(() => { load() }, [])
  const load = async () => {
    const [total, enrolled, tryout, contacted] = await Promise.all([
      supabase.from('recruitment_leads').select('id', { count: 'exact', head: true }),
      supabase.from('recruitment_leads').select('id', { count: 'exact', head: true }).eq('status', 'enrolled'),
      supabase.from('recruitment_leads').select('id', { count: 'exact', head: true }).eq('status', 'tryout'),
      supabase.from('recruitment_leads').select('id', { count: 'exact', head: true }).eq('status', 'contacted'),
    ])
    setKpis({
      enrolled: enrolled.count ?? 0,
      total: total.count ?? 0,
      tryout: tryout.count ?? 0,
      contacted: contacted.count ?? 0,
    })
  }

  const trainBars = [55, 70, 85, 60, 90, 75, 45]
  const matchBars = [80, 65, 90, 70, 85]
  const matchDays = ['J1', 'J2', 'J3', 'J4', 'J5']
  const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

  return (
    <>
      {/* KPI grid 2x2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <KpiCard value={kpis?.enrolled ?? '—'} label="Tesserati" />
        <KpiCard value={kpis?.total ?? '—'} label="Candidature totali" />
        <KpiCard value={kpis?.tryout ?? '—'} label="In Provino" />
        <KpiCard value={kpis?.contacted ?? '—'} label="Contattati" />
      </div>

      {/* Chart Presenze Allenamenti */}
      <ChartCard title="Presenze Allenamenti (Club)" bars={trainBars} labels={weekDays} color="#0078bf" />

      {/* Chart Presenze Partite */}
      <ChartCard title="Presenze Partite (Club)" bars={matchBars} labels={matchDays} color="#b3005c" />
    </>
  )
}

// Vista personale (athlete/parent)
function PersonalStats() {
  return (
    <>
      <h3 style={{ fontFamily: 'Anybody', fontWeight: 700, fontSize: 16, color: '#181c20', margin: 0 }}>
        Le tue statistiche
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <PersonalStatCard icon="sports_soccer" color="#00b4d8" value="14" label="Gol Stagionali" />
        <PersonalStatCard icon="speed" color="#e91e63" value="850'" label="Minuti Giocati" />
        <PersonalStatCard icon="verified" color="#4caf50" value="98%" label="Presenze All." />
        <PersonalStatCard icon="emoji_events" color="#FFD100" value="3" label="MVP Partita" />
      </div>

      <ChartCard title="Andamento Presenze Allenamenti" bars={[80, 100, 100, 80, 100, 90, 100]} labels={['Lun','Mar','Mer','Gio','Ven','Sab','Dom']} color="#0078bf" small />
      <ChartCard title="Andamento Presenze Partite" bars={[100, 100, 80, 100, 100]} labels={['J1','J2','J3','J4','J5']} color="#b3005c" small />
    </>
  )
}

function KpiCard({ value, label }: { value: number | string; label: string }) {
  return (
    <div
      style={{
        background: '#fff', borderRadius: 14, padding: 14, textAlign: 'center',
        boxShadow: '0 6px 16px rgba(0,120,191,0.05)',
      }}
    >
      <span style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 20, color: '#005f98', display: 'block' }}>
        {value}
      </span>
      <span style={{ fontSize: 10.5, color: '#707882' }}>{label}</span>
    </div>
  )
}

function PersonalStatCard({ icon, color, value, label }: {
  icon: string; color: string; value: string; label: string;
}) {
  return (
    <div
      style={{
        background: '#fff', border: '1px solid #e0e2e9', borderRadius: 14, padding: 14,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}
    >
      <Icon name={icon} size={26} color={color} />
      <span style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 20, color: '#181c20' }}>{value}</span>
      <span style={{ fontSize: 11, color: '#707882' }}>{label}</span>
    </div>
  )
}

function ChartCard({ title, bars, labels, color, small }: {
  title: string; bars: number[]; labels: string[]; color: string; small?: boolean;
}) {
  const height = small ? 90 : 110
  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: 18, boxShadow: '0 10px 24px rgba(0,120,191,0.06)' }}>
      <h3 style={{ fontFamily: 'Anybody', fontWeight: 700, fontSize: small ? 14 : 15, color: '#181c20', margin: '0 0 12px' }}>
        {title}
      </h3>
      <div className="flex items-end" style={{ gap: 6, height, borderBottom: '1px solid #e0e2e9', paddingBottom: 6 }}>
        {bars.map((b, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end" style={{ height: '100%' }}>
            <div
              style={{
                width: '100%', background: color,
                borderRadius: '4px 4px 0 0',
                opacity: 0.4 + (b / 100) * 0.6,
                height: `${b}%`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex" style={{ gap: 6, marginTop: 6 }}>
        {labels.map((l, i) => (
          <span key={i} className="flex-1 text-center" style={{ fontSize: 10.5, color: '#707882' }}>
            {l}
          </span>
        ))}
      </div>
    </div>
  )
}
