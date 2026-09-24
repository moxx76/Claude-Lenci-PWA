import { useState, useEffect } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { avatarBg, calculateAge, formatDate } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { PlayerEditSheet } from './PlayerEditSheet'
import { PlayerAssessmentSheet } from './PlayerAssessmentSheet'

export interface PlayerDetailData {
  id: string
  firstName: string
  lastName: string
  birthDate: string | null
  position: string | null
  category: string | null
  previousClub: string | null
  parentName: string | null
  parentPhone: string | null
  parentEmail: string | null
  fiscalCode?: string | null
  jerseyNumber?: number | null
  cardNumber?: string | null
  medicalExpiry?: string | null
  teamId?: string | null
  avatarUrl?: string | null
  dominantFoot?: string | null
  secondaryPositions?: string[] | null
  heightCm?: number | null
  weightKg?: number | null
  shoeSize?: number | null
  sex?: 'M' | 'F' | null
  source?: 'player' | 'lead'
}

interface PlayerDetailSheetProps {
  open: boolean
  onClose: () => void
  player: PlayerDetailData | null
  canEdit?: boolean
  onUpdated?: () => void
}

type NoteType = 'note' | 'yellow' | 'red' | 'achievement'

interface DisciplinaryEntry {
  id: string
  kind: NoteType
  content: string
  occurred_on: string
  author_name?: string
  created_at: string
}

/**
 * Statistica del giocatore per una singola partita. Racchiude tutti i dati numerici
 * che alimentano il riepilogo aggregato nella scheda personale (presenze, gol, assist,
 * minuti giocati). Un giocatore compare qui se ha almeno una stats row per la partita
 * (ergo è stato convocato e ha ricevuto gestione minuti, o ha segnato/assistito).
 */
interface PlayerMatchStatEntry {
  match_id: string
  match_date: string
  opponent: string
  venue: 'home' | 'away' | null
  home_score: number | null
  away_score: number | null
  was_starter: boolean
  minute_in: number | null    // 0 = titolare, N = subentrato al min N, null = non giocato
  minute_out: number | null   // N = uscito al min N, null = fino alla fine (o non giocato)
  goals: number
  penalties_scored: number
  assists: number
  minutes_played: number      // calcolato: quanti minuti effettivi ha giocato in questa partita
  team_total_minutes: number  // durata totale della partita (per calcolare "%" contributo)
}

const NOTE_TYPE_STYLE: Record<NoteType, { bg: string; color: string; label: string; icon: string }> = {
  note:        { bg: '#cfe5ff', color: '#004a78', label: 'Nota',        icon: 'edit_note' },
  yellow:      { bg: 'rgba(255,209,0,0.30)', color: '#8e6300', label: 'Ammonizione', icon: 'square' },
  red:         { bg: '#ffdad6', color: '#93000a', label: 'Espulsione', icon: 'square' },
  achievement: { bg: 'rgba(128,249,139,0.35)', color: '#006e25', label: 'Merito',    icon: 'emoji_events' },
}

