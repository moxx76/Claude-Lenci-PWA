/**
 * pitchBuilder — Helper per costruire l'array di PitchPlayer per il componente PitchView.
 *
 * Trasforma le tre strutture dati in gioco (convocazioni + stats + info giocatori) in una lista
 * di PitchPlayer ordinata per slot, con calcolo delle sostituzioni:
 * per ogni titolare sostituito trova il subentrato che ha minute_in == titolare.minute_out
 * e imposta substituted_by + substituted_by_number sul PitchPlayer del titolare.
 *
 * Usato in: ManagerDashboard (preview prossimo/past match), Journalist page, DistintaTatticaSheet.
 */

import type { PitchPlayer } from '../components/PitchView'

interface BuildInput {
  /** Convocati con is_captain / is_vice_captain */
  convocations: Array<{
    player_id: string
    is_captain: boolean | null
    is_vice_captain: boolean | null
    shirt_number_override?: number | null
  }>
  /** Stats con role_slot / slot_index / minute_in / minute_out */
  stats: Array<{
    player_id: string
    was_starter: boolean | null
    role_slot: string | null
    role_slot_label: string | null
    slot_index: number | null
    minute_in: number | null
    minute_out: number | null
  }>
  /** Anagrafica giocatori */
  players: Record<string, { first_name: string; last_name: string; jersey_number: number | null }>
}

export function buildPitchPlayers({ convocations, stats, players }: BuildInput): PitchPlayer[] {
  const convById = new Map(convocations.map(c => [c.player_id, c]))
  const starters = stats.filter(s => s.was_starter && s.role_slot && s.slot_index != null)
  const subs = stats.filter(s => !s.was_starter && s.minute_in != null && s.minute_in > 0)

  return starters
    .map(s => {
      const p = players[s.player_id]
      const c = convById.get(s.player_id)
      if (!p) return null

      // Cerca subentrato: min_in == titolare.min_out (se titolare è stato sostituito)
      let substituted_by: string | null = null
      let substituted_by_number: number | null = null
      if (s.minute_out != null && s.minute_out > 0) {
        const sub = subs.find(x => x.minute_in === s.minute_out)
        if (sub) {
          const subPlayer = players[sub.player_id]
          if (subPlayer) {
            const subConv = convById.get(sub.player_id)
            substituted_by = subPlayer.last_name
            substituted_by_number = subConv?.shirt_number_override ?? subPlayer.jersey_number
          }
        }
      }

      return {
        slot_key: s.role_slot!,
        slot_label: s.role_slot_label || '',
        jersey_number: c?.shirt_number_override ?? p.jersey_number,
        last_name: p.last_name,
        first_name: p.first_name,
        is_captain: !!c?.is_captain,
        is_vice_captain: !!c?.is_vice_captain,
        minute_out: s.minute_out,
        substituted_by,
        substituted_by_number,
      } as PitchPlayer
    })
    .filter((x): x is PitchPlayer => x !== null)
}
