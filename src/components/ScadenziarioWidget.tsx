import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Icon } from './Icon'

/**
 * Widget scadenziario per Dashboard Admin — richiesta Davide 2026-10-09:
 * la prima cosa visibile in dashboard, con prossime incombenze actionable
 * entro 14 giorni ordinate per scadenza. Tap su una riga → apre
 * /incombenze con dettaglio.
 */

interface Row {
  id: string
  testo: string
  scadenza: string
  criterio: string
  stato: string
}

export function ScadenziarioWidget() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().slice(0, 10)
      const in14d = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
      const { data } = await supabase
        .from('lnd_rilievi')
        .select('id, testo, scadenza, criterio, stato')
        .eq('azione_richiesta', true)
        .in('stato', ['nuovo', 'in_corso'])
        .gte('scadenza', today)
        .lte('scadenza', in14d)
        .order('scadenza', { ascending: true })
        .limit(5)
      setRows((data || []) as Row[])
      setLoading(false)
    }
    load()
  }, [])

  // Conta anche quelle oltre i 14 giorni per il "e altre N" link
  const [piuAvanti, setPiuAvanti] = useState(0)
  useEffect(() => {
    const load = async () => {
      const in14d = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
      const { count } = await supabase
        .from('lnd_rilievi')
        .select('id', { count: 'exact', head: true })
        .eq('azione_richiesta', true)
        .in('stato', ['nuovo', 'in_corso'])
        .gt('scadenza', in14d)
      setPiuAvanti(count ?? 0)
    }
    load()
  }, [])

  if (loading) return null

  const today = new Date(); today.setHours(0, 0, 0, 0)

  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      borderLeft: '4px solid #b3005c',
      boxShadow: '0 10px 24px rgba(179,0,92,0.08)',
      overflow: 'hidden',
    }}>
      <Link to="/incombenze" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderBottom: rows.length > 0 ? '1px solid #f6f7fb' : 'none',
        textDecoration: 'none', color: 'inherit',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(179,0,92,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="assignment_late" size={18} color="#b3005c" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#181c20' }}>
              Scadenziario
            </div>
            <div style={{ fontSize: 11, color: '#707882' }}>
              {rows.length === 0
                ? 'Nessuna scadenza nei prossimi 14 giorni'
                : `${rows.length}${rows.length === 5 ? '+' : ''} ${rows.length === 1 ? 'incombenza' : 'incombenze'} entro 14 giorni`}
              {piuAvanti > 0 && ` · ${piuAvanti} oltre`}
            </div>
          </div>
        </div>
        <Icon name="chevron_right" size={18} color="#c0c7d2" />
      </Link>

      {rows.length === 0 ? (
        <div style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#006e25' }}>
          <Icon name="task_alt" size={16} color="#006e25" />
          Niente di urgente. Verifica le incombenze a lungo termine in /incombenze.
        </div>
      ) : (
        <div>
          {rows.map(r => {
            const scad = new Date(r.scadenza); scad.setHours(0, 0, 0, 0)
            const giorni = Math.round((scad.getTime() - today.getTime()) / 86400000)
            const urgente = giorni <= 2
            return (
              <Link
                key={r.id}
                to="/incombenze"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  borderBottom: '1px solid #f6f7fb',
                  textDecoration: 'none', color: 'inherit',
                }}
              >
                <div style={{
                  width: 46, textAlign: 'center',
                  padding: '4px 2px', borderRadius: 8,
                  background: urgente ? '#ffdad6' : '#cfe5ff',
                  color: urgente ? '#93000a' : '#004a78',
                  flexShrink: 0,
                }}>
                  <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    {scad.toLocaleDateString('it-IT', { month: 'short' })}
                  </div>
                  <div style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 16, lineHeight: 1 }}>
                    {scad.getDate()}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, color: '#181c20',
                    display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2,
                    overflow: 'hidden', lineHeight: 1.3,
                  }}>
                    {r.testo}
                  </div>
                  <div style={{ fontSize: 10, color: urgente ? '#93000a' : '#707882', fontWeight: urgente ? 800 : 600, marginTop: 2 }}>
                    {giorni === 0 ? 'SCADE OGGI' : giorni === 1 ? 'scade domani' : giorni <= 2 ? `scade fra ${giorni} giorni` : `scade fra ${giorni} giorni`}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
