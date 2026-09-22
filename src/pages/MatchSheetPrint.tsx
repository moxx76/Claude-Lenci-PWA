/**
 * MatchSheetPrint — Foglio partita A4 landscape stampabile in PDF.
 *
 * Rotta: /foglio-partita/:matchId
 * Uso: il mister apre la pagina, clicca "Stampa / Salva come PDF" in alto,
 *      il browser gli mostra il dialogo stampa nativo che permette di scegliere
 *      "Salva come PDF" oppure stampante fisica.
 *
 * Layout (297x210mm, con margine 5mm, area utile ~287x200mm):
 *   Header 15mm: team + avversario + risultato finale + info arbitro/terreno + modulo/competizione
 *   Corpo 145mm su 3 colonne:
 *     - sx 55mm: mini campo con numeri maglia + capitano/vice
 *     - centro 82mm: tabella titolari (11 righe) + tabella panchina
 *     - dx 150mm: 15 gol Lenci (3 col x 5 righe) + 8 gol avversari + 10 sostituzioni
 *   Footer 40mm: 8 ammonizioni orizzontali + 2 espulsioni con motivo + note libere
 *
 * Nessuna dipendenza esterna: window.print() nativo del browser.
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { FORMATIONS } from '../lib/formations'

interface MatchInfo {
  id: string
  opponent: string
  match_date: string
  venue: 'home' | 'away'
  competition: string | null
  formation: string | null
  team_name: string
  team_category: string | null
  team_color: string | null
}

interface StarterRow {
  jersey: number | null
  slot_index: number
  slot_key: string
  slot_label: string
  role_group: string   // GK/DIF/CEN/ATT calcolato per etichetta breve
  last_name: string
  first_name: string
  is_captain: boolean
  is_vice_captain: boolean
  /** x,y sul mini-campo (0..100) */
  x: number
  y: number
}

interface BenchRow {
  jersey: number | null
  role_group: string
  last_name: string
  first_name: string
}

