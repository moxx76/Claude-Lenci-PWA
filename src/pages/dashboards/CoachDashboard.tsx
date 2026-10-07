import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/auth'
import { todayIT, dateIT } from '../../lib/dateIT'
import { avatarBg } from '../../lib/types'
import { Icon } from '../../components/Icon'
import { type PlayerDetailData } from '../../components/PlayerDetailSheet'
import { BottomSheet } from '../../components/BottomSheet'
import { ShuttleServiceCard } from '../../components/ShuttleServiceCard'
import { CoachPlayerStatsDashboard } from '../../components/CoachPlayerStatsDashboard'
import { useCalendarEvents } from '../../hooks/useCalendarEvents'
import { extractCity, isTournamentCompetition, HOME_CITY } from '../../lib/eventLocation'
import { useMyTeam } from '../../hooks/useMyTeam'

// M13 — Sheet aperti su click: lazy. Il coach apre PlayerDetail per vedere
// un giocatore, Attendance per prendere le presenze, EventEdit per
// creare evento. Nessuno è un render iniziale, quindi caricamento al click.
const PlayerDetailSheet = lazy(() => import('../../components/PlayerDetailSheet').then(m => ({ default: m.PlayerDetailSheet })))
const AttendanceSheet = lazy(() => import('../../components/AttendanceSheet').then(m => ({ default: m.AttendanceSheet })))
const EventEditSheet = lazy(() => import('../../components/EventEditSheet').then(m => ({ default: m.EventEditSheet })))


