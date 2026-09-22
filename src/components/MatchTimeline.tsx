/**
 * MatchTimeline — Timeline eventi orizzontale con puntini per gol e cartellini.
 *
 * Usato in: vista giornalisti (sotto il campo grafico), preview past match in dashboard.
 *
 * Ogni evento è posizionato orizzontalmente al minuto in cui è avvenuto.
 * Eventi allo stesso minuto sono stackati verticalmente.
 *
 * La scala si adatta a `matchDuration` (dalla squadra): 2×45 = 90 min per Juniores/Prima,
 * 3×15 = 45 min per Pulcini, 3×20 = 60 min per Esordienti, ecc.
 * Se ci sono eventi oltre la durata configurata (tempi supplementari o recupero), la scala
 * si espande automaticamente al prossimo blocco da 15 min.
 */

import type { MatchDuration } from '../lib/matchDuration'
import { makeMatchDuration } from '../lib/matchDuration'

export type TimelineEventType =
  | 'goal_lenci'        // Gol Lenci (giallo)
  | 'goal_opponent'     // Gol subito (rosso)
  | 'red_card'          // Cartellino rosso Lenci
  | 'sub'               // Sostituzione

export interface TimelineEvent {
  minute: number
  type: TimelineEventType
  /** Chi (nome giocatore o "Avversario") */
  who: string
  /** Extra info (es. per sostituzione: "→ subentrato") */
  extra?: string
  /** Se è un rigore o autogol */
  variant?: 'penalty' | 'own_goal' | null
}

interface Props {
  events: TimelineEvent[]
  /** Conteggio dei cartellini gialli (mostrati come legenda perché non abbiamo minuti) */
  yellowCardsCount?: number
  /** Durata partita configurata per la squadra. Se omessa: 2×45=90 min (default per Juniores/Prima) */
  matchDuration?: MatchDuration
  /** DEPRECATO: fissa un massimo esplicito. Usa matchDuration per default e auto-espansione */
  maxMinute?: number
}

const COLORS: Record<TimelineEventType, string> = {
  goal_lenci: '#ffd100',    // giallo Lenci
  goal_opponent: '#93000a',  // rosso scuro
  red_card: '#d32f2f',       // rosso cartellino
  sub: '#005f98',            // blu
}

const ICONS: Record<TimelineEventType, string> = {
  goal_lenci: '⚽',
  goal_opponent: '⚽',
  red_card: '🟥',
  sub: '🔄',
}

const LABELS: Record<TimelineEventType, string> = {
  goal_lenci: 'Gol',
  goal_opponent: 'Gol subito',
  red_card: 'Espulsione',
  sub: 'Sostituzione',
}