export function MatchSheetPrint() {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [match, setMatch] = useState<MatchInfo | null>(null)
  const [starters, setStarters] = useState<StarterRow[]>([])
  const [bench, setBench] = useState<BenchRow[]>([])
  const [captainNumber, setCaptainNumber] = useState<number | null>(null)
  const [captainName, setCaptainName] = useState<string | null>(null)
  const [viceNumber, setViceNumber] = useState<number | null>(null)
  const [viceName, setViceName] = useState<string | null>(null)

  useEffect(() => {
    if (!matchId) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      // 1. Match + team
      const { data: mData, error: mErr } = await supabase.from('matches')
        .select('id, opponent, match_date, venue, competition, formation, team:teams(name, category, color)')
        .eq('id', matchId!)
        .single()
      if (mErr || !mData) throw new Error(mErr?.message || 'Partita non trovata')
      const m: MatchInfo = {
        id: mData.id,
        opponent: mData.opponent,
        match_date: mData.match_date,
        venue: mData.venue,
        competition: mData.competition,
        formation: mData.formation,
        team_name: (mData as any).team?.name ?? 'Lenci Poirino',
        team_category: (mData as any).team?.category ?? null,
        team_color: (mData as any).team?.color ?? '#b3005c',
      }
      setMatch(m)

      // 2. Convocazioni con dati player + capitano/vice
      const { data: convRes } = await supabase.from('convocations')
        .select('player_id, is_captain, is_vice_captain, shirt_number_override, player:players(id, first_name, last_name, jersey_number, position)')
        .eq('match_id', matchId!)
        .in('status', ['confirmed', 'convocated'])
      const convocations = (convRes ?? []) as any[]

      // 3. Stats per capire chi è titolare e in che slot
      const { data: statsRes } = await supabase.from('match_player_stats')
        .select('player_id, was_starter, slot_index, role_slot, role_slot_label')
        .eq('match_id', matchId!)
      const stats = (statsRes ?? []) as any[]
      const statsByPlayer = new Map(stats.map(s => [s.player_id, s]))

      // Coordinate slot dal modulo, per il mini-campo
      const formation = m.formation || '4-4-2'
      const slotCoords: Record<string, { x: number; y: number }> = {}
      const formationDef = (FORMATIONS as any)[formation]
      if (formationDef?.slots) {
        for (const slot of formationDef.slots) {
          slotCoords[slot.key] = { x: slot.x, y: slot.y }
        }
      }

      const startersArr: StarterRow[] = []
      const benchArr: BenchRow[] = []
      for (const c of convocations) {
        const p = c.player
        if (!p) continue
        const s = statsByPlayer.get(c.player_id)
        const jersey = c.shirt_number_override ?? p.jersey_number
        if (s?.was_starter && s.slot_index != null && s.role_slot) {
          const coord = slotCoords[s.role_slot] ?? { x: 50, y: 50 }
          startersArr.push({
            jersey,
            slot_index: s.slot_index,
            slot_key: s.role_slot,
            slot_label: s.role_slot_label || slotShortLabel(s.role_slot),
            role_group: slotToRoleGroup(s.role_slot),
            last_name: p.last_name,
            first_name: p.first_name,
            is_captain: !!c.is_captain,
            is_vice_captain: !!c.is_vice_captain,
            x: coord.x,
            y: coord.y,
          })
        } else {
          benchArr.push({
            jersey,
            role_group: positionToRoleGroup(p.position),
            last_name: p.last_name,
            first_name: p.first_name,
          })
        }
        if (c.is_captain) {
          setCaptainNumber(jersey)
          setCaptainName(`${p.last_name} ${p.first_name[0] ?? ''}.`)
        }
        if (c.is_vice_captain) {
          setViceNumber(jersey)
          setViceName(`${p.last_name} ${p.first_name[0] ?? ''}.`)
        }
      }
      startersArr.sort((a, b) => a.slot_index - b.slot_index)
      benchArr.sort((a, b) => {
        // Portieri prima, poi per numero maglia
        const rankA = a.role_group === 'GK' ? 0 : 1
        const rankB = b.role_group === 'GK' ? 0 : 1
        if (rankA !== rankB) return rankA - rankB
        return (a.jersey ?? 999) - (b.jersey ?? 999)
      })
      setStarters(startersArr)
      setBench(benchArr)
    } catch (e: any) {
      setError(e?.message || 'Errore caricamento')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div style={{ padding: 40, fontFamily: 'system-ui' }}>Caricamento foglio partita…</div>
  if (error || !match) return (
    <div style={{ padding: 40, fontFamily: 'system-ui' }}>
      <p style={{ color: '#93000a' }}>Errore: {error || 'Partita non trovata'}</p>
      <button onClick={() => navigate('/')}>Torna alla dashboard</button>
    </div>
  )

  const isHome = match.venue === 'home'
  const d = new Date(match.match_date)
  const dateStr = d.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const timeStr = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })

  return (
    <>
      {/* Stili di stampa: A4 landscape, nasconde toolbar quando stampa */}
      <style>{`
        @page {
          size: A4 landscape;
          margin: 5mm;
        }
        @media print {
          .no-print { display: none !important; }
          html, body { margin: 0; padding: 0; background: #fff; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .sheet { box-shadow: none !important; margin: 0 !important; }
        }
        @media screen {
          body { background: #e6e8ee; }
          .sheet {
            width: 287mm;
            height: 200mm;
            margin: 20px auto;
            background: #fff;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          }
        }
        .sheet {
          box-sizing: border-box;
          padding: 3mm;
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          font-size: 9pt;
          color: #000;
          overflow: hidden;
          display: grid;
          grid-template-rows: 15mm 145mm 40mm;
          gap: 1.5mm;
        }
        .box { border: 0.5pt solid #000; box-sizing: border-box; }
        .fill { width: 100%; border-bottom: 0.4pt solid #000; display: inline-block; min-height: 3.4mm; }
      `}</style>

      {/* Toolbar (nascosta in stampa) */}
      <div className="no-print" style={{
        padding: '12px 20px', background: '#fff',
        borderBottom: '1px solid #e6e8ee',
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 10,
        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
      }}>
        <button onClick={() => navigate(-1)} style={{
          padding: '8px 14px', background: '#f0f2f5', color: '#404751',
          border: 'none', borderRadius: 8, cursor: 'pointer',
          fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
        }}>← Indietro</button>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#181c20' }}>
          Foglio partita · {match.team_name} vs {match.opponent}
        </div>
        <button onClick={() => window.print()} style={{
          padding: '10px 18px', background: '#005f98', color: '#fff',
          border: 'none', borderRadius: 8, cursor: 'pointer',
          fontSize: 14, fontWeight: 800, fontFamily: 'inherit',
        }}>🖨️ Stampa / Salva come PDF</button>
      </div>

      {/* Foglio A4 */}
      <div className="sheet">
        {/* HEADER */}
        <Header
          match={match} isHome={isHome} dateStr={dateStr} timeStr={timeStr}
        />

        {/* CORPO — 3 colonne */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '55mm 82mm 1fr',
          gap: '1.5mm',
          minHeight: 0,
        }}>
          <LeftPanel
            starters={starters} teamColor={match.team_color || '#b3005c'}
            captainNumber={captainNumber} captainName={captainName}
            viceNumber={viceNumber} viceName={viceName}
          />
          <MiddlePanel starters={starters} bench={bench} />
          <RightPanel />
        </div>

        {/* FOOTER — ammonizioni, espulsioni, note */}
        <Footer />
      </div>
    </>
  )
}

