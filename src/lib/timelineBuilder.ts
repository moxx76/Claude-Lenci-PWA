/**
 * timelineBuilder — Costruisce l'array TimelineEvent[] per il componente MatchTimeline.
 *
 * Attinge dati da:
 * - match_player_stats: goal_minutes (gol Lenci), penalty_minutes (rigori Lenci),
 *   own_goal_minutes (autogol Lenci contro), red_card_minute, minute_in (sostituzioni)
 * - matches: opponent_goal_minutes (gol subiti avversari), opponent_own_goal_minutes (autogol avversari a favore)
 *
 * Ordina per minuto crescente. Restituisce anche il conteggio dei gialli (senza minuti nel DB).
 */

import type { TimelineEvent } from '../components/MatchTimeline'

interface StatsRow {
  player_id: string
  was_starter: boolean | null
  minute_in: number | null
  minute_out: number | null
  goals: number
  goal_minutes: number[] | null
  penalties_scored: number
  penalty_minutes: number[] | null
  own_goals: number
  own_goal_minutes: number[] | null
  yellow_cards: number
  red_card: boolean
  red_card_minute: number | null
}

interface BuildInput {
  stats: StatsRow[]
  players: Record<string, { first_name: string; last_name: string; jersey_number: number | null }>
  /** Gol subiti (avversari) - minuti */
  opponentGoalMinutes: number[]
  /** Autogol avversari a favore Lenci - minuti */
  opponentOwnGoalMinutes: number[]
}

interface BuildOutput {
  events: TimelineEvent[]
  yellowCardsCount: number
}

export function buildTimelineEvents({
  stats, players, opponentGoalMinutes, opponentOwnGoalMinutes,
}: BuildInput): BuildOutput {
  const events: TimelineEvent[] = []
  let yellowCardsCount = 0

  for (const s of stats) {
    const p = players[s.player_id]
    if (!p) continue
    const shortName = `${p.last_name} ${p.first_name?.[0] ?? ''}.`

    // Gol Lenci (esclusi rigori, che sono nel loro campo dedicato)
    // Alcune partite hanno goals > 0 ma goal_minutes vuoto (non compilati): non li mostro sulla timeline
    for (const min of s.goal_minutes ?? []) {
      events.push({ minute: min, type: 'goal_lenci', who: shortName })
    }
    // Rigori segnati
    for (const min of s.penalty_minutes ?? []) {
      events.push({ minute: min, type: 'goal_lenci', who: shortName, variant: 'penalty' })
    }
    // Autogol Lenci (nostri, che vanno all'avversario)
    for (const min of s.own_goal_minutes ?? []) {
      events.push({ minute: min, type: 'goal_opponent', who: shortName, variant: 'own_goal' })
    }
    // Cartellino rosso Lenci
    if (s.red_card && s.red_card_minute != null) {
      events.push({ minute: s.red_card_minute, type: 'red_card', who: shortName })
    }
    // Sostituzione: subentrato (minute_in > 0 e non titolare)
    if (!s.was_starter && s.minute_in != null && s.minute_in > 0) {
      // Trova chi è uscito (titolare con minute_out == minute_in del sub)
      const outStat = stats.find(x => x.was_starter && x.minute_out === s.minute_in)
      const outName = outStat ? (() => {
        const op = players[outStat.player_id]
        return op ? `${op.last_name} ${op.first_name?.[0] ?? ''}.` : null
      })() : null
      events.push({
        minute: s.minute_in,
        type: 'sub',
        who: shortName,
        extra: outName ? `\u2190 ${outName}` : undefined,
      })
    }
    // Gialli: solo conteggio (no minuti)
    yellowCardsCount += s.yellow_cards || 0
  }

  // Gol subiti avversari
  for (const min of opponentGoalMinutes ?? []) {
    events.push({ minute: min, type: 'goal_opponent', who: 'Avversario' })
  }
  // Autogol avversari a favore Lenci
  for (const min of opponentOwnGoalMinutes ?? []) {
    events.push({ minute: min, type: 'goal_lenci', who: 'Avversario', variant: 'own_goal' })
  }

  // Ordina per minuto crescente
  events.sort((a, b) => a.minute - b.minute)

  return { events, yellowCardsCount }
}