function CoachDashboard({ firstName }: { firstName: string }) {
  const { myTeam } = useMyTeam()
  const [rosterCount, setRosterCount] = useState<number>(0)
  const [rosterSample, setRosterSample] = useState<any[]>([])
  const [rosterFull, setRosterFull] = useState<any[]>([])
  const [certExpiring, setCertExpiring] = useState<any[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerDetailData | null>(null)
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [attendanceEvent, setAttendanceEvent] = useState<{ id: string; title: string; date: string; time: string } | null>(null)
  const [eventEditOpen, setEventEditOpen] = useState(false)
  const [pickEventOpen, setPickEventOpen] = useState(false)

  // Prossimo evento della SUA squadra
  const { nextEvent, events, refresh: refreshEvents } = useCalendarEvents({
    teamId: myTeam?.id ?? null,
    limit: 30,
  })

  useEffect(() => { if (myTeam?.id) load(myTeam.id) }, [myTeam?.id])
  const load = async (teamId: string) => {
    const today = todayIT()
    const in30d = dateIT(new Date(Date.now() + 30 * 86400000))
    const [rosterRes, certRes] = await Promise.all([
      supabase
        .from('players')
        .select('id,first_name,last_name,position,birth_date,notes,fiscal_code,jersey_number,card_number,medical_expiry', { count: 'exact' })
        .eq('team_id', teamId)
        .order('last_name'),
      supabase
        .from('players')
        .select('id,first_name,last_name,medical_expiry')
        .eq('team_id', teamId)
        .not('medical_expiry', 'is', null)
        .lte('medical_expiry', in30d)
        .order('medical_expiry'),
    ])
    setRosterCount(rosterRes.count ?? 0)
    setRosterFull(rosterRes.data ?? [])
    setRosterSample((rosterRes.data ?? []).slice(0, 3))
    setCertExpiring(certRes.data ?? [])
  }

  const isToday = nextEvent && nextEvent.date === todayIT()
  const eventDateLabel = nextEvent
    ? (isToday ? `Oggi, ${nextEvent.startTime}` : `${new Date(nextEvent.date + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}, ${nextEvent.startTime}`)
    : ''

  // Attendance session
  const openAttendanceForNext = () => {
    if (!nextEvent) { setPickEventOpen(true); return }
    if (nextEvent.kind !== 'training') {
      setPickEventOpen(true)
      return
    }
    // training id = event.id minus prefix
    const trainingId = nextEvent.raw?.id
    setAttendanceEvent({
      id: trainingId,
      title: nextEvent.title,
      date: nextEvent.date,
      time: nextEvent.startTime,
    })
    setAttendanceOpen(true)
  }

  const trainingEvents = events.filter(e => e.kind === 'training')

  // Coach senza squadra assegnata
  if (!myTeam) {
    return (
      <>
        <div>
          <h2 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 26, color: '#181c20', margin: 0 }}>
            Ciao Mister {firstName}
          </h2>
        </div>

        {/* Card evidenza attesa */}
        <div style={{
          background: 'linear-gradient(135deg, #fff4e6, #ffe4c0)',
          border: '1px solid #ffcda3',
          borderRadius: 18,
          padding: 22,
          boxShadow: '0 6px 20px rgba(180,90,10,0.08)',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 999,
            background: '#c47f00', color: '#fff',
            fontSize: 10.5, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase',
            marginBottom: 12,
          }}>
            <Icon name="hourglass_top" size={13} color="#fff" />
            In attesa di assegnazione
          </div>
          <h3 style={{
            fontSize: 18, fontWeight: 800, color: '#5c3800',
            margin: '0 0 8px', lineHeight: 1.3,
          }}>
            Il tuo profilo è attivo ma non hai ancora una squadra
          </h3>
          <p style={{ fontSize: 13, color: '#7c4700', margin: 0, lineHeight: 1.5 }}>
            Un amministratore della società deve assegnarti la squadra che allenerai in questa stagione. Solo dopo l'assegnazione potrai accedere a calendario, roster, convocazioni e report presenze.
          </p>
        </div>

        {/* Cosa fare */}
        <div style={{
          background: '#fff', borderRadius: 14, padding: 16,
          boxShadow: '0 6px 20px rgba(0,120,191,0.05)',
          border: '1px solid #e6e8ee',
        }}>
          <div style={{
            fontSize: 10.5, fontWeight: 800, color: '#005f98',
            textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="info" size={13} color="#005f98" />
            Cosa fare adesso
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#404751', lineHeight: 1.7 }}>
            <li>Contatta un amministratore della società (Luca Palermo o Andrea Caratto) e chiedi l'assegnazione della tua squadra</li>
            <li>Nel frattempo puoi completare il tuo profilo dalla sezione <b>Profilo</b> in alto a destra</li>
            <li>Al prossimo accesso, quando la squadra sarà assegnata, vedrai qui tutte le informazioni della tua rosa</li>
          </ul>
        </div>

        {/* Servizio navetta — appare solo per autisti designati */}
        <ShuttleServiceCard />
      </>
    )
  }

  return (
    <>
      <div>
        <h2 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 26, color: '#181c20', margin: 0 }}>
          {myTeam.name}
        </h2>
        <p style={{ fontSize: 13, color: '#404751', margin: '6px 0 0' }}>
          Bentornato, Mister {firstName || 'Rossi'}.
        </p>
      </div>

      {/* Servizio navetta — appare solo per autisti designati */}
      <ShuttleServiceCard />

      {/* CTA Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
        <button
          onClick={openAttendanceForNext}
          style={{
            background: myTeam.color || '#005f98', color: '#fff', border: 'none', borderRadius: 999,
            padding: '13px 16px', fontSize: 12, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.03em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,95,152,0.25)',
          }}
        >
          <Icon name="fact_check" size={17} />
          Segna Presenze
        </button>
        <button
          onClick={() => setEventEditOpen(true)}
          style={{
            background: '#fff', color: '#005f98', border: '2px solid #005f98', borderRadius: 999,
            padding: '11px 12px', fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            cursor: 'pointer',
          }}
        >
          <Icon name="add" size={16} color="#005f98" />
          Evento
        </button>
      </div>

      {/* Alert certificati */}
      {certExpiring.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: 14, padding: 14,
          borderLeft: `4px solid ${certExpiring.some(c => new Date(c.medical_expiry) < new Date()) ? '#ba1a1a' : '#8e6300'}`,
          boxShadow: '0 6px 16px rgba(0,120,191,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Icon name="medical_services" size={20} color="#8e6300" />
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#181c20' }}>
                {certExpiring.length} certificat{certExpiring.length === 1 ? 'o' : 'i'} in scadenza
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#707882' }}>
                Ricorda ai genitori di rinnovarli
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {certExpiring.slice(0, 3).map(c => {
              const days = Math.floor((new Date(c.medical_expiry).getTime() - Date.now()) / 86400000)
              return (
                <div key={c.id} style={{
                  fontSize: 11.5, display: 'flex', justifyContent: 'space-between',
                  padding: '4px 8px', background: '#f7f9ff', borderRadius: 6,
                }}>
                  <span style={{ color: '#181c20', fontWeight: 600 }}>{c.first_name} {c.last_name}</span>
                  <span style={{ color: days < 0 ? '#93000a' : '#8e6300', fontWeight: 700 }}>
                    {days < 0 ? `SCADUTO` : `${days}gg`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Prossimo evento */}
      {nextEvent ? (
        <div style={{ background: '#fff', borderRadius: 18, padding: 18, boxShadow: '0 10px 24px rgba(0,120,191,0.06)', overflow: 'hidden' }}>
          <div className="flex items-center flex-wrap" style={{ gap: 8, marginBottom: 10 }}>
            <span
              style={{
                background: nextEvent.kind === 'training' ? '#80f98b' : '#ffdad6',
                color: nextEvent.kind === 'training' ? '#007327' : '#93000a',
                fontSize: 10, fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.04em',
                padding: '4px 10px', borderRadius: 999,
              }}
            >
              Prossimo {nextEvent.kind === 'training' ? 'Allenamento' : (nextEvent.kind === 'tournament' ? 'Torneo' : 'Impegno')}
            </span>
            <span style={{ fontSize: 12, color: '#404751' }}>{eventDateLabel}</span>
          </div>
          <h3 style={{ fontFamily: 'Anybody', fontWeight: 700, fontSize: 18, color: '#181c20', margin: '0 0 8px' }}>
            {nextEvent.title}
          </h3>
          {(() => {
            // v1.9.104: riga location esplicita con città.
            const isMatchLike = nextEvent.kind === 'match' || nextEvent.kind === 'tournament'
            const isTournamentLike = nextEvent.kind === 'tournament'
              || isTournamentCompetition(nextEvent.competition)
            let cityPrefix: string | null = null
            if (isMatchLike) {
              if (nextEvent.venue === 'home') cityPrefix = HOME_CITY
              else if (nextEvent.venue === 'away') cityPrefix = extractCity(nextEvent.address, nextEvent.location)
              if (cityPrefix && isTournamentLike && nextEvent.competition) {
                cityPrefix = `${cityPrefix} – ${nextEvent.competition.trim()}`
              }
            }
            if (!nextEvent.location && !cityPrefix) return null
            const label = cityPrefix && nextEvent.location
              ? `${cityPrefix} · ${nextEvent.location}`
              : (cityPrefix || nextEvent.location)
            return (
              <p style={{ fontSize: 12.5, color: '#404751', margin: '0 0 14px', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icon name="location_on" size={14} />
                {label}
              </p>
            )
          })()}
          <div
            style={{
              width: '100%', height: 110, borderRadius: 12,
              background: nextEvent.kind === 'training'
                ? `linear-gradient(135deg,#28A745,${myTeam.color || '#005f98'})`
                : `linear-gradient(135deg,#b3005c,${myTeam.color || '#005f98'})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <Icon
              name={nextEvent.kind === 'training' ? 'fitness_center' : 'sports_soccer'}
              size={40}
              color="rgba(255,255,255,0.85)"
            />
          </div>
          <Link
            to="/calendario"
            style={{
              border: '1px solid #005f98', color: '#005f98', background: 'transparent',
              borderRadius: 999, padding: '9px 16px', fontSize: 12, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            <Icon name="calendar_month" size={15} />
            Vedi tutto il calendario
          </Link>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 18, padding: 24, boxShadow: '0 10px 24px rgba(0,120,191,0.06)', textAlign: 'center' }}>
          <Icon name="event_available" size={36} color="#c0c7d2" />
          <p style={{ fontSize: 13, color: '#707882', marginTop: 8 }}>
            Nessun evento in programma
          </p>
          <button
            onClick={() => setEventEditOpen(true)}
            style={{
              marginTop: 8, background: '#005f98', color: '#fff', border: 'none',
              borderRadius: 999, padding: '8px 16px', fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Crea il primo evento
          </button>
        </div>
      )}

      {/* Statistiche giocatori — vista mister aggregata (presenze, minuti, gol, assist, cartellini) */}
      <CoachPlayerStatsDashboard teamId={myTeam.id} categoryName={myTeam.name} />

      {/* Rosa Attuale */}
      <div style={{ background: '#fff', borderRadius: 18, padding: 18, boxShadow: '0 10px 24px rgba(0,120,191,0.06)' }}>
        <div className="flex justify-between items-center flex-wrap" style={{ marginBottom: 12, gap: 8 }}>
          <h3 style={{ fontFamily: 'Anybody', fontWeight: 700, fontSize: 16, color: '#181c20', margin: 0 }}>
            Rosa {myTeam.name}
          </h3>
          <div className="flex" style={{ gap: 6 }}>
            <span style={{ fontSize: 10.5, background: '#e6e8ee', padding: '4px 8px', borderRadius: 999, color: '#181c20' }}>
              ● {rosterCount} Tesserati
            </span>
          </div>
        </div>
        <div className="flex flex-col" style={{ gap: 8 }}>
          {rosterSample.map(p => (
            <div
              key={p.id}
              onClick={() => setSelectedPlayer({
                id: p.id,
                firstName: p.first_name || '',
                lastName: p.last_name || '',
                birthDate: p.birth_date,
                position: p.position,
                category: myTeam.category,
                previousClub: null,
                parentName: null,
                parentPhone: null,
                parentEmail: null,
                fiscalCode: p.fiscal_code,
                jerseyNumber: p.jersey_number,
                cardNumber: p.card_number,
                medicalExpiry: p.medical_expiry,
                source: 'player',
              })}
              className="flex items-center"
              style={{
                gap: 12, border: '1px solid #e0e2e9', borderRadius: 12,
                padding: '10px 12px', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#0078bf'; e.currentTarget.style.background = '#f7f9ff' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e2e9'; e.currentTarget.style.background = 'transparent' }}
            >
              <div
                style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: avatarBg(p.id),
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 13, flexShrink: 0,
                }}
              >
                {(p.first_name?.[0] ?? '') + (p.last_name?.[0] ?? '')}
              </div>
              <div className="flex-1 min-w-0">
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#181c20', margin: 0 }}>
                  {p.first_name} {p.last_name}
                </h4>
                <p style={{ fontSize: 11.5, color: '#006e25', margin: '1px 0 0' }}>
                  Disponibile{p.position ? ` • ${p.position}` : ''}
                </p>
              </div>
              <Icon name="chevron_right" size={18} color="#c0c7d2" />
            </div>
          ))}
          {rosterSample.length > 0 && (
            <Link to="/teams" style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#005f98', paddingTop: 6 }}>
              Vedi tutti →
            </Link>
          )}
        </div>
      </div>

      {/* Modals — tutti i Sheet pesanti lazy-loaded on-demand (M13) */}
      {selectedPlayer !== null && (
        <Suspense fallback={null}>
          <PlayerDetailSheet
            open={selectedPlayer !== null}
            onClose={() => setSelectedPlayer(null)}
            player={selectedPlayer}
            canEdit={true}
            onUpdated={() => { if (myTeam?.id) load(myTeam.id); setSelectedPlayer(null) }}
          />
        </Suspense>
      )}
      {attendanceOpen && (
        <Suspense fallback={null}>
          <AttendanceSheet
            open={attendanceOpen}
            onClose={() => setAttendanceOpen(false)}
            eventTitle={attendanceEvent?.title || ''}
            eventDate={attendanceEvent?.date || ''}
            eventTime={attendanceEvent?.time || ''}
            trainingId={attendanceEvent?.id ?? null}
            players={rosterFull.map(p => ({
              id: p.id,
              firstName: p.first_name || '',
              lastName: p.last_name || '',
              position: p.position,
            }))}
          />
        </Suspense>
      )}
      {eventEditOpen && (
        <Suspense fallback={null}>
          <EventEditSheet
            open={eventEditOpen}
            onClose={() => setEventEditOpen(false)}
            teams={[{ id: myTeam.id, name: myTeam.name, color: myTeam.color }]}
            defaultTeamId={myTeam.id}
            onSaved={() => { setEventEditOpen(false); refreshEvents() }}
          />
        </Suspense>
      )}
      {/* Selezione evento per presenze */}
      {pickEventOpen && (
        <EventPickerSheet
          open={pickEventOpen}
          onClose={() => setPickEventOpen(false)}
          events={trainingEvents}
          onPick={(e) => {
            setAttendanceEvent({
              id: e.raw?.id,
              title: e.title,
              date: e.date,
              time: e.startTime,
            })
            setPickEventOpen(false)
            setAttendanceOpen(true)
          }}
        />
      )}
    </>
  )
}

// Picker per scegliere su quale allenamento segnare le presenze
function EventPickerSheet({ open, onClose, events, onPick }: {
  open: boolean
  onClose: () => void
  events: any[]
  onPick: (e: any) => void
}) {
  // Divide passati vs futuri
  const today = todayIT()
  const past = events.filter(e => e.date < today).slice(-5).reverse()
  const upcoming = events.filter(e => e.date >= today).slice(0, 10)

  return (
    <BottomSheet open={open} onClose={onClose} title="Su quale allenamento?">
      <div style={{ padding: '4px 20px 24px' }}>
        <p style={{ fontSize: 12, color: '#707882', margin: '0 0 14px' }}>
          Scegli l'allenamento su cui vuoi registrare le presenze.
        </p>

        {upcoming.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 11, fontWeight: 800, color: '#404751', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px' }}>
              In programma
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {upcoming.map(e => (
                <EventPickerRow key={e.id} event={e} onClick={() => onPick(e)} />
              ))}
            </div>
          </div>
        )}

        {past.length > 0 && (
          <div>
            <h4 style={{ fontSize: 11, fontWeight: 800, color: '#404751', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px' }}>
              Passati recenti
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {past.map(e => (
                <EventPickerRow key={e.id} event={e} onClick={() => onPick(e)} isPast />
              ))}
            </div>
          </div>
        )}

        {events.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: '#707882', fontSize: 13 }}>
            Nessun allenamento disponibile.
          </div>
        )}
      </div>
    </BottomSheet>
  )
}

function EventPickerRow({ event, onClick, isPast }: { event: any; onClick: () => void; isPast?: boolean }) {
  const d = new Date(event.date + 'T00:00:00')
  const dateLabel = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 10,
        border: '1px solid #e6e8ee', background: '#fff',
        cursor: 'pointer', textAlign: 'left',
        opacity: isPast ? 0.75 : 1,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: '#cfe5ff', color: '#004a78',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon name="fitness_center" size={16} color="#004a78" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#181c20', textTransform: 'capitalize' }}>
          {dateLabel} · {event.startTime}
        </p>
        {event.location && (
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#707882' }}>
            {event.location}
          </p>
        )}
      </div>
      <Icon name="chevron_right" size={18} color="#c0c7d2" />
    </button>
  )
}

export default CoachDashboard