// ============ Header ============

function Header({ match, isHome, dateStr, timeStr }: {
  match: MatchInfo; isHome: boolean; dateStr: string; timeStr: string
}) {
  return (
    <div className="box" style={{
      padding: '2mm 3mm',
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: '3mm',
      alignItems: 'center',
    }}>
      <div>
        <div style={{ fontSize: '13pt', fontWeight: 900, lineHeight: 1.15 }}>
          {match.team_name.toUpperCase()}
          {match.team_category && (
            <span style={{ fontSize: '9pt', fontWeight: 600, marginLeft: 4 }}>
              · {match.team_category}
            </span>
          )}
          <span style={{ margin: '0 6pt', fontSize: '10pt', color: '#404751' }}>vs</span>
          <span style={{ fontSize: '13pt', fontWeight: 900 }}>{match.opponent.toUpperCase()}</span>
        </div>
        <div style={{ fontSize: '8.5pt', marginTop: '1mm', color: '#181c20' }}>
          📅 {capFirst(dateStr)} · 🕒 {timeStr} · {isHome ? '🏠 CASA' : '✈️ TRASFERTA'}
          {match.formation && <span> · <b>Modulo: {match.formation}</b></span>}
          {match.competition && <span> · {match.competition}</span>}
        </div>
        <div style={{ fontSize: '8.5pt', marginTop: '1mm', display: 'flex', gap: '5mm' }}>
          <span>Arbitro: <span className="fill" style={{ width: '55mm' }} /></span>
          <span>Terreno: <span className="fill" style={{ width: '35mm' }} /></span>
          <span>Meteo: <span className="fill" style={{ width: '25mm' }} /></span>
        </div>
      </div>
      {/* Risultato finale a destra */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '2mm',
        fontSize: '10pt', fontWeight: 800,
      }}>
        <span>RISULTATO FINALE</span>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '1.5mm',
          fontSize: '18pt', fontFamily: '"Anybody", system-ui', fontWeight: 900,
        }}>
          <div style={{
            width: '9mm', height: '9mm', border: '0.8pt solid #000',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>&nbsp;</div>
          <span>-</span>
          <div style={{
            width: '9mm', height: '9mm', border: '0.8pt solid #000',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>&nbsp;</div>
        </div>
      </div>
    </div>
  )
}

// ============ Colonna sx: mini-campo + capitani ============

function LeftPanel({ starters, teamColor, captainNumber, captainName, viceNumber, viceName }: {
  starters: StarterRow[]; teamColor: string;
  captainNumber: number | null; captainName: string | null;
  viceNumber: number | null; viceName: string | null;
}) {
  return (
    <div className="box" style={{
      padding: '2mm', display: 'flex', flexDirection: 'column', gap: '1.5mm',
    }}>
      <div style={{ fontSize: '8pt', fontWeight: 800, textAlign: 'center', marginBottom: '1mm' }}>
        SCHIERAMENTO
      </div>
      {/* Mini campo SVG */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center' }}>
        <MiniPitch starters={starters} teamColor={teamColor} />
      </div>
      {/* Capitano/Vice grande */}
      <div style={{
        borderTop: '0.5pt solid #000', paddingTop: '1.5mm',
        fontSize: '8.5pt', lineHeight: 1.5,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '2mm' }}>
          <span style={{ fontWeight: 800 }}>⭐ CAP</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '5mm', height: '5mm', borderRadius: '50%',
            background: '#000', color: '#fff', fontSize: '7pt', fontWeight: 800,
          }}>{captainNumber ?? '?'}</span>
          <span style={{ fontWeight: 700 }}>{captainName || '—'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '2mm', marginTop: '1mm' }}>
          <span style={{ fontWeight: 800 }}>⭐ VC</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '5mm', height: '5mm', borderRadius: '50%',
            background: '#fff', color: '#000', border: '0.5pt solid #000',
            fontSize: '7pt', fontWeight: 800,
          }}>{viceNumber ?? '?'}</span>
          <span style={{ fontWeight: 700 }}>{viceName || '—'}</span>
        </div>
      </div>
    </div>
  )
}

