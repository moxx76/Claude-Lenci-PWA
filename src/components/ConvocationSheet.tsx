import { useState, useEffect, useMemo } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'
import { generateDistintaPdf, type DistintaPlayer, type DistintaStaff } from '../lib/distintaFigc'
import { ConvocationPosterSheet } from './ConvocationPosterSheet'
import { type ConvocationPosterData } from '../lib/convocationPoster'
import { BorrowPlayerPickerSheet } from './BorrowPlayerPickerSheet'

export interface ConvocationMatch {
  id: string
  opponent: string
  match_date: string
  venue: 'home' | 'away'
  competition: string | null
  location: string | null
  location_address?: string | null
  kickoff_field?: string | null
  shirt_color_home?: string | null
  shirt_color_gk?: string | null
  meeting_time?: string | null   // "HH:MM" salvato in DB (matches.meeting_time)
  team_id: string
  team_name: string
  team_category: string | null
  team_color: string | null
}

interface Player {
  id: string
  first_name: string
  last_name: string
  birth_date: string
  position: string | null
  jersey_number: number | null
  card_number: string | null
  fiscal_code: string | null
  medical_expiry: string | null
  // Se il giocatore è "prestato" da un'altra squadra (distinta mista scuola calcio),
  // qui c'è il nome della squadra di provenienza. Undefined = del roster della squadra.
  borrowed_from_team_id?: string
  borrowed_from_team_name?: string
}

interface ConvocationRow {
  player_id: string
  status: 'accepted' | 'declined' | 'pending'
  is_captain: boolean
  is_vice_captain: boolean
  shirt_number_override: number | null
  note: string | null
}

interface Staff {
  full_name: string
  role: string
  card_number?: string | null
}

interface ConvocationSheetProps {
  open: boolean
  onClose: () => void
  match: ConvocationMatch | null
  onSaved?: () => void
  /** Se fornita, mostra un pulsante "Distinta tattica" in fondo (dopo il Save) che passa alla scheda distinta */
  onOpenDistintaTattica?: () => void
}

const CLUB_NAME = 'A.S.D. Lenci Poirino'