export function MatchTimeline({ events, yellowCardsCount = 0, matchDuration, maxMinute }: Props) {
  if (events.length === 0 && yellowCardsCount === 0) return null

  // Determina la durata di gioco (default 2×45 = 90 se non specificata)
  const duration = matchDuration ?? makeMatchDuration(2, 45)

  // Determina la scala dell'asse. Base = durata partita.
  // Se ci sono eventi oltre (recupero/supplementari), espandi al prossimo blocco da 15 min.
  const maxEventMinute = events.reduce((m, e) => Math.max(m, e.minute), 0)
  const axisMax = maxMinute ?? (
    maxEventMinute <= duration.totalMin
      ? duration.totalMin
      : Math.ceil(maxEventMinute / 15) * 15
  )

  // Raggruppa eventi per minuto per stack verticale
  const byMinute = new Map<number, TimelineEvent[]>()
  for (const e of events) {
    if (!byMinute.has(e.minute)) byMinute.set(e.minute, [])
    byMinute.get(e.minute)!.push(e)
  }

  // Ordina gli eventi dentro un minuto: gol prima, poi rossi, poi sostituzioni
  const typeOrder: Record<TimelineEventType, number> = { goal_lenci: 0, goal_opponent: 1, red_card: 2, sub: 3 }
  for (const arr of byMinute.values()) {
    arr.sort((a, b) => typeOrder[a.type] - typeOrder[b.type])
  }

  const maxStack = Math.max(1, ...Array.from(byMinute.values()).map(a => a.length))

  // Marker asse:
  //  - 0' iniziale
  //  - fine di ogni tempo (30', 60' per 2×30; 15', 30', 45' per 3×15)
  //  - eventuali overflow per recupero/supplementari (blocchi da 15)
  const markers = new Set<number>([0])
  duration.periodEndMarkers.forEach(m => markers.add(m))
  // Se axisMax è oltre la durata configurata, aggiungi marker intermedi ogni 15 min oltre
  if (axisMax > duration.totalMin) {
    let m = duration.totalMin + 15
    while (m <= axisMax) { markers.add(m); m += 15 }
  }
  // Assicura che il finale ci sia
  markers.add(axisMax)
  const axisMarkers = Array.from(markers).sort((a, b) => a - b)

  return (
    <div style={{
      background: '#fff', border: '1px solid #e6e8ee', borderRadius: 10,
      padding: '12px 14px 8px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
        fontSize: 12, fontWeight: 700, color: '#404751',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#005f98' }}>timeline</span>
        <span>Timeline eventi</span>
        <span style={{
          fontSize: 10, fontWeight: 600, color: '#707882',
          padding: '1px 6px', borderRadius: 4, background: '#f1f3fa',
        }}>
          {duration.periodsCount}×{duration.periodDurationMin}′ · {duration.totalMin} min
        </span>
        {yellowCardsCount > 0 && (
          <span style={{
            marginLeft: 'auto', fontSize: 10.5, fontWeight: 600,
            padding: '2px 7px', borderRadius: 999,
            background: '#fff8dc', color: '#8e6300',
            border: '1px solid #ffe08a',
          }}>
            🟨 {yellowCardsCount} {yellowCardsCount === 1 ? 'ammonizione' : 'ammonizioni'}
          </span>
        )}
      </div>

      {/* Contenitore timeline: eventi sopra, asse sotto */}
      <div style={{ position: 'relative', paddingBottom: 22, paddingTop: 4 }}>
        {/* Area eventi sopra la barra */}
        <div style={{
          position: 'relative',
          height: `${Math.max(28, maxStack * 26)}px`,
          marginBottom: 6,
        }}>
          {Array.from(byMinute.entries()).map(([minute, evs]) => {
            const leftPct = Math.min(100, (minute / axisMax) * 100)
            return (
              <div key={minute} style={{
                position: 'absolute',
                left: `${leftPct}%`,
                bottom: 0,
                transform: 'translateX(-50%)',
                display: 'flex', flexDirection: 'column-reverse', alignItems: 'center',
                gap: 2,
              }}>
                {evs.map((e, i) => (
                  <div
                    key={i}
                    title={`${minute}′ — ${LABELS[e.type]}: ${e.who}${e.extra ? ' ' + e.extra : ''}${e.variant === 'penalty' ? ' (rigore)' : ''}${e.variant === 'own_goal' ? ' (autogol)' : ''}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 3,
                      background: '#fff',
                      border: `1.5px solid ${COLORS[e.type]}`,
                      borderRadius: 999,
                      padding: '1px 6px 1px 4px',
                      fontSize: 10, fontWeight: 700, color: '#181c20',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                      lineHeight: 1.3,
                    }}
                  >
                    <span style={{ fontSize: 11 }}>{ICONS[e.type]}</span>
                    <span style={{ color: '#404751' }}>{minute}′</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* Barra colorata: alternata blu/rosso per ogni tempo, con banda rossa sottile tra i tempi */}
        {(() => {
          // Costruisco un gradient a bande per rappresentare i N tempi.
          // Ogni tempo è blu, tra un tempo e l'altro un bordo rosso di 1% larghezza.
          // In caso di overflow oltre la durata configurata, l'ultima banda è disegnata comunque blu.
          const stops: string[] = []
          const bandColor = '#005f98'
          const dividerColor = '#d32f2f'
          const dividerHalfPct = 0.5  // metà larghezza di ciascun divisore, in %
          // Segno tutti gli end-of-period che stanno DENTRO axisMax e non sono il finale
          const dividerPcts = duration.periodEndMarkers
            .filter(m => m < axisMax)
            .map(m => (m / axisMax) * 100)
          if (dividerPcts.length === 0) {
            stops.push(`${bandColor} 0%`, `${bandColor} 100%`)
          } else {
            let cursor = 0
            for (const p of dividerPcts) {
              stops.push(`${bandColor} ${cursor}%`, `${bandColor} ${p - dividerHalfPct}%`)
              stops.push(`${dividerColor} ${p - dividerHalfPct}%`, `${dividerColor} ${p + dividerHalfPct}%`)
              cursor = p + dividerHalfPct
            }
            stops.push(`${bandColor} ${cursor}%`, `${bandColor} 100%`)
          }
          const gradient = `linear-gradient(90deg, ${stops.join(', ')})`

          return (
            <div style={{
              position: 'relative',
              height: 6,
              background: gradient,
              borderRadius: 3,
            }}>
              {/* Marker verticali dei minuti chiave */}
              {axisMarkers.map(m => {
                const leftPct = Math.min(100, (m / axisMax) * 100)
                return (
                  <div key={m} style={{
                    position: 'absolute', left: `${leftPct}%`, top: -2,
                    width: 1, height: 10, background: '#404751',
                    transform: 'translateX(-50%)',
                  }} />
                )
              })}
            </div>
          )
        })()}

        {/* Labels asse sotto */}
        <div style={{ position: 'relative', height: 14, marginTop: 2 }}>
          {axisMarkers.map(m => {
            const leftPct = Math.min(100, (m / axisMax) * 100)
            // È fine di un tempo? (marker rosso in evidenza).
            // Il totale finale della partita (ultimo periodo) NON viene etichettato "fine T2" ecc,
            // resta la label del minuto liscia per non confondere con "fine partita".
            const periodIdx = duration.periodEndMarkers.indexOf(m)
            const isPeriodEnd = periodIdx >= 0 && periodIdx < duration.periodsCount - 1
            const isFinalEnd = m === duration.totalMin && m === axisMax
            return (
              <span key={m} style={{
                position: 'absolute', left: `${leftPct}%`,
                transform: 'translateX(-50%)',
                fontSize: 9.5, fontWeight: isPeriodEnd || isFinalEnd ? 800 : 600,
                color: isPeriodEnd ? '#d32f2f' : isFinalEnd ? '#404751' : '#707882',
                whiteSpace: 'nowrap',
              }}>
                {m}′{isPeriodEnd && ` fine T${periodIdx + 1}`}
                {isFinalEnd && duration.periodsCount > 1 && ' FINE'}
              </span>
            )
          })}
        </div>
      </div>

      {/* Elenco eventi dettagliato sotto la barra */}
      {events.length > 0 && (
        <div style={{
          marginTop: 6, paddingTop: 8,
          borderTop: '1px dashed #e6e8ee',
          display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          {[...events].sort((a, b) => a.minute - b.minute || typeOrder[a.type] - typeOrder[b.type]).map((e, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 11, color: '#181c20',
            }}>
              <span style={{
                minWidth: 32, textAlign: 'right',
                fontFamily: 'ui-monospace, monospace', fontWeight: 700,
                color: '#404751',
              }}>{e.minute}′</span>
              <span style={{
                width: 16, height: 16, borderRadius: '50%',
                background: COLORS[e.type], flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              }}>{ICONS[e.type]}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong>{e.who}</strong>
                {e.extra && <span style={{ color: '#707882' }}> {e.extra}</span>}
                {e.variant === 'penalty' && <span style={{ color: '#8e6300', marginLeft: 4, fontSize: 10 }}>(rigore)</span>}
                {e.variant === 'own_goal' && <span style={{ color: '#8e6300', marginLeft: 4, fontSize: 10 }}>(autogol)</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