function MiniPitch({ starters, teamColor }: { starters: StarterRow[]; teamColor: string }) {
  return (
    <svg viewBox="0 0 100 140" style={{ width: '100%', height: '100%', maxHeight: '90mm' }}>
      {/* Sfondo campo */}
      <rect x={0} y={0} width={100} height={140} fill="#e8f5ec" stroke="#000" strokeWidth={0.4} />
      {/* Metà campo */}
      <line x1={0} y1={70} x2={100} y2={70} stroke="#000" strokeWidth={0.3} />
      <circle cx={50} cy={70} r={9} fill="none" stroke="#000" strokeWidth={0.3} />
      {/* Area rigore nostra (in basso) */}
      <rect x={22} y={122} width={56} height={16} fill="none" stroke="#000" strokeWidth={0.3} />
      <rect x={35} y={132} width={30} height={6} fill="none" stroke="#000" strokeWidth={0.3} />
      {/* Area rigore avversaria (in alto) */}
      <rect x={22} y={2} width={56} height={16} fill="none" stroke="#000" strokeWidth={0.3} />
      <rect x={35} y={2} width={30} height={6} fill="none" stroke="#000" strokeWidth={0.3} />
      {/* Giocatori: cerchi coi numeri */}
      {starters.map((s, i) => {
        const cx = s.x
        const cy = 140 - s.y * 1.4  // Convert y=0-100 to 140-0 (invertito)
        const isGK = s.slot_key === 'GK'
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={5}
              fill={isGK ? '#f5b800' : teamColor}
              stroke={s.is_captain ? '#ffd100' : s.is_vice_captain ? '#8ecdff' : '#000'}
              strokeWidth={s.is_captain || s.is_vice_captain ? 0.8 : 0.4}
            />
            <text
              x={cx} y={cy + 1.5}
              textAnchor="middle"
              fontSize={4.5}
              fontWeight={800}
              fill="#fff"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >{s.jersey ?? '?'}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ============ Colonna centrale: titolari + panchina ============

function MiddlePanel({ starters, bench }: { starters: StarterRow[]; bench: BenchRow[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5mm', minHeight: 0 }}>
      {/* Titolari */}
      <div className="box" style={{ padding: '1.5mm 2mm' }}>
        <div style={{
          fontSize: '8pt', fontWeight: 800, textAlign: 'center',
          borderBottom: '0.5pt solid #000', paddingBottom: '1mm', marginBottom: '1mm',
        }}>TITOLARI (11)</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt' }}>
          <thead>
            <tr style={{ fontSize: '6.5pt', fontWeight: 800, background: '#f0f2f5' }}>
              <th style={{ width: '5mm', textAlign: 'center', padding: '0.3mm' }}>#</th>
              <th style={{ width: '9mm', textAlign: 'left', padding: '0.3mm 1mm' }}>Ruolo</th>
              <th style={{ textAlign: 'left', padding: '0.3mm 1mm' }}>Nome</th>
              <th style={{ width: '7mm', textAlign: 'center', padding: '0.3mm' }}>Cart</th>
              <th style={{ width: '8mm', textAlign: 'center', padding: '0.3mm' }}>Uscita</th>
            </tr>
          </thead>
          <tbody>
            {starters.map((s, i) => (
              <tr key={i} style={{ borderBottom: '0.3pt dashed #999' }}>
                <td style={{ textAlign: 'center', padding: '0.6mm 0.3mm', fontWeight: 800 }}>{s.jersey ?? ''}</td>
                <td style={{ textAlign: 'left', padding: '0.6mm 1mm', color: '#404751', fontWeight: 700 }}>{s.slot_label}</td>
                <td style={{ padding: '0.6mm 1mm', fontWeight: 600 }}>
                  {s.last_name} {s.first_name[0]}.
                  {s.is_captain && ' ⭐'}
                  {s.is_vice_captain && ' ⭐'}
                </td>
                <td style={{ padding: '0.6mm', borderLeft: '0.3pt solid #999' }}>&nbsp;</td>
                <td style={{ padding: '0.6mm', borderLeft: '0.3pt solid #999' }}>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Panchina */}
      <div className="box" style={{ padding: '1.5mm 2mm', flex: 1, minHeight: 0 }}>
        <div style={{
          fontSize: '8pt', fontWeight: 800, textAlign: 'center',
          borderBottom: '0.5pt solid #000', paddingBottom: '1mm', marginBottom: '1mm',
        }}>PANCHINA ({bench.length})</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt' }}>
          <thead>
            <tr style={{ fontSize: '6.5pt', fontWeight: 800, background: '#f0f2f5' }}>
              <th style={{ width: '5mm', textAlign: 'center', padding: '0.3mm' }}>#</th>
              <th style={{ width: '8mm', textAlign: 'left', padding: '0.3mm 1mm' }}>Ruo.</th>
              <th style={{ textAlign: 'left', padding: '0.3mm 1mm' }}>Nome</th>
              <th style={{ width: '8mm', textAlign: 'center', padding: '0.3mm' }}>Entra</th>
              <th style={{ width: '10mm', textAlign: 'center', padding: '0.3mm' }}>Sostit.</th>
            </tr>
          </thead>
          <tbody>
            {bench.map((b, i) => (
              <tr key={i} style={{ borderBottom: '0.3pt dashed #999' }}>
                <td style={{ textAlign: 'center', padding: '0.6mm 0.3mm', fontWeight: 800 }}>{b.jersey ?? ''}</td>
                <td style={{ textAlign: 'left', padding: '0.6mm 1mm', color: '#404751', fontWeight: 700 }}>{b.role_group}</td>
                <td style={{ padding: '0.6mm 1mm', fontWeight: 600 }}>{b.last_name} {b.first_name[0]}.</td>
                <td style={{ padding: '0.6mm', borderLeft: '0.3pt solid #999' }}>&nbsp;</td>
                <td style={{ padding: '0.6mm', borderLeft: '0.3pt solid #999' }}>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============ Colonna destra: gol Lenci, gol avv, sostituzioni ============

function RightPanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5mm', minHeight: 0 }}>
      {/* Gol Lenci: 15 slot in griglia 3x5 */}
      <div className="box" style={{ padding: '1.5mm 2mm' }}>
        <div style={{
          fontSize: '8.5pt', fontWeight: 800, textAlign: 'left',
          borderBottom: '0.5pt solid #000', paddingBottom: '1mm', marginBottom: '1.5mm',
          color: '#005f98',
        }}>⚽ GOAL LENCI</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '1mm 2mm',
        }}>
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} style={{ fontSize: '7pt', display: 'flex', flexDirection: 'column', gap: '0.5mm' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '1mm' }}>
                <span style={{ fontWeight: 700, minWidth: '7mm' }}>min:</span>
                <span className="fill" style={{ flex: 1 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '1mm' }}>
                <span style={{ fontWeight: 700, minWidth: '7mm' }}>marc:</span>
                <span className="fill" style={{ flex: 1 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '1mm' }}>
                <span style={{ fontWeight: 700, minWidth: '7mm' }}>ast:</span>
                <span className="fill" style={{ flex: 1 }} />
                <span style={{ fontSize: '6pt', marginLeft: '0.5mm' }}>
                  <span style={{ display: 'inline-block', width: '2mm', height: '2mm', border: '0.4pt solid #000', verticalAlign: 'middle' }} /> r
                  <span style={{ display: 'inline-block', width: '2mm', height: '2mm', border: '0.4pt solid #000', marginLeft: '1mm', verticalAlign: 'middle' }} /> p
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gol avversari + sostituzioni affiancati */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5mm' }}>
        {/* Gol avversari 8 slot */}
        <div className="box" style={{ padding: '1.5mm 2mm' }}>
          <div style={{
            fontSize: '8.5pt', fontWeight: 800, textAlign: 'left',
            borderBottom: '0.5pt solid #000', paddingBottom: '1mm', marginBottom: '1.5mm',
            color: '#93000a',
          }}>🎯 GOAL AVVERSARI</div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{
              fontSize: '7pt', display: 'flex', alignItems: 'baseline', gap: '1.5mm',
              padding: '0.5mm 0', borderBottom: '0.3pt dashed #999',
            }}>
              <span style={{ fontWeight: 700 }}>min:</span>
              <span className="fill" style={{ width: '10mm' }} />
              <span style={{ fontSize: '6pt' }}>
                <span style={{ display: 'inline-block', width: '2mm', height: '2mm', border: '0.4pt solid #000', verticalAlign: 'middle' }} /> rig
                <span style={{ display: 'inline-block', width: '2mm', height: '2mm', border: '0.4pt solid #000', marginLeft: '1.5mm', verticalAlign: 'middle' }} /> autoret
              </span>
            </div>
          ))}
        </div>
        {/* Sostituzioni 10 slot */}
        <div className="box" style={{ padding: '1.5mm 2mm' }}>
          <div style={{
            fontSize: '8.5pt', fontWeight: 800, textAlign: 'left',
            borderBottom: '0.5pt solid #000', paddingBottom: '1mm', marginBottom: '1.5mm',
            color: '#005f98',
          }}>🔄 SOSTITUZIONI</div>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} style={{
              fontSize: '7pt', display: 'flex', alignItems: 'baseline', gap: '1mm',
              padding: '0.3mm 0', borderBottom: '0.3pt dashed #999',
            }}>
              <span style={{ fontWeight: 700, minWidth: '7mm' }}>min:</span>
              <span className="fill" style={{ width: '5mm' }} />
              <span style={{ fontWeight: 700 }}>⬆</span>
              <span className="fill" style={{ flex: 1 }} />
              <span style={{ fontWeight: 700 }}>⬇</span>
              <span className="fill" style={{ flex: 1 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============ Footer: ammonizioni, espulsioni, note ============

function Footer() {
  return (
    <div className="box" style={{ padding: '1.5mm 2mm', display: 'flex', flexDirection: 'column', gap: '1.5mm' }}>
      {/* Ammonizioni: 8 slot orizzontali */}
      <div>
        <div style={{ fontSize: '8pt', fontWeight: 800, color: '#8e6300', marginBottom: '1mm' }}>
          🟨 AMMONIZIONI
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '2mm', fontSize: '7pt' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '1mm' }}>
              <span style={{ fontWeight: 700 }}>min:</span>
              <span className="fill" style={{ width: '5mm' }} />
              <span style={{ fontWeight: 700 }}>#:</span>
              <span className="fill" style={{ flex: 1 }} />
            </div>
          ))}
        </div>
      </div>
      {/* Espulsioni con motivo: 2 slot */}
      <div>
        <div style={{ fontSize: '8pt', fontWeight: 800, color: '#93000a', marginBottom: '1mm' }}>
          🟥 ESPULSIONI
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3mm', fontSize: '7pt' }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '1mm' }}>
              <span style={{ fontWeight: 700 }}>min:</span>
              <span className="fill" style={{ width: '5mm' }} />
              <span style={{ fontWeight: 700 }}>#:</span>
              <span className="fill" style={{ width: '8mm' }} />
              <span style={{ fontWeight: 700 }}>nome:</span>
              <span className="fill" style={{ width: '30mm' }} />
              <span style={{ fontWeight: 700 }}>motivo:</span>
              <span className="fill" style={{ flex: 1 }} />
            </div>
          ))}
        </div>
      </div>
      {/* Note libere */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '8pt', fontWeight: 800, marginBottom: '1mm' }}>NOTE</div>
        <div style={{
          height: '11mm', border: '0.3pt solid #999',
          backgroundImage: 'repeating-linear-gradient(transparent, transparent 3.7mm, #ddd 3.7mm, #ddd 3.8mm)',
        }} />
      </div>
    </div>
  )
}