export function ConvocationSheet({ open, onClose, match, onSaved, onOpenDistintaTattica }: ConvocationSheetProps) {
  const [players, setPlayers] = useState<Player[]>([])
  const [rows, setRows] = useState<Record<string, ConvocationRow>>({})
  const [borrowPickerOpen, setBorrowPickerOpen] = useState(false)
  const [responses, setResponses] = useState<Record<string, { status: string; updated_at: string }>>({})
  const [staff, setStaff] = useState<Staff[]>([])
  const [shirtColorHome, setShirtColorHome] = useState('Rosso/Blu')
  const [shirtColorGk, setShirtColorGk] = useState('Viola')
  // Divise complete della squadra (caricate da teams) — per il dropdown "Casa/Trasferta"
  const [teamHomeShirt, setTeamHomeShirt] = useState('Rosso/Blu')
  const [teamHomeGk, setTeamHomeGk] = useState('Viola')
  const [teamAwayShirt, setTeamAwayShirt] = useState('Bianco/Blu')
  const [teamAwayGk, setTeamAwayGk] = useState('Giallo')
  const [kickoffField, setKickoffField] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [posterOpen, setPosterOpen] = useState(false)
  const [posterData, setPosterData] = useState<ConvocationPosterData | null>(null)
  const [meetingTimeOverride, setMeetingTimeOverride] = useState('')

  useEffect(() => {
    if (!open || !match) return
    load()
  }, [open, match?.id])

  const load = async () => {
    if (!match) return
    setLoading(true)
    // Carica rosa, convocazioni esistenti, staff (coach + dirigente della squadra), risposte giocatori
    const [playersRes, convRes, teamRes, respRes] = await Promise.all([
      supabase.from('players')
        .select('id,first_name,last_name,birth_date,position,jersey_number,card_number,fiscal_code,medical_expiry')
        .eq('team_id', match.team_id)
        .order('jersey_number', { nullsFirst: false })
        .order('last_name'),
      supabase.from('convocations')
        .select('player_id, status, note, is_captain, is_vice_captain, shirt_number_override')
        .eq('match_id', match.id),
      supabase.from('teams')
        .select(`
          default_shirt_color, default_gk_shirt_color,
          home_shirt_color, home_gk_shirt_color, away_shirt_color, away_gk_shirt_color,
          head_coach:profiles!teams_head_coach_id_fkey(full_name),
          assistant_coach:profiles!teams_assistant_coach_id_fkey(full_name),
          helper_coach:profiles!teams_helper_coach_id_fkey(full_name),
          team_manager:profiles!teams_team_manager_id_fkey(full_name),
          second_manager:profiles!teams_second_manager_id_fkey(full_name),
          third_manager:profiles!teams_third_manager_id_fkey(full_name),
          linesman:profiles!teams_linesman_id_fkey(full_name),
          masseur:profiles!teams_masseur_id_fkey(full_name)
        `)
        .eq('id', match.team_id)
        .maybeSingle(),
      supabase.from('event_responses')
        .select('player_id, status, updated_at')
        .eq('event_kind', 'match')
        .eq('event_id', match.id),
    ])
    setPlayers((playersRes.data ?? []) as Player[])
    // Mappa risposte per rendering
    const rmap: Record<string, { status: string; updated_at: string }> = {}
    for (const r of (respRes.data ?? [])) rmap[r.player_id] = r
    setResponses(rmap)

    // Se non ci sono convocazioni pregresse, inizializzo tutti a "pending"
    const map: Record<string, ConvocationRow> = {}
    for (const c of convRes.data ?? []) {
      map[c.player_id] = {
        player_id: c.player_id,
        status: c.status as any,
        is_captain: !!c.is_captain,
        is_vice_captain: !!(c as any).is_vice_captain,
        shirt_number_override: c.shirt_number_override,
        note: c.note,
      }
    }
    setRows(map)

    // Se ci sono convocazioni per giocatori NON nel roster della squadra
    // (perché "prestati" da altre categorie in distinte miste), li carico
    // separatamente e li appendo a players con badge di categoria.
    const rosterIds = new Set((playersRes.data ?? []).map((p: any) => p.id))
    const borrowedIds = (convRes.data ?? [])
      .map((c: any) => c.player_id)
      .filter((id: string) => !rosterIds.has(id))
    if (borrowedIds.length > 0) {
      const { data: borrowedData } = await supabase
        .from('players')
        .select('id,first_name,last_name,birth_date,position,jersey_number,card_number,fiscal_code,medical_expiry,team_id,team:teams(name)')
        .in('id', borrowedIds)
      const borrowedPlayers: Player[] = ((borrowedData ?? []) as any[]).map(p => ({
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        birth_date: p.birth_date,
        position: p.position,
        jersey_number: p.jersey_number,
        card_number: p.card_number,
        fiscal_code: p.fiscal_code,
        medical_expiry: p.medical_expiry,
        borrowed_from_team_id: p.team_id,
        borrowed_from_team_name: p.team?.name ?? '?',
      }))
      setPlayers(prev => [...prev, ...borrowedPlayers])
    }

    // Staff — ordine gerarchico distinta FIGC:
    // tecnici prima, dirigenziali dopo, sanitario in fondo
    const staffList: Staff[] = []
    const tData: any = teamRes.data
    const pushIfPresent = (rel: any, role: string) => {
      // Supabase può restituire array o oggetto per one-to-one, gestisco entrambi
      const p = Array.isArray(rel) ? rel[0] : rel
      if (p?.full_name) staffList.push({ full_name: p.full_name, role })
    }
    pushIfPresent(tData?.head_coach, 'Allenatore')
    pushIfPresent(tData?.assistant_coach, 'Allenatore in seconda')
    pushIfPresent(tData?.helper_coach, 'Aiuto allenatore')
    pushIfPresent(tData?.team_manager, 'Dirigente Accompagnatore')
    pushIfPresent(tData?.second_manager, 'Secondo Dirigente Accompagnatore')
    pushIfPresent(tData?.third_manager, 'Terzo Dirigente Accompagnatore')
    pushIfPresent(tData?.linesman, 'Guardalinee di casa')
    pushIfPresent(tData?.masseur, 'Massaggiatore')
    setStaff(staffList)

    // Cache divise squadra (per dropdown Casa/Trasferta)
    const hs = tData?.home_shirt_color || tData?.default_shirt_color || 'Rosso/Blu'
    const hgk = tData?.home_gk_shirt_color || tData?.default_gk_shirt_color || 'Viola'
    const as_ = tData?.away_shirt_color || 'Bianco/Blu'
    const agk = tData?.away_gk_shirt_color || 'Giallo'
    setTeamHomeShirt(hs)
    setTeamHomeGk(hgk)
    setTeamAwayShirt(as_)
    setTeamAwayGk(agk)

    // Se il match ha già una scelta salvata la uso, altrimenti precompilo in base al venue
    if (match.shirt_color_home || match.shirt_color_gk) {
      setShirtColorHome(match.shirt_color_home || hs)
      setShirtColorGk(match.shirt_color_gk || hgk)
    } else {
      // In casa → divisa casa; in trasferta → divisa away
      setShirtColorHome(match.venue === 'away' ? as_ : hs)
      setShirtColorGk(match.venue === 'away' ? agk : hgk)
    }
    setKickoffField(match.kickoff_field || match.location || '')
    // Precompilo l'orario ritrovo dal DB (persistito nella colonna matches.meeting_time)
    setMeetingTimeOverride(match.meeting_time || '')

    setLoading(false)
  }

  const toggleConvocation = (pid: string) => {
    setRows(r => {
      const cur = r[pid]
      const newStatus: 'accepted' | 'pending' = cur?.status === 'accepted' ? 'pending' : 'accepted'
      return { ...r, [pid]: {
        player_id: pid,
        status: newStatus,
        is_captain: newStatus === 'accepted' ? (cur?.is_captain ?? false) : false,
        is_vice_captain: newStatus === 'accepted' ? (cur?.is_vice_captain ?? false) : false,
        shirt_number_override: cur?.shirt_number_override ?? null,
        note: cur?.note ?? null,
      } }
    })
  }

  const setCaptain = (pid: string) => {
    setRows(r => {
      const next: Record<string, ConvocationRow> = {}
      for (const [k, v] of Object.entries(r)) {
        // Se questo diventa il nuovo capitano E era vice → rimuovi vice
        const willBeCaptain = k === pid && v.status === 'accepted'
        next[k] = {
          ...v,
          is_captain: willBeCaptain,
          is_vice_captain: willBeCaptain ? false : v.is_vice_captain,
        }
      }
      // Se il capitano non è nella lista (non era convocato) → convocalo
      if (!next[pid]) {
        next[pid] = { player_id: pid, status: 'accepted', is_captain: true, is_vice_captain: false, shirt_number_override: null, note: null }
      } else if (next[pid].status !== 'accepted') {
        next[pid] = { ...next[pid], status: 'accepted', is_captain: true, is_vice_captain: false }
      }
      return next
    })
  }

  // Vice capitano: uno solo, non può coincidere col capitano titolare
  const setViceCaptain = (pid: string) => {
    setRows(r => {
      const next: Record<string, ConvocationRow> = {}
      for (const [k, v] of Object.entries(r)) {
        // Il vice non può essere anche capitano: se questo era capitano, resta capitano e non è vice
        const willBeVice = k === pid && v.status === 'accepted' && !v.is_captain
        next[k] = { ...v, is_vice_captain: willBeVice }
      }
      if (!next[pid]) {
        next[pid] = { player_id: pid, status: 'accepted', is_captain: false, is_vice_captain: true, shirt_number_override: null, note: null }
      } else if (next[pid].status !== 'accepted') {
        next[pid] = { ...next[pid], status: 'accepted', is_vice_captain: true }
      }
      return next
    })
  }

  const setShirtOverride = (pid: string, val: string) => {
    setRows(r => ({
      ...r,
      [pid]: {
        ...(r[pid] || { player_id: pid, status: 'accepted', is_captain: false, is_vice_captain: false, shirt_number_override: null, note: null }),
        shirt_number_override: val ? parseInt(val, 10) : null,
      },
    }))
  }

  const selectAll = () => {
    const next: Record<string, ConvocationRow> = { ...rows }
    for (const p of players) {
      if (!next[p.id] || next[p.id].status !== 'accepted') {
        next[p.id] = {
          player_id: p.id,
          status: 'accepted',
          is_captain: next[p.id]?.is_captain ?? false,
          is_vice_captain: next[p.id]?.is_vice_captain ?? false,
          shirt_number_override: next[p.id]?.shirt_number_override ?? null,
          note: next[p.id]?.note ?? null,
        }
      }
    }
    setRows(next)
  }

  const clearAll = () => setRows({})

  const convocatedList = useMemo(
    () => players.filter(p => rows[p.id]?.status === 'accepted'),
    [players, rows]
  )

  const handleSave = async () => {
    if (!match) return
    setSaving(true)
    try {
      // 1. Salva colori maglie e campo sulla matches
      await supabase.from('matches').update({
        shirt_color_home: shirtColorHome || null,
        shirt_color_gk: shirtColorGk || null,
        kickoff_field: kickoffField || null,
        meeting_time: meetingTimeOverride.trim() || null,
      }).eq('id', match.id)

      // 2. Sostituisce le convocazioni: delete + insert
      await supabase.from('convocations').delete().eq('match_id', match.id)
      const inserts = Object.values(rows)
        .filter(r => r.status === 'accepted')
        .map(r => ({
          match_id: match.id,
          player_id: r.player_id,
          status: r.status,
          is_captain: r.is_captain,
          is_vice_captain: r.is_vice_captain,
          shirt_number_override: r.shirt_number_override,
          note: r.note,
        }))
      if (inserts.length > 0) {
        const { error } = await supabase.from('convocations').insert(inserts)
        if (error) throw error
      }
      setSavedOk(true)
      onSaved?.()
      setTimeout(() => setSavedOk(false), 1500)
    } catch (e: any) {
      alert('Errore salvataggio: ' + (e.message || 'sconosciuto'))
    } finally {
      setSaving(false)
    }
  }

  const handleGeneratePdf = async () => {
    if (!match) return
    if (convocatedList.length === 0) {
      alert('Convoca almeno un giocatore prima di generare la distinta.')
      return
    }
    setGenerating(true)
    try {
      // Prima salva tutto
      await handleSave()

      // Fetch parallelo di:
      //   1. was_starter da match_player_stats (se la distinta tattica è stata compilata)
      //   2. federation_code del club (matricola FIGC della società) via team → club join,
      //      dato che ConvocationMatch non porta il club_id direttamente ma solo team_id
      const [statsRes, teamRes] = await Promise.allSettled([
        supabase.from('match_player_stats')
          .select('player_id, was_starter')
          .eq('match_id', match.id),
        supabase.from('teams')
          .select('club:clubs(federation_code)')
          .eq('id', match.team_id)
          .maybeSingle(),
      ])
      const starterMap = new Map<string, boolean>()
      if (statsRes.status === 'fulfilled' && statsRes.value.data) {
        for (const s of statsRes.value.data as any[]) {
          starterMap.set(s.player_id, !!s.was_starter)
        }
      }
      const federationCode = teamRes.status === 'fulfilled'
        ? ((teamRes.value.data as any)?.club?.federation_code ?? null)
        : null

      const pdfPlayers: DistintaPlayer[] = convocatedList
        .map(p => {
          const row = rows[p.id]
          return {
            shirt_number: row?.shirt_number_override ?? p.jersey_number,
            last_name: p.last_name,
            first_name: p.first_name,
            birth_date: p.birth_date,
            card_number: p.card_number,
            fiscal_code: p.fiscal_code,
            position: p.position,
            is_captain: !!row?.is_captain,
            is_vice_captain: !!row?.is_vice_captain,
            is_starter: starterMap.get(p.id) ?? false,
            is_goalkeeper: p.position === 'Portiere',
          }
        })
        // Ordinamento: prima i titolari (per ruolo poi maglia), poi le riserve.
        // Se nessuno è titolare (distinta tattica non compilata), fallback all'ordine
        // storico: portieri prima, poi per numero maglia.
        .sort((a, b) => {
          if (a.is_starter !== b.is_starter) return a.is_starter ? -1 : 1
          if (a.is_goalkeeper && !b.is_goalkeeper) return -1
          if (!a.is_goalkeeper && b.is_goalkeeper) return 1
          const na = a.shirt_number ?? 999
          const nb = b.shirt_number ?? 999
          return na - nb
        })

      const staffList: DistintaStaff[] = staff.map(s => ({
        full_name: s.full_name,
        role: s.role,
        card_number: s.card_number,
      }))

      const pdf = await generateDistintaPdf({
        match: {
          opponent: match.opponent,
          match_date: match.match_date,
          venue: match.venue,
          competition: match.competition,
          location: match.location,
          location_address: match.location_address || null,
          kickoff_field: kickoffField || null,
          shirt_color_home: shirtColorHome,
          shirt_color_gk: shirtColorGk,
        },
        team: {
          name: match.team_name,
          category: match.team_category,
          club_name: CLUB_NAME,
          federation_code: federationCode,
        },
        players: pdfPlayers,
        staff: staffList,
      })

      const fname = `distinta_${match.team_category || 'squadra'}_vs_${match.opponent.replace(/\s+/g, '-')}_${match.match_date.slice(0,10)}.pdf`
      pdf.save(fname)
    } catch (e: any) {
      alert('Errore generazione PDF: ' + (e.message || 'sconosciuto'))
    } finally {
      setGenerating(false)
    }
  }

  const handleGeneratePoster = () => {
    if (!match) return
    if (convocatedList.length === 0) {
      alert('Convoca almeno un giocatore prima di generare la locandina.')
      return
    }
    // Nome mister: primo Allenatore in staff, fallback Dirigente
    const coach = staff.find(s => s.role.toLowerCase().includes('allenatore'))
    const manager = staff.find(s => s.role.toLowerCase().includes('dirigente'))
    const coachName = coach?.full_name || manager?.full_name || null

    // Estraggo orario dalla data match (venue independent)
    const md = new Date(match.match_date)
    const timeStr = isNaN(md.getTime())
      ? null
      : `${String(md.getHours()).padStart(2, '0')}:${String(md.getMinutes()).padStart(2, '0')}`

    // Ora ritrovo: se l'utente ha specificato un orario custom lo usa,
    // altrimenti calcola 1 ora prima del calcio d'inizio (default automatico)
    let meetingTimeStr: string | null = null
    const override = meetingTimeOverride.trim()
    if (override && /^\d{1,2}:\d{2}$/.test(override)) {
      // Normalizzo a HH:MM (aggiunge zero iniziale se manca)
      const [h, m] = override.split(':')
      meetingTimeStr = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
    } else if (!isNaN(md.getTime())) {
      const meet = new Date(md.getTime() - 60 * 60 * 1000)
      meetingTimeStr = `${String(meet.getHours()).padStart(2, '0')}:${String(meet.getMinutes()).padStart(2, '0')}`
    }

    // Location: preferisci kickoff_field se è casa, altrimenti location
    const loc = match.venue === 'home'
      ? (match.kickoff_field || match.location || null)
      : (match.location || null)

    // Giocatori ordinati: portieri prima, poi per numero maglia
    const posterPlayers = convocatedList
      .map(p => {
        const row = rows[p.id]
        return {
          number: row?.shirt_number_override ?? p.jersey_number,
          firstName: p.first_name,
          lastName: p.last_name,
          isCaptain: !!row?.is_captain,
          isGk: p.position === 'Portiere',
        }
      })
      .sort((a, b) => {
        if (a.isGk && !b.isGk) return -1
        if (!a.isGk && b.isGk) return 1
        const na = a.number ?? 999
        const nb = b.number ?? 999
        return na - nb
      })
      .map(({ number, firstName, lastName, isCaptain }) => ({ number, firstName, lastName, isCaptain }))

    setPosterData({
      teamName: match.team_name || match.team_category || '',
      opponent: match.opponent,
      matchDate: match.match_date,
      matchTime: timeStr,
      meetingTime: meetingTimeStr,
      venue: match.venue,
      location: loc,
      locationAddress: match.location_address || null,
      competition: match.competition,
      players: posterPlayers,
      coachName,
      dressNote: 'Presentarsi con divisa di rappresentanza',
    })
    setPosterOpen(true)
  }

  if (!match) return null

  const acceptedCount = Object.values(rows).filter(r => r.status === 'accepted').length
  const captainId = Object.values(rows).find(r => r.is_captain)?.player_id
  const dateStr = new Date(match.match_date).toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  })

  return (
    <BottomSheet open={open} onClose={onClose} title="Convocazione partita" maxHeight="95vh">
      <div style={{ padding: '4px 18px 24px' }}>
        {/* Match header */}
        <div style={{
          background: 'linear-gradient(135deg, #b3005c 0%, #6a0036 100%)',
          borderRadius: 14, padding: 14, color: '#fff',
          marginBottom: 14,
        }}>
          <div style={{ fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.9, marginBottom: 4 }}>
            {match.venue === 'home' ? '🏠 IN CASA' : '✈️ IN TRASFERTA'}
            {match.competition && ` · ${match.competition}`}
          </div>
          <h3 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 18, margin: 0, lineHeight: 1.2 }}>
            {match.team_category} vs {match.opponent}
          </h3>
          <p style={{ fontSize: 12, margin: '4px 0 0', opacity: 0.9, textTransform: 'capitalize' }}>
            {dateStr}
            {match.location && ` · ${match.location}`}
          </p>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#707882', fontSize: 13 }}>
            Caricamento rosa…
          </div>
        ) : (
          <>
            {/* Info gara editable */}
            <div style={{
              background: '#f7f9ff', border: '1px solid #e6e8ee',
              borderRadius: 12, padding: 12, marginBottom: 14,
            }}>
              <h4 style={{
                fontSize: 10, fontWeight: 800, color: '#404751',
                textTransform: 'uppercase', letterSpacing: '0.04em',
                margin: '0 0 8px',
              }}>
                Dati per la distinta arbitro
              </h4>

              {/* Pill preset divise */}
              <div style={{ marginBottom: 10 }}>
                <label style={smallLabelStyle}>Preset divisa</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {(() => {
                    const isCustom = (shirtColorHome !== teamHomeShirt || shirtColorGk !== teamHomeGk)
                                     && (shirtColorHome !== teamAwayShirt || shirtColorGk !== teamAwayGk)
                    const isHomeSel = !isCustom && shirtColorHome === teamHomeShirt && shirtColorGk === teamHomeGk
                    const isAwaySel = !isCustom && shirtColorHome === teamAwayShirt && shirtColorGk === teamAwayGk
                    return (
                      <>
                        <button
                          onClick={() => { setShirtColorHome(teamHomeShirt); setShirtColorGk(teamHomeGk) }}
                          style={presetPillStyle(isHomeSel, '#005f98')}
                        >
                          🏠 Casa · {teamHomeShirt}
                        </button>
                        <button
                          onClick={() => { setShirtColorHome(teamAwayShirt); setShirtColorGk(teamAwayGk) }}
                          style={presetPillStyle(isAwaySel, '#c1006c')}
                        >
                          ✈ Trasferta · {teamAwayShirt}
                        </button>
                        {isCustom && (
                          <span style={{
                            padding: '5px 10px', borderRadius: 999,
                            background: '#fff8e6', color: '#7c4700',
                            fontSize: 10.5, fontWeight: 700, border: '1px solid #ffdca8',
                          }}>
                            ✏️ Personalizzata
                          </span>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={smallLabelStyle}>Maglia giocatori</label>
                  <input value={shirtColorHome} onChange={e => setShirtColorHome(e.target.value)}
                    placeholder="es. Blu/Bianco" style={smallInputStyle} />
                </div>
                <div>
                  <label style={smallLabelStyle}>Maglia portiere</label>
                  <input value={shirtColorGk} onChange={e => setShirtColorGk(e.target.value)}
                    placeholder="es. Giallo" style={smallInputStyle} />
                </div>
                <div style={{ gridColumn: '1 / 3' }}>
                  <label style={smallLabelStyle}>Campo di gioco</label>
                  <input value={kickoffField} onChange={e => setKickoffField(e.target.value)}
                    placeholder="es. Campo Sportivo Poirino" style={smallInputStyle} />
                </div>
              </div>
            </div>

            {/* Toolbar convocati */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 10, gap: 8, flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{
                  background: acceptedCount > 0 ? '#006e25' : '#e6e8ee',
                  color: acceptedCount > 0 ? '#fff' : '#404751',
                  padding: '5px 12px', borderRadius: 999,
                  fontSize: 12, fontWeight: 800,
                }}>
                  {acceptedCount} convocati
                </span>
                {captainId && (
                  <span style={{
                    background: 'rgba(255,209,0,0.35)', color: '#8e6300',
                    padding: '5px 10px', borderRadius: 999,
                    fontSize: 11, fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 3,
                  }}>
                    <Icon name="star" size={12} color="#8e6300" /> Capitano assegnato
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => setBorrowPickerOpen(true)} style={miniBtn('#7b4bff', '#ece5ff')}>
                  <Icon name="person_add" size={12} color="#7b4bff" /> Da altra categoria
                </button>
                <button onClick={selectAll} style={miniBtn('#005f98', '#cfe5ff')}>
                  Convoca tutti
                </button>
                <button onClick={clearAll} style={miniBtn('#404751', '#e6e8ee')}>
                  Azzera
                </button>
              </div>
            </div>

            {/* Card riassuntiva delle risposte dalla landing pubblica presenze */}
            <PresenzeSummaryCard players={players} responses={responses} />

            {/* Lista giocatori */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {players.map(p => {
                const row = rows[p.id]
                const isConvocated = row?.status === 'accepted'
                const isCap = !!row?.is_captain
                const isVice = !!row?.is_vice_captain
                const shirtNum = row?.shirt_number_override ?? p.jersey_number
                const medExpires = p.medical_expiry
                  ? Math.floor((new Date(p.medical_expiry).getTime() - Date.now()) / 86400000)
                  : null
                const medWarn = medExpires !== null && medExpires < 0
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '9px 10px', borderRadius: 10,
                    background: isConvocated ? 'rgba(128,249,139,0.15)' : '#fff',
                    border: `1px solid ${isConvocated ? '#80f98b' : '#e6e8ee'}`,
                  }}>
                    <button
                      onClick={() => toggleConvocation(p.id)}
                      style={{
                        width: 28, height: 28, borderRadius: 8, border: 'none',
                        background: isConvocated ? '#006e25' : '#e6e8ee',
                        color: '#fff', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon name={isConvocated ? 'check' : 'add'} size={14} color={isConvocated ? '#fff' : '#707882'} />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={shirtNum ?? ''}
                      onChange={e => setShirtOverride(p.id, e.target.value)}
                      disabled={!isConvocated}
                      placeholder="#"
                      style={{
                        width: 42, padding: '4px 6px', borderRadius: 6,
                        border: '1px solid #c0c7d2', fontSize: 12,
                        textAlign: 'center', fontWeight: 700,
                        background: isConvocated ? '#fff' : '#f1f3fa',
                        color: isConvocated ? '#181c20' : '#707882',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#181c20', lineHeight: 1.2 }}>
                          {p.last_name} {p.first_name}
                        </span>
                        {p.borrowed_from_team_name && (
                          <span style={{
                            fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 999,
                            background: '#ece5ff', color: '#7b4bff',
                          }} title={`Prestato da ${p.borrowed_from_team_name}`}>
                            ↕ {p.borrowed_from_team_name}
                          </span>
                        )}
                        {responses[p.id] && (
                          <span style={{
                            fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 999,
                            display: 'inline-flex', alignItems: 'center', gap: 2,
                            background: responses[p.id].status === 'yes' ? 'rgba(0,110,37,0.15)'
                              : responses[p.id].status === 'no' ? 'rgba(186,26,26,0.15)'
                              : 'rgba(142,99,0,0.15)',
                            color: responses[p.id].status === 'yes' ? '#006e25'
                              : responses[p.id].status === 'no' ? '#93000a'
                              : '#8e6300',
                          }} title={`Risposta dal giocatore il ${new Date(responses[p.id].updated_at).toLocaleString('it-IT')}`}>
                            {responses[p.id].status === 'yes' ? '✅ VENGO'
                              : responses[p.id].status === 'no' ? '❌ NO'
                              : '❓ FORSE'}
                          </span>
                        )}
                        {p.position === 'Portiere' && (
                          <span style={{
                            fontSize: 9, fontWeight: 800, padding: '2px 5px', borderRadius: 4,
                            background: '#ffdad6', color: '#93000a',
                          }}>P</span>
                        )}
                        {isCap && (
                          <span style={{
                            fontSize: 9, fontWeight: 800, padding: '2px 5px', borderRadius: 4,
                            background: 'rgba(255,209,0,0.35)', color: '#8e6300',
                            display: 'inline-flex', alignItems: 'center', gap: 2,
                          }}>
                            <Icon name="star" size={9} color="#8e6300" /> CAP
                          </span>
                        )}
                        {isVice && (
                          <span style={{
                            fontSize: 9, fontWeight: 800, padding: '2px 5px', borderRadius: 4,
                            background: 'rgba(0,95,152,0.18)', color: '#005f98',
                            display: 'inline-flex', alignItems: 'center', gap: 2,
                          }}>
                            <Icon name="star_half" size={9} color="#005f98" /> VICE
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 10.5, color: '#707882', display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span>Mat. {p.card_number || '—'}</span>
                        {medWarn && (
                          <span style={{ color: '#93000a', fontWeight: 700 }}>
                            ⚠ Cert. medico scaduto
                          </span>
                        )}
                      </div>
                    </div>
                    {isConvocated && (
                      <>
                        <button
                          onClick={() => setCaptain(p.id)}
                          title={isCap ? 'Capitano' : 'Nomina capitano'}
                          style={{
                            width: 28, height: 28, borderRadius: 8, border: 'none',
                            background: isCap ? 'rgba(255,209,0,0.35)' : 'transparent',
                            cursor: 'pointer', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Icon name="star" size={16} color={isCap ? '#8e6300' : '#c0c7d2'} />
                        </button>
                        <button
                          onClick={() => setViceCaptain(p.id)}
                          disabled={isCap}
                          title={isCap ? 'Il capitano non può essere anche vice' : (isVice ? 'Vice capitano' : 'Nomina vice capitano')}
                          style={{
                            width: 28, height: 28, borderRadius: 8, border: 'none',
                            background: isVice ? 'rgba(0,95,152,0.18)' : 'transparent',
                            cursor: isCap ? 'not-allowed' : 'pointer',
                            opacity: isCap ? 0.35 : 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Icon name="star_half" size={16} color={isVice ? '#005f98' : '#c0c7d2'} />
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Bottoni azione */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Orario ritrovo per la locandina (opzionale) */}
              {(() => {
                const md = match?.match_date ? new Date(match.match_date) : null
                let autoMeeting: string | null = null
                if (md && !isNaN(md.getTime())) {
                  const meet = new Date(md.getTime() - 60 * 60 * 1000)
                  autoMeeting = `${String(meet.getHours()).padStart(2, '0')}:${String(meet.getMinutes()).padStart(2, '0')}`
                }
                return (
                  <div style={{
                    padding: '10px 12px', borderRadius: 10,
                    background: '#f0f7ff', border: '1px solid #cfe3f7',
                  }}>
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 11.5, fontWeight: 700, color: '#004a78',
                      textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6,
                    }}>
                      <Icon name="schedule" size={14} color="#004a78" />
                      Orario ritrovo · locandina
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="time"
                        value={meetingTimeOverride}
                        onChange={e => setMeetingTimeOverride(e.target.value)}
                        step={300}
                        style={{
                          flex: '0 0 auto', padding: '8px 10px', borderRadius: 8,
                          border: '1px solid #b3d2ee', background: '#fff',
                          fontSize: 14, fontWeight: 700, color: '#004a78',
                        }}
                      />
                      {meetingTimeOverride && (
                        <button
                          type="button"
                          onClick={() => setMeetingTimeOverride('')}
                          style={{
                            padding: '6px 10px', borderRadius: 8,
                            border: '1px solid #cfe3f7', background: '#fff',
                            color: '#004a78', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          Usa automatico
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#5c7a95', marginTop: 6 }}>
                      {meetingTimeOverride
                        ? `Verrà stampato: ritrovo alle ${meetingTimeOverride}`
                        : autoMeeting
                          ? `Se lasciato vuoto viene calcolato ${autoMeeting} (1h prima del kickoff)`
                          : 'Se lasciato vuoto viene calcolato 1h prima del calcio d\u2019inizio'}
                    </div>
                  </div>
                )
              })()}
              <button
                onClick={handleGeneratePdf}
                disabled={saving || generating || acceptedCount === 0}
                style={{
                  padding: '13px 18px', borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg, #b3005c 0%, #6a0036 100%)',
                  color: '#fff', fontSize: 13.5, fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 8px 20px rgba(179,0,92,0.28)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: (saving || generating || acceptedCount === 0) ? 0.6 : 1,
                }}
              >
                <Icon name="picture_as_pdf" size={17} color="#fff" />
                {generating ? 'Genero distinta…' : 'Salva e genera distinta FIGC'}
              </button>
              <button
                onClick={handleGeneratePoster}
                disabled={saving || generating || acceptedCount === 0}
                style={{
                  padding: '12px 18px', borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                  color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 6px 16px rgba(37,211,102,0.32)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: (saving || generating || acceptedCount === 0) ? 0.6 : 1,
                }}
              >
                <Icon name="image" size={16} color="#fff" />
                Genera locandina per WhatsApp
              </button>
              <button
                onClick={handleSave}
                disabled={saving || generating}
                style={{
                  padding: '11px 18px', borderRadius: 12, border: '1px solid #005f98',
                  background: savedOk ? '#006e25' : '#fff',
                  color: savedOk ? '#fff' : '#005f98',
                  fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: (saving || generating) ? 0.6 : 1,
                  transition: 'background 0.2s',
                }}
              >
                <Icon name={savedOk ? 'check_circle' : 'save'} size={15} color={savedOk ? '#fff' : '#005f98'} />
                {savedOk ? 'Salvato!' : (saving ? 'Salvo…' : 'Solo salva convocazione')}
              </button>
            </div>
            {/* Pulsante per passare alla Distinta Tattica (fornito dal parent quando disponibile) */}
            {onOpenDistintaTattica && acceptedCount > 0 && (
              <button
                onClick={() => { onOpenDistintaTattica(); onClose() }}
                style={{
                  width: '100%', marginTop: 10, padding: '11px 14px', borderRadius: 10,
                  border: '1.5px solid #005f98', background: '#f0f9ff', color: '#005f98',
                  fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <Icon name="dashboard" size={15} color="#005f98" />
                Prosegui con la Distinta tattica (modulo & titolari) →
              </button>
            )}
          </>
        )}
      </div>

      {/* Sheet locandina WhatsApp */}
      <ConvocationPosterSheet
        open={posterOpen}
        onClose={() => setPosterOpen(false)}
        data={posterData}
      />

      {/* Picker per convocare giocatori da altre categorie (distinte miste) */}
      {match && (
        <BorrowPlayerPickerSheet
          open={borrowPickerOpen}
          onClose={() => setBorrowPickerOpen(false)}
          excludeTeamId={match.team_id}
          excludePlayerIds={players.map(p => p.id)}
          onSelect={(chosen) => {
            // Aggiungo i selezionati al roster con badge di provenienza,
            // e li imposto automaticamente come convocati (accepted)
            setPlayers(prev => [
              ...prev,
              ...chosen.map(c => ({
                id: c.id,
                first_name: c.first_name,
                last_name: c.last_name,
                birth_date: c.birth_date,
                position: c.position,
                jersey_number: c.jersey_number,
                card_number: c.card_number,
                fiscal_code: c.fiscal_code,
                medical_expiry: c.medical_expiry,
                borrowed_from_team_id: c.team_id,
                borrowed_from_team_name: c.team_name,
              })),
            ])
            setRows(prev => {
              const next = { ...prev }
              for (const c of chosen) {
                next[c.id] = {
                  player_id: c.id,
                  status: 'accepted',
                  is_captain: false,
                  is_vice_captain: false,
                  shirt_number_override: null,
                  note: null,
                }
              }
              return next
            })
          }}
        />
      )}
    </BottomSheet>
  )
}

const smallLabelStyle: React.CSSProperties = {
  fontSize: 9.5, fontWeight: 700, color: '#404751',
  textTransform: 'uppercase', letterSpacing: '0.03em',
  display: 'block', marginBottom: 3,
}
const smallInputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 8,
  border: '1px solid #c0c7d2', fontSize: 12.5,
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  background: '#fff',
}
const miniBtn = (fg: string, bg: string): React.CSSProperties => ({
  padding: '5px 10px', borderRadius: 6, border: 'none',
  background: bg, color: fg, fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
})

const presetPillStyle = (active: boolean, color: string): React.CSSProperties => ({
  padding: '6px 12px', borderRadius: 999,
  background: active ? color : '#fff',
  color: active ? '#fff' : color,
  border: `1px solid ${color}`,
  fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  whiteSpace: 'nowrap',
})

/**
 * Card riassuntiva delle risposte dei giocatori dalla landing pubblica presenze.
 * Mostra 4 KPI (Sì / Forse / No / Non risposto) cliccabili per espandere l'elenco nomi.
 * Analoga alla card presenze del TrainingDetailSheet ma pesca da event_responses
 * (che riceve i dati dalla landing lenci-poirino-presenze.netlify.app).
 */
function PresenzeSummaryCard({
  players, responses,
}: {
  players: Player[]
  responses: Record<string, { status: string; updated_at: string }>
}) {
  const [expanded, setExpanded] = useState<'yes' | 'no' | 'maybe' | 'none' | null>(null)

  // Aggrego giocatori per status della risposta
  const groups = { yes: [] as Player[], maybe: [] as Player[], no: [] as Player[], none: [] as Player[] }
  for (const p of players) {
    const r = responses[p.id]
    if (!r) groups.none.push(p)
    else if (r.status === 'yes') groups.yes.push(p)
    else if (r.status === 'maybe') groups.maybe.push(p)
    else if (r.status === 'no') groups.no.push(p)
    else groups.none.push(p)
  }
  const totalResponded = groups.yes.length + groups.maybe.length + groups.no.length
  const nome = (p: Player) => `${p.last_name} ${p.first_name}`

  return (
    <div style={{
      marginBottom: 12,
      padding: 12,
      background: '#f6f8fc',
      border: '1px solid #e0e2e9',
      borderRadius: 12,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#005f98' }}>how_to_reg</span>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#181c20' }}>
          Disponibilità dai ragazzi
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 10.5, color: '#707882', fontWeight: 600 }}>
          {totalResponded} di {players.length} hanno risposto
        </div>
      </div>

      {/* 4 KPI cliccabili */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        <PresenzeKpi label="Vengono" value={groups.yes.length}   color="#006e25" bg="#d4f2dd" active={expanded==='yes'}   onClick={() => setExpanded(expanded==='yes'?null:'yes')} />
        <PresenzeKpi label="Forse"    value={groups.maybe.length} color="#8e6300" bg="#fff3d1" active={expanded==='maybe'} onClick={() => setExpanded(expanded==='maybe'?null:'maybe')} />
        <PresenzeKpi label="Non vengono" value={groups.no.length} color="#93000a" bg="#ffdad6" active={expanded==='no'}    onClick={() => setExpanded(expanded==='no'?null:'no')} />
        <PresenzeKpi label="Non risposto" value={groups.none.length} color="#404751" bg="#e6e8ee" active={expanded==='none'} onClick={() => setExpanded(expanded==='none'?null:'none')} />
      </div>

      {/* Elenco nomi del gruppo selezionato */}
      {expanded && (
        <div style={{
          padding: '8px 10px', background: '#fff', borderRadius: 8, border: '1px solid #e0e2e9',
          fontSize: 12, color: '#181c20', lineHeight: 1.7,
        }}>
          {groups[expanded].length === 0 ? (
            <span style={{ fontStyle: 'italic', color: '#707882' }}>Nessun giocatore in questo stato</span>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {groups[expanded].map(p => (
                <span key={p.id} style={{
                  padding: '3px 8px', background: '#f1f3fa', borderRadius: 6,
                  fontSize: 11.5, fontWeight: 600,
                }}>{nome(p)}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nota per il coach */}
      {totalResponded === 0 && (
        <div style={{ fontSize: 10.5, color: '#707882', fontStyle: 'italic', textAlign: 'center', padding: '4px 0' }}>
          Nessuna risposta ancora. Condividi il link della landing pubblica sul gruppo WhatsApp.
        </div>
      )}
    </div>
  )
}

function PresenzeKpi({
  label, value, color, bg, active, onClick,
}: { label: string; value: number; color: string; bg: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: bg,
      border: active ? `2px solid ${color}` : `1px solid ${color}22`,
      borderRadius: 10, padding: '8px 4px', cursor: 'pointer', fontFamily: 'inherit',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    }}>
      <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: '#404751', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' }}>
        {label}
      </div>
    </button>
  )
}
