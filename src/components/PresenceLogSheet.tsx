import { useEffect, useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'

interface LogRow {
  id: string
  player_id: string | null
  event_kind: string | null
  event_id: string | null
  status: string | null
  ip_address: string | null
  user_agent: string | null
  device_fingerprint: string | null
  submitted_at: string
  player?: { first_name: string; last_name: string; team?: { name: string; color: string | null } | null } | null
}

interface AnomalyRow {
  device_fingerprint: string
  distinct_families: number
  distinct_players: number
  players: Array<{ player_id: string; name: string; team: string | null; submissions: number; last_seen: string; last_ip: string | null }>
}

interface Props {
  open: boolean
  onClose: () => void
}

function parseUA(ua: string | null): string {
  if (!ua) return 'Device sconosciuto'
  if (/iPhone|iPad|iPod/i.test(ua)) return `📱 iPhone/iPad ${(/OS ([\d_]+)/.exec(ua)?.[1] || '').replace(/_/g, '.')}`
  if (/Android/i.test(ua)) return `📱 Android ${/Android ([\d.]+)/.exec(ua)?.[1] || ''}`
  if (/Windows/i.test(ua)) return '🖥️ Windows'
  if (/Macintosh/i.test(ua)) return '🖥️ Mac'
  if (/Linux/i.test(ua)) return '🖥️ Linux'
  return ua.slice(0, 40) + '…'
}

function shortFp(fp: string | null): string {
  if (!fp) return '—'
  return fp.slice(0, 6) + '·' + fp.slice(-4)
}

export function PresenceLogSheet({ open, onClose }: Props) {
  const [tab, setTab] = useState<'log' | 'anomalies'>('anomalies')
  const [log, setLog] = useState<LogRow[]>([])
  const [anomalies, setAnomalies] = useState<AnomalyRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (open) load() }, [open, tab])

  const load = async () => {
    setLoading(true)
    if (tab === 'log') {
      const { data } = await supabase.from('presence_submission_log')
        .select('*, player:players(first_name, last_name, team:teams(name, color))')
        .order('submitted_at', { ascending: false })
        .limit(100)
      const clean = (data ?? []).map((r: any) => ({
        ...r,
        player: r.player ? {
          ...r.player,
          team: Array.isArray(r.player.team) ? r.player.team[0] : r.player.team,
        } : null,
      }))
      setLog(clean as any)
    } else {
      const { data } = await supabase.from('presence_anomalies').select('*').limit(50)
      setAnomalies((data ?? []) as any)
    }
    setLoading(false)
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Log presenze pubbliche" maxHeight="95vh">
      <div style={{ padding: '4px 18px 24px' }}>
        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 4, background: '#fff', padding: 4, borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,60,94,0.08)', marginBottom: 14,
        }}>
          <TabBtn active={tab === 'anomalies'} onClick={() => setTab('anomalies')}
            label="Anomalie" icon="warning" badge={anomalies.length} />
          <TabBtn active={tab === 'log'} onClick={() => setTab('log')}
            label="Log completo" icon="history" />
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#707882', fontSize: 13 }}>Caricamento…</div>
        ) : tab === 'anomalies' ? (
          anomalies.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', background: 'rgba(128,249,139,0.15)', color: '#006e25', borderRadius: 12, fontSize: 13 }}>
              <Icon name="verified" size={32} color="#006e25" />
              <p style={{ margin: '8px 0 0', fontWeight: 700 }}>Nessuna anomalia rilevata.</p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#5a6270' }}>
                Vengono segnalate qui le situazioni in cui uno stesso device è stato usato per registrare presenze di giocatori con cognomi diversi.
              </p>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 11.5, color: '#5a6270', margin: '0 0 10px', lineHeight: 1.4 }}>
                ⚠️ Device che hanno registrato presenze per giocatori di famiglie diverse (potenziali abusi o dispositivi condivisi).
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {anomalies.map(a => (
                  <div key={a.device_fingerprint} style={{
                    background: '#fff', border: '1px solid #ffbdb6', borderLeft: '4px solid #ba1a1a',
                    borderRadius: 10, padding: 12,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#93000a' }}>
                          {a.distinct_players} giocatori · {a.distinct_families} famiglie
                        </div>
                        <div style={{ fontSize: 10.5, color: '#5a6270', fontFamily: 'monospace', marginTop: 2 }}>
                          Device: {shortFp(a.device_fingerprint)}
                        </div>
                      </div>
                      <Icon name="warning" size={18} color="#ba1a1a" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {a.players.map(p => (
                        <div key={p.player_id} style={{
                          padding: '6px 8px', background: '#f7f9ff', borderRadius: 6,
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 11.5,
                        }}>
                          <div>
                            <span style={{ fontWeight: 700, color: '#181c20' }}>{p.name}</span>
                            {p.team && <span style={{ color: '#707882', marginLeft: 5 }}>({p.team})</span>}
                          </div>
                          <span style={{ color: '#5a6270', fontSize: 10.5 }}>
                            {p.submissions} risposte · ultima {new Date(p.last_seen).toLocaleDateString('it-IT')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          log.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#707882' }}>
              Nessuna risposta registrata dal sito pubblico.
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 11.5, color: '#5a6270', margin: '0 0 10px' }}>
                Ultime 100 risposte dal sito pubblico presenze
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {log.map(r => {
                  const status = r.status
                  const bg = status === 'yes' ? 'rgba(0,110,37,0.10)' : status === 'no' ? 'rgba(186,26,26,0.10)' : 'rgba(142,99,0,0.10)'
                  const fg = status === 'yes' ? '#006e25' : status === 'no' ? '#93000a' : '#8e6300'
                  const label = status === 'yes' ? '✅ VENGO' : status === 'no' ? '❌ NO' : '❓ FORSE'
                  return (
                    <div key={r.id} style={{
                      background: '#fff', borderRadius: 8, padding: 10,
                      border: '1px solid #e6e8ee',
                      fontSize: 11.5,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 6 }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <span style={{ fontWeight: 800, color: '#181c20' }}>
                            {r.player?.first_name} {r.player?.last_name}
                          </span>
                          {r.player?.team && (
                            <span style={{
                              marginLeft: 6, fontSize: 9.5, fontWeight: 800,
                              background: (r.player.team.color || '#005f98') + '22',
                              color: r.player.team.color || '#005f98',
                              padding: '1px 6px', borderRadius: 999,
                            }}>{r.player.team.name}</span>
                          )}
                        </div>
                        <span style={{ background: bg, color: fg, padding: '2px 7px', borderRadius: 999, fontSize: 9.5, fontWeight: 800, whiteSpace: 'nowrap' }}>{label}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 10, color: '#5a6270' }}>
                        <span>🕐 {new Date(r.submitted_at).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        <span>{r.event_kind === 'match' ? '⚽ partita' : '🏃 allenamento'}</span>
                        <span title={r.user_agent || ''}>{parseUA(r.user_agent)}</span>
                        {r.ip_address && <span>🌐 {r.ip_address}</span>}
                        {r.device_fingerprint && (
                          <span style={{ fontFamily: 'monospace' }} title={r.device_fingerprint}>
                            🔑 {shortFp(r.device_fingerprint)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        )}
      </div>
    </BottomSheet>
  )
}

function TabBtn({ active, onClick, label, icon, badge }: { active: boolean; onClick: () => void; label: string; icon: string; badge?: number }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '8px 10px', borderRadius: 8, border: 'none',
      background: active ? '#005f98' : 'transparent',
      color: active ? '#fff' : '#404751',
      fontSize: 12, fontWeight: 700, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    }}>
      <Icon name={icon} size={13} color={active ? '#fff' : '#707882'} />
      {label}
      {badge != null && badge > 0 && (
        <span style={{
          background: active ? '#ffd100' : '#ba1a1a',
          color: active ? '#181c20' : '#fff',
          padding: '1px 6px', borderRadius: 999,
          fontSize: 10, fontWeight: 800,
        }}>{badge}</span>
      )}
    </button>
  )
}