// ============ Helpers ============

function slotShortLabel(slotKey: string): string {
  const map: Record<string, string> = {
    GK: 'GK', TD: 'TD', TS: 'TS',
    DC: 'DC', DC1: 'DC', DC2: 'DC', DC3: 'DC',
    MED: 'MED', INTD: 'INT', INTS: 'INT',
    CC: 'CC', CC1: 'CC', CC2: 'CC',
    TRQ: 'TRQ', ED: 'ED', ES: 'ES',
    AD: 'AD', AS: 'AS', PC: 'PC', PC1: 'PC', PC2: 'PC',
  }
  return map[slotKey] || slotKey
}

function slotToRoleGroup(slotKey: string): string {
  if (slotKey === 'GK') return 'GK'
  if (['TD','TS','DC','DC1','DC2','DC3'].includes(slotKey)) return 'DIF'
  if (['MED','INTD','INTS','CC','CC1','CC2','TRQ','ED','ES'].includes(slotKey)) return 'CEN'
  return 'ATT'
}

function positionToRoleGroup(position: string | null): string {
  if (!position) return '—'
  const p = position.toLowerCase()
  if (p.includes('port')) return 'GK'
  if (p.includes('dif')) return 'DIF'
  if (p.includes('cent') || p.includes('med') || p.includes('trq') || p.includes('ala')) return 'CEN'
  if (p.includes('att') || p.includes('punta')) return 'ATT'
  return '—'
}

function capFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