export function PlayerDetailSheet({ open, onClose, player, canEdit = false, onUpdated }: PlayerDetailSheetProps) {
  const { profile } = useAuth()
  const [addingNote, setAddingNote] = useState(false)
  const [noteType, setNoteType] = useState<NoteType>('note')
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<DisciplinaryEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [goals, setGoals] = useState<PlayerMatchStatEntry[]>([])  // ora tiene TUTTE le stats per partita, non solo gol
  const [loadingGoals, setLoadingGoals] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [assessOpen, setAssessOpen] = useState(false)

  useEffect(() => {
    if (!open || !player || player.source === 'lead') {
      setHistory([])
      setGoals([])
      return
    }
    loadHistory()
    loadGoals()
  }, [open, player?.id])

  // Refresh LIVE quando cambia exclude_from_stats su una partita: se lo sheet
  // è aperto per un giocatore, i suoi dati devono aggiornarsi senza chiudere/
  // riaprire. Non filtro per teamId qui perché il giocatore potrebbe essere
  // in prestito e comparire in match di team diversi: meglio ricaricare sempre
  // se lo sheet è aperto.
  useEffect(() => {
    if (!open || !player?.id) return
    const handler = () => { loadGoals() }
    window.addEventListener('lenci:match-exclude-changed', handler)
    return () => window.removeEventListener('lenci:match-exclude-changed', handler)
  }, [open, player?.id])

  const loadHistory = async () => {
    if (!player) return
    setLoadingHistory(true)
    const { data } = await supabase
      .from('disciplinary_records')
      .select('id, kind, content, occurred_on, created_at, author:profiles!disciplinary_records_author_id_fkey(full_name)')
      .eq('player_id', player.id)
      .order('occurred_on', { ascending: false })
      .limit(30)
    setHistory((data ?? []).map((r: any) => ({
      id: r.id,
      kind: r.kind,
      content: r.content,
      occurred_on: r.occurred_on,
      created_at: r.created_at,
      author_name: r.author?.full_name || 'Staff',
    })))
    setLoadingHistory(false)
  }

  /**
   * Carica tutte le statistiche del giocatore per singola partita (era loadGoals ma
   * ora è generalizzata: presenze + gol + assist + minuti giocati).
   * Join matches → teams per prendere la durata partita (per il calcolo minuti effettivi
   * quando il giocatore è arrivato "fino alla fine" — minute_out=null).
   * Escludo le partite marcate exclude_from_stats=true (referto non compilato): sarebbero
   * dati fuorvianti nella scheda giocatore, meglio non mostrarle affatto.
   */
  const loadGoals = async () => {
    if (!player) return
    setLoadingGoals(true)
    const { data } = await supabase
      .from('match_player_stats')
      .select('goals, penalties_scored, assists, was_starter, minute_in, minute_out, match:matches!inner(id, match_date, opponent, venue, home_score, away_score, exclude_from_stats, team:teams(match_periods_count, match_period_duration_min))')
      .eq('player_id', player.id)
      .eq('match.exclude_from_stats', false)
    const rows: PlayerMatchStatEntry[] = (data ?? [])
      .map((r: any) => {
        const m = Array.isArray(r.match) ? r.match[0] : r.match
        if (!m) return null
        const teamObj = Array.isArray(m.team) ? m.team[0] : m.team
        // Durata totale partita per calcolare minuti "fino alla fine" (minute_out=null).
        // Fallback 90 min se il team non ha i campi settati.
        const teamTotalMin = teamObj
          ? (teamObj.match_periods_count ?? 2) * (teamObj.match_period_duration_min ?? 45)
          : 90
        const goals = Number(r.goals || 0)
        const pens = Number(r.penalties_scored || 0)
        const assists = Number(r.assists || 0)
        const wasStarter = !!r.was_starter
        const mIn = r.minute_in
        const mOut = r.minute_out

        // Calcolo minuti giocati:
        //  - Non ha giocato: was_starter=false E minute_in=null → 0
        //  - Titolare che finisce la partita: minute_in=0, minute_out=null → totale
        //  - Titolare sostituito al min X: minute_out=X → X - 0 = X
        //  - Subentrato al min Y, fino alla fine: totale - Y
        //  - Subentrato al min Y, sostituito al min Z: Z - Y
        let minutesPlayed = 0
        if (wasStarter || mIn != null) {
          const startMin = wasStarter ? 0 : (mIn ?? 0)
          const endMin = mOut ?? teamTotalMin
          minutesPlayed = Math.max(0, endMin - startMin)
        }

        // Skippo righe totalmente vuote (non giocato + no gol/assist): non è una vera presenza
        if (!wasStarter && mIn == null && goals === 0 && pens === 0 && assists === 0) return null

        return {
          match_id: m.id,
          match_date: m.match_date,
          opponent: m.opponent,
          venue: m.venue,
          home_score: m.home_score,
          away_score: m.away_score,
          was_starter: wasStarter,
          minute_in: mIn,
          minute_out: mOut,
          goals,
          penalties_scored: pens,
          assists,
          minutes_played: minutesPlayed,
          team_total_minutes: teamTotalMin,
        } as PlayerMatchStatEntry
      })
      .filter((x: any): x is PlayerMatchStatEntry => x !== null)
      .sort((a, b) => (a.match_date > b.match_date ? -1 : 1))
    setGoals(rows)
    setLoadingGoals(false)
  }

  if (!player) return null

  const initials = `${player.firstName[0] || ''}${player.lastName[0] || ''}`.toUpperCase() || '??'
  const age = calculateAge(player.birthDate)
  const isLead = player.source === 'lead'

  const medicalDaysLeft = player.medicalExpiry
    ? Math.floor((new Date(player.medicalExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  const handleAddNote = async () => {
    if (!noteText.trim() || !player || isLead) return
    setSaving(true)
    try {
      const { error } = await supabase.from('disciplinary_records').insert({
        player_id: player.id,
        kind: noteType,
        content: noteText.trim(),
        occurred_on: new Date().toISOString().slice(0, 10),
        author_id: profile?.id ?? null,
      })
      if (error) throw error
      setAddingNote(false)
      setNoteText('')
      setNoteType('note')
      await loadHistory()
    } catch (e: any) {
      alert('Errore salvataggio: ' + (e.message || 'sconosciuto'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ padding: '4px 20px 24px' }}>
        {/* Hero */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 18, alignItems: 'center' }}>
          <div
            style={{
              width: 64, height: 64, borderRadius: '50%',
              background: player.avatarUrl ? '#fff' : avatarBg(initials),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontFamily: 'Anybody', fontWeight: 800, fontSize: 22,
              flexShrink: 0, boxShadow: '0 6px 14px rgba(0,120,191,0.15)', overflow: 'hidden',
            }}
          >
            {player.avatarUrl
              ? <img src={player.avatarUrl} alt={initials}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 20, color: '#181c20', margin: 0, lineHeight: 1.2 }}>
              {player.firstName} {player.lastName}
            </h2>
            <p style={{ fontSize: 12.5, color: '#404751', margin: '4px 0 0' }}>
              {player.position || 'Ruolo non specificato'}
              {age !== null && ` • ${age} anni`}
            </p>
            {player.category && (
              <p style={{ fontSize: 11.5, color: '#707882', margin: '2px 0 0' }}>
                {player.category}
              </p>
            )}
          </div>
          {!isLead && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              {canEdit && (
                <button
                  onClick={() => setEditOpen(true)}
                  style={{
                    background: '#f1f3fa', color: '#005f98', border: 'none',
                    borderRadius: 999, padding: '8px 12px',
                    fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Icon name="edit" size={14} color="#005f98" />
                  Modifica
                </button>
              )}
              <button
                onClick={() => setAssessOpen(true)}
                style={{
                  background: 'linear-gradient(135deg, #005f98, #003c5e)',
                  color: '#fff', border: 'none',
                  borderRadius: 999, padding: '8px 12px',
                  fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <Icon name="analytics" size={14} color="#fff" />
                Scheda tecnica
              </button>
            </div>
          )}
        </div>

        {/* Alert certificato medico */}
        {medicalDaysLeft !== null && medicalDaysLeft < 30 && (
          <div
            style={{
              background: medicalDaysLeft < 0 ? '#ffdad6' : 'rgba(255,209,0,0.25)',
              color: medicalDaysLeft < 0 ? '#93000a' : '#8e6300',
              borderRadius: 10,
              padding: '10px 12px',
              marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 12, fontWeight: 700,
            }}
          >
            <Icon name={medicalDaysLeft < 0 ? 'error' : 'warning'} size={16} color={medicalDaysLeft < 0 ? '#93000a' : '#8e6300'} />
            {medicalDaysLeft < 0
              ? `Certificato medico SCADUTO il ${formatDate(player.medicalExpiry)}`
              : `Certificato medico scade tra ${medicalDaysLeft} giorni (${formatDate(player.medicalExpiry)})`}
          </div>
        )}

        {/* Info tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
          <InfoTile label="Data di nascita" value={player.birthDate ? formatDate(player.birthDate) : '—'} />
          <InfoTile label="Maglia" value={player.jerseyNumber != null ? `#${player.jerseyNumber}` : '—'} />
          <InfoTile label="Matricola FIGC" value={player.cardNumber || '—'} />
          <InfoTile label="Cert. medico" value={player.medicalExpiry ? formatDate(player.medicalExpiry) : '—'} />
          <InfoTile label="Codice fiscale" value={player.fiscalCode || '—'} />
          {player.previousClub && (
            <InfoTile label="Squadra precedente" value={player.previousClub} />
          )}
          {player.parentName && (
            <InfoTile label="Genitore" value={player.parentName} />
          )}
          {player.parentPhone && (
            <InfoTile label="Telefono" value={player.parentPhone} action={`tel:${player.parentPhone}`} icon="phone" />
          )}
          {player.parentEmail && (
            <InfoTile label="Email" value={player.parentEmail} action={`mailto:${player.parentEmail}`} icon="mail" />
          )}
        </div>

        {/* Statistiche stagione — presenze, gol, assist e minuti giocati per singola partita.
            Aggregati dal referto partita (tabella match_player_stats). Un giocatore compare
            qui se ha almeno una statistica valorizzata (era stato convocato + gestione minuti,
            oppure ha segnato/assistito). */}
        {!isLead && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Icon name="sports_soccer" size={18} color="#005f98" />
              <h3 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 14, color: '#181c20', margin: 0 }}>
                Statistiche stagione
              </h3>
            </div>
            {loadingGoals ? (
              <div style={{ padding: 14, background: '#f7f9ff', borderRadius: 12, fontSize: 12, color: '#404751', textAlign: 'center' }}>
                Caricamento…
              </div>
            ) : goals.length === 0 ? (
              <div style={{ padding: 14, background: '#f7f9ff', borderRadius: 12, fontSize: 12, color: '#7a8290', textAlign: 'center' }}>
                Nessuna partita registrata a referto. Le statistiche appariranno qui appena
                un referto post-partita verrà salvato con questo giocatore convocato.
              </div>
            ) : (() => {
              // Aggregati stagione
              const totGoals = goals.reduce((s, g) => s + g.goals, 0)
              const totPens = goals.reduce((s, g) => s + g.penalties_scored, 0)
              const totalNet = totGoals + totPens
              const totAssists = goals.reduce((s, g) => s + g.assists, 0)
              const totMinutes = goals.reduce((s, g) => s + g.minutes_played, 0)
              const totTitolare = goals.filter(g => g.was_starter).length
              const totSubentri = goals.filter(g => !g.was_starter && g.minute_in != null).length
              const totPresenze = totTitolare + totSubentri
              return (
                <div>
                  {/* Griglia riepilogo 4 KPI: Presenze / Gol / Assist / Minuti */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
                    marginBottom: 10,
                  }}>
                    <StatKpi label="Presenze" value={String(totPresenze)} sub={`${totTitolare} tit · ${totSubentri} sub`} color="#005f98" />
                    <StatKpi label="Gol" value={String(totalNet)} sub={totPens > 0 ? `${totGoals}+${totPens}rig` : totalNet === 0 ? '—' : 'su azione'} color="#b3005c" />
                    <StatKpi label="Assist" value={String(totAssists)} sub={totAssists === 0 ? '—' : `in ${goals.filter(g => g.assists > 0).length} partite`} color="#7a0071" />
                    <StatKpi label="Minuti" value={String(totMinutes)} sub={totPresenze > 0 ? `~${Math.round(totMinutes/totPresenze)}′/pres` : '—'} color="#006e25" />
                  </div>

                  {/* Lista dettagliata per singola partita */}
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#7a8290', textTransform: 'uppercase', letterSpacing: 0.3, margin: '8px 0 6px', paddingLeft: 4 }}>
                    Partita per partita
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {goals.map(g => {
                      const dateStr = formatDate(g.match_date)
                      const scoreStr = (g.home_score != null && g.away_score != null)
                        ? (g.venue === 'home'
                            ? `${g.home_score}-${g.away_score}`
                            : g.venue === 'away'
                              ? `${g.away_score}-${g.home_score}`
                              : `${g.home_score}-${g.away_score}`)
                        : null
                      const netGoals = g.goals + g.penalties_scored
                      // Tag ruolo nella partita: TIT (titolare) / SUB (subentrato)
                      const roleTag = g.was_starter ? 'TIT' : (g.minute_in != null ? 'SUB' : '—')
                      const roleColor = g.was_starter ? '#005f98' : (g.minute_in != null ? '#7a4b00' : '#8993a3')
                      return (
                        <div key={g.match_id} style={{
                          background: '#f7f9ff', border: '1px solid #dfe6ef',
                          borderRadius: 10, padding: '8px 10px',
                          display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center',
                        }}>
                          {/* Ruolo nella partita */}
                          <div style={{
                            padding: '3px 7px', borderRadius: 5,
                            background: roleColor, color: '#fff',
                            fontSize: 9.5, fontWeight: 800, letterSpacing: 0.3,
                            minWidth: 30, textAlign: 'center',
                          }}>
                            {roleTag}
                          </div>
                          {/* Info partita */}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#181c20', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {g.venue === 'home' ? 'vs ' : g.venue === 'away' ? '@ ' : ''}{g.opponent}
                              {scoreStr && <span style={{ marginLeft: 6, color: '#5c6773', fontWeight: 600 }}>({scoreStr})</span>}
                            </div>
                            <div style={{ fontSize: 10.5, color: '#7a8290', marginTop: 1, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <span>{dateStr}</span>
                              {/* Range minuti effettivo se subentrato o sostituito */}
                              {(g.minute_in != null && g.minute_in > 0) || g.minute_out != null ? (
                                <span style={{ color: '#404751' }}>
                                  {g.minute_in ?? 0}′-{g.minute_out ?? g.team_total_minutes}′
                                </span>
                              ) : null}
                            </div>
                          </div>
                          {/* Stats compatte a destra: min | gol | assist */}
                          <div style={{ display: 'flex', gap: 5, alignItems: 'stretch' }}>
                            <StatCell value={String(g.minutes_played)} suffix="′" color="#006e25" title="Minuti giocati" />
                            {netGoals > 0 && (
                              <StatCell
                                value={String(netGoals)}
                                suffix={g.penalties_scored > 0 ? `⚽${g.penalties_scored > 0 ? '*' : ''}` : '⚽'}
                                color="#b3005c"
                                title={g.penalties_scored > 0 ? `${g.goals} su azione + ${g.penalties_scored} rig.` : 'Gol'}
                              />
                            )}
                            {g.assists > 0 && (
                              <StatCell value={String(g.assists)} suffix="🅰" color="#7a0071" title="Assist" />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Storico disciplinare - solo per giocatori (non lead) */}
        {!isLead ? (
          <>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 14, color: '#181c20', margin: 0 }}>
                Storico disciplinare & note
              </h3>
              {canEdit && !addingNote && (
                <button
                  onClick={() => setAddingNote(true)}
                  style={{
                    background: '#005f98', color: '#fff', border: 'none',
                    borderRadius: 999, padding: '6px 12px',
                    fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Icon name="add" size={14} color="#fff" />
                  Aggiungi
                </button>
              )}
            </div>

            {addingNote && (
              <div style={{
                background: '#f7f9ff', borderRadius: 14, padding: 14,
                marginBottom: 12, border: '1px solid #cfe5ff',
              }}>
                <p style={{ fontSize: 11.5, color: '#404751', fontWeight: 700, margin: '0 0 8px' }}>
                  Tipo
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                  {(['note', 'achievement', 'yellow', 'red'] as NoteType[]).map(t => {
                    const s = NOTE_TYPE_STYLE[t]
                    const active = noteType === t
                    return (
                      <button
                        key={t}
                        onClick={() => setNoteType(t)}
                        style={{
                          padding: '8px', borderRadius: 10,
                          border: active ? `2px solid ${s.color}` : '2px solid transparent',
                          background: s.bg, color: s.color,
                          fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        }}
                      >
                        <Icon name={s.icon} size={13} color={s.color} />
                        {s.label}
                      </button>
                    )
                  })}
                </div>

                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Descrivi l'annotazione..."
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    border: '1px solid #c0c7d2', fontSize: 13,
                    fontFamily: 'inherit', resize: 'vertical', marginBottom: 10,
                    boxSizing: 'border-box',
                  }}
                />

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => { setAddingNote(false); setNoteText('') }}
                    disabled={saving}
                    style={{
                      padding: '8px 14px', borderRadius: 999, border: '1px solid #c0c7d2',
                      background: '#fff', fontSize: 12, fontWeight: 700, color: '#404751',
                      cursor: 'pointer',
                    }}
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleAddNote}
                    disabled={!noteText.trim() || saving}
                    style={{
                      padding: '8px 14px', borderRadius: 999, border: 'none',
                      background: '#005f98', fontSize: 12, fontWeight: 700, color: '#fff',
                      cursor: noteText.trim() ? 'pointer' : 'not-allowed',
                      opacity: (noteText.trim() && !saving) ? 1 : 0.5,
                    }}
                  >
                    {saving ? 'Salvo…' : 'Salva'}
                  </button>
                </div>
              </div>
            )}

            {loadingHistory ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#707882', fontSize: 12 }}>
                Caricamento…
              </div>
            ) : history.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#707882', fontSize: 12 }}>
                Nessuna annotazione presente
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {history.map(h => {
                  const s = NOTE_TYPE_STYLE[h.kind]
                  return (
                    <div key={h.id} style={{
                      padding: 12, borderRadius: 12, background: '#fff',
                      border: '1px solid #e6e8ee', display: 'flex', gap: 10,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: s.bg, color: s.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Icon name={s.icon} size={16} color={s.color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: s.color }}>{s.label}</span>
                          <span style={{ fontSize: 10.5, color: '#707882' }}>{formatDate(h.occurred_on)}</span>
                        </div>
                        <p style={{ fontSize: 12.5, color: '#181c20', margin: '2px 0', lineHeight: 1.4 }}>
                          {h.content}
                        </p>
                        <p style={{ fontSize: 10.5, color: '#707882', margin: '2px 0 0', fontStyle: 'italic' }}>
                          — {h.author_name}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <div style={{
            padding: 14, background: '#f7f9ff', borderRadius: 12,
            color: '#404751', fontSize: 12, textAlign: 'center',
          }}>
            ℹ️ Storico disciplinare disponibile solo per tesserati (categoria: {player.category || 'lead'})
          </div>
        )}
      </div>
    </BottomSheet>

    {/* Editor giocatore, si apre sopra */}
    <PlayerEditSheet
      open={editOpen}
      onClose={() => setEditOpen(false)}
      player={player}
      onSaved={() => {
        setEditOpen(false)
        onUpdated?.()
      }}
    />

    {/* Scheda tecnica giocatore */}
    <PlayerAssessmentSheet
      open={assessOpen}
      onClose={() => setAssessOpen(false)}
      player={player ? {
        id: player.id,
        first_name: player.firstName,
        last_name: player.lastName,
        birth_date: player.birthDate || '',
        position: player.position,
        dominant_foot: player.dominantFoot,
        secondary_positions: player.secondaryPositions,
        height_cm: player.heightCm,
        weight_kg: player.weightKg,
        shoe_size: player.shoeSize,
        sex: player.sex,
        team_id: player.teamId || '',
        team: player.category ? { name: player.category, age_range: null, category: player.category } : null,
      } : null}
      canEdit={canEdit}
      onSaved={() => onUpdated?.()}
    />
    </>
  )
}

function InfoTile({ label, value, action, icon }: { label: string; value: string; action?: string; icon?: string }) {
  const content = (
    <>
      <p style={{ fontSize: 10, color: '#707882', textTransform: 'uppercase', letterSpacing: '0.03em', margin: 0, fontWeight: 700 }}>
        {label}
      </p>
      <p style={{ fontSize: 12.5, color: '#181c20', margin: '3px 0 0', fontWeight: 600, wordBreak: 'break-word', display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon && action && <Icon name={icon} size={12} color="#005f98" />}
        {value}
      </p>
    </>
  )
  const style: React.CSSProperties = {
    padding: 10, borderRadius: 10, background: '#f7f9ff',
    minWidth: 0, textDecoration: 'none', color: 'inherit', display: 'block',
  }
  if (action) {
    return <a href={action} style={style}>{content}</a>
  }
  return <div style={style}>{content}</div>
}

/**
 * KPI compatto usato nella griglia riepilogo stats stagione.
 * Grande valore centrale (font Anybody), label sotto e sub-label per dettaglio.
 * Sfondo pastello con la variante del colore passato come prop.
 */
function StatKpi({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{
      background: `${color}14`,  // hex + alpha 8% per pastello leggero
      border: `1px solid ${color}30`,
      borderRadius: 10, padding: '8px 6px 6px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      minWidth: 0,
    }}>
      <div style={{ fontFamily: 'Anybody', fontWeight: 900, fontSize: 22, color, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 9.5, fontWeight: 800, color: '#404751', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </div>
      <div style={{ fontSize: 9, color: '#7a8290', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
        {sub}
      </div>
    </div>
  )
}

/**
 * Cella statistica compatta usata nella riga per singola partita (a destra dopo il nome).
 * Valore + suffisso (es. "72′" oppure "2⚽"). Colorata per dominio.
 */
function StatCell({ value, suffix, color, title }: { value: string; suffix: string; color: string; title?: string }) {
  return (
    <div title={title} style={{
      background: `${color}14`,
      border: `1px solid ${color}30`,
      borderRadius: 6, padding: '3px 6px',
      display: 'flex', alignItems: 'center', gap: 2,
      fontSize: 11, fontWeight: 800, color,
      whiteSpace: 'nowrap',
    }}>
      <span>{value}</span>
      <span style={{ fontSize: 10, opacity: 0.85 }}>{suffix}</span>
    </div>
  )
}
