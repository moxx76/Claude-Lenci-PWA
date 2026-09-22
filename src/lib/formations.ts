/**
 * Mappa moduli tattici → slot posizionali.
 *
 * Ogni slot è (key, label, position_hint):
 * - key = identificatore stabile del ruolo tattico ("GK", "DC1", "TD", "AS", ecc.)
 *   → salvato in match_player_stats.role_slot, non cambia se l'utente rinomina la label
 * - label = etichetta visibile pre-compilata, editabile dall'utente per singolo slot
 *   → salvata in match_player_stats.role_slot_label
 * - position_hint = ruolo naturale del giocatore che di solito occupa quello slot
 *   → usato per ordinare/evidenziare i candidati nel dropdown (giocatori del ruolo giusto in cima)
 *
 * L'ordine dell'array è quello con cui gli slot vengono renderizzati (portiere → difesa → centro → attacco).
 * slot_index (salvato in DB) = indice nell'array del modulo scelto.
 */

export interface FormationSlot {
  key: string
  label: string
  position_hint: string  // corrisponde a POSITIONS in PostMatchSheet
}

export const FORMATIONS: Record<string, FormationSlot[]> = {
  '4-4-2': [
    { key: 'GK',  label: 'Portiere',           position_hint: 'Portiere' },
    { key: 'TD',  label: 'Terzino destro',     position_hint: 'Terzino destro' },
    { key: 'DC1', label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'DC2', label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'TS',  label: 'Terzino sinistro',   position_hint: 'Terzino sinistro' },
    { key: 'ED',  label: 'Esterno destro',     position_hint: 'Esterno destro' },
    { key: 'CC1', label: 'Centrocampista',     position_hint: 'Centrocampista centrale' },
    { key: 'CC2', label: 'Centrocampista',     position_hint: 'Centrocampista centrale' },
    { key: 'ES',  label: 'Esterno sinistro',   position_hint: 'Esterno sinistro' },
    { key: 'PC1', label: 'Punta',              position_hint: 'Punta centrale' },
    { key: 'PC2', label: 'Punta',              position_hint: 'Punta centrale' },
  ],
  '4-3-3': [
    { key: 'GK',  label: 'Portiere',           position_hint: 'Portiere' },
    { key: 'TD',  label: 'Terzino destro',     position_hint: 'Terzino destro' },
    { key: 'DC1', label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'DC2', label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'TS',  label: 'Terzino sinistro',   position_hint: 'Terzino sinistro' },
    { key: 'MED', label: 'Mediano',            position_hint: 'Mediano' },
    { key: 'INTD',label: 'Interno destro',     position_hint: 'Interno destro' },
    { key: 'INTS',label: 'Interno sinistro',   position_hint: 'Interno sinistro' },
    { key: 'AD',  label: 'Ala destra',         position_hint: 'Ala destra' },
    { key: 'PC',  label: 'Punta centrale',     position_hint: 'Punta centrale' },
    { key: 'AS',  label: 'Ala sinistra',       position_hint: 'Ala sinistra' },
  ],
  '4-2-3-1': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere' },
    { key: 'TD',   label: 'Terzino destro',     position_hint: 'Terzino destro' },
    { key: 'DC1',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'DC2',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'TS',   label: 'Terzino sinistro',   position_hint: 'Terzino sinistro' },
    { key: 'MED1', label: 'Mediano',            position_hint: 'Mediano' },
    { key: 'MED2', label: 'Mediano',            position_hint: 'Mediano' },
    { key: 'ED',   label: 'Esterno destro',     position_hint: 'Esterno destro' },
    { key: 'TRQ',  label: 'Trequartista',       position_hint: 'Trequartista' },
    { key: 'ES',   label: 'Esterno sinistro',   position_hint: 'Esterno sinistro' },
    { key: 'PC',   label: 'Punta centrale',     position_hint: 'Punta centrale' },
  ],
  '4-3-1-2': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere' },
    { key: 'TD',   label: 'Terzino destro',     position_hint: 'Terzino destro' },
    { key: 'DC1',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'DC2',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'TS',   label: 'Terzino sinistro',   position_hint: 'Terzino sinistro' },
    { key: 'MED',  label: 'Mediano',            position_hint: 'Mediano' },
    { key: 'INTD', label: 'Interno destro',     position_hint: 'Interno destro' },
    { key: 'INTS', label: 'Interno sinistro',   position_hint: 'Interno sinistro' },
    { key: 'TRQ',  label: 'Trequartista',       position_hint: 'Trequartista' },
    { key: 'PC1',  label: 'Punta',              position_hint: 'Punta centrale' },
    { key: 'PC2',  label: 'Seconda punta',      position_hint: 'Seconda punta' },
  ],
  '4-1-4-1': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere' },
    { key: 'TD',   label: 'Terzino destro',     position_hint: 'Terzino destro' },
    { key: 'DC1',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'DC2',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'TS',   label: 'Terzino sinistro',   position_hint: 'Terzino sinistro' },
    { key: 'MED',  label: 'Mediano',            position_hint: 'Mediano' },
    { key: 'ED',   label: 'Esterno destro',     position_hint: 'Esterno destro' },
    { key: 'CC1',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale' },
    { key: 'CC2',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale' },
    { key: 'ES',   label: 'Esterno sinistro',   position_hint: 'Esterno sinistro' },
    { key: 'PC',   label: 'Punta centrale',     position_hint: 'Punta centrale' },
  ],
  '4-5-1': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere' },
    { key: 'TD',   label: 'Terzino destro',     position_hint: 'Terzino destro' },
    { key: 'DC1',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'DC2',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'TS',   label: 'Terzino sinistro',   position_hint: 'Terzino sinistro' },
    { key: 'ED',   label: 'Esterno destro',     position_hint: 'Esterno destro' },
    { key: 'CC1',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale' },
    { key: 'MED',  label: 'Mediano',            position_hint: 'Mediano' },
    { key: 'CC2',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale' },
    { key: 'ES',   label: 'Esterno sinistro',   position_hint: 'Esterno sinistro' },
    { key: 'PC',   label: 'Punta centrale',     position_hint: 'Punta centrale' },
  ],
  '3-5-2': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere' },
    { key: 'DC1',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'DC2',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'DC3',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'ED',   label: 'Esterno destro',     position_hint: 'Esterno destro' },
    { key: 'INTD', label: 'Interno destro',     position_hint: 'Interno destro' },
    { key: 'MED',  label: 'Mediano',            position_hint: 'Mediano' },
    { key: 'INTS', label: 'Interno sinistro',   position_hint: 'Interno sinistro' },
    { key: 'ES',   label: 'Esterno sinistro',   position_hint: 'Esterno sinistro' },
    { key: 'PC1',  label: 'Punta',              position_hint: 'Punta centrale' },
    { key: 'PC2',  label: 'Punta',              position_hint: 'Punta centrale' },
  ],
  '3-4-3': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere' },
    { key: 'DC1',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'DC2',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'DC3',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'ED',   label: 'Esterno destro',     position_hint: 'Esterno destro' },
    { key: 'CC1',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale' },
    { key: 'CC2',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale' },
    { key: 'ES',   label: 'Esterno sinistro',   position_hint: 'Esterno sinistro' },
    { key: 'AD',   label: 'Ala destra',         position_hint: 'Ala destra' },
    { key: 'PC',   label: 'Punta centrale',     position_hint: 'Punta centrale' },
    { key: 'AS',   label: 'Ala sinistra',       position_hint: 'Ala sinistra' },
  ],
  '3-4-1-2': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere' },
    { key: 'DC1',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'DC2',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'DC3',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'ED',   label: 'Esterno destro',     position_hint: 'Esterno destro' },
    { key: 'CC1',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale' },
    { key: 'CC2',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale' },
    { key: 'ES',   label: 'Esterno sinistro',   position_hint: 'Esterno sinistro' },
    { key: 'TRQ',  label: 'Trequartista',       position_hint: 'Trequartista' },
    { key: 'PC1',  label: 'Punta',              position_hint: 'Punta centrale' },
    { key: 'PC2',  label: 'Seconda punta',      position_hint: 'Seconda punta' },
  ],
  '3-4-2-1': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere' },
    { key: 'DC1',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'DC2',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'DC3',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'ED',   label: 'Esterno destro',     position_hint: 'Esterno destro' },
    { key: 'CC1',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale' },
    { key: 'CC2',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale' },
    { key: 'ES',   label: 'Esterno sinistro',   position_hint: 'Esterno sinistro' },
    { key: 'TRQ1', label: 'Trequartista',       position_hint: 'Trequartista' },
    { key: 'TRQ2', label: 'Trequartista',       position_hint: 'Trequartista' },
    { key: 'PC',   label: 'Punta centrale',     position_hint: 'Punta centrale' },
  ],
  '5-3-2': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere' },
    { key: 'TD',   label: 'Terzino destro',     position_hint: 'Terzino destro' },
    { key: 'DC1',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'DC2',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'DC3',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'TS',   label: 'Terzino sinistro',   position_hint: 'Terzino sinistro' },
    { key: 'INTD', label: 'Interno destro',     position_hint: 'Interno destro' },
    { key: 'MED',  label: 'Mediano',            position_hint: 'Mediano' },
    { key: 'INTS', label: 'Interno sinistro',   position_hint: 'Interno sinistro' },
    { key: 'PC1',  label: 'Punta',              position_hint: 'Punta centrale' },
    { key: 'PC2',  label: 'Punta',              position_hint: 'Punta centrale' },
  ],
  '5-4-1': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere' },
    { key: 'TD',   label: 'Terzino destro',     position_hint: 'Terzino destro' },
    { key: 'DC1',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'DC2',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'DC3',  label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'TS',   label: 'Terzino sinistro',   position_hint: 'Terzino sinistro' },
    { key: 'ED',   label: 'Esterno destro',     position_hint: 'Esterno destro' },
    { key: 'CC1',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale' },
    { key: 'CC2',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale' },
    { key: 'ES',   label: 'Esterno sinistro',   position_hint: 'Esterno sinistro' },
    { key: 'PC',   label: 'Punta centrale',     position_hint: 'Punta centrale' },
  ],
  // Formati ridotti a 7 (Pulcini/Primi Calci): 1 portiere + 6 giocatori
  '2-3-1 (a 7)': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere' },
    { key: 'DC1',  label: 'Difensore',          position_hint: 'Difensore centrale' },
    { key: 'DC2',  label: 'Difensore',          position_hint: 'Difensore centrale' },
    { key: 'CD',   label: 'Centrocampista dx',  position_hint: 'Esterno destro' },
    { key: 'CM',   label: 'Centrocampista',     position_hint: 'Centrocampista centrale' },
    { key: 'CS',   label: 'Centrocampista sx',  position_hint: 'Esterno sinistro' },
    { key: 'PC',   label: 'Punta',              position_hint: 'Punta centrale' },
  ],
  '3-3 (a 7)': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere' },
    { key: 'DD',   label: 'Difensore destro',   position_hint: 'Terzino destro' },
    { key: 'DC',   label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'DS',   label: 'Difensore sinistro', position_hint: 'Terzino sinistro' },
    { key: 'AD',   label: 'Attaccante destro',  position_hint: 'Ala destra' },
    { key: 'PC',   label: 'Attaccante centrale',position_hint: 'Punta centrale' },
    { key: 'AS',   label: 'Attaccante sinistro',position_hint: 'Ala sinistra' },
  ],
  // Formati ridotti a 9 (Esordienti): 1 portiere + 8 giocatori
  '3-3-2 (a 9)': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere' },
    { key: 'DD',   label: 'Difensore destro',   position_hint: 'Terzino destro' },
    { key: 'DC',   label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'DS',   label: 'Difensore sinistro', position_hint: 'Terzino sinistro' },
    { key: 'CD',   label: 'Centrocampista dx',  position_hint: 'Esterno destro' },
    { key: 'CC',   label: 'Centrocampista',     position_hint: 'Centrocampista centrale' },
    { key: 'CS',   label: 'Centrocampista sx',  position_hint: 'Esterno sinistro' },
    { key: 'PC1',  label: 'Attaccante',         position_hint: 'Punta centrale' },
    { key: 'PC2',  label: 'Attaccante',         position_hint: 'Punta centrale' },
  ],
  '3-2-3 (a 9)': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere' },
    { key: 'DD',   label: 'Difensore destro',   position_hint: 'Terzino destro' },
    { key: 'DC',   label: 'Difensore centrale', position_hint: 'Difensore centrale' },
    { key: 'DS',   label: 'Difensore sinistro', position_hint: 'Terzino sinistro' },
    { key: 'CC1',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale' },
    { key: 'CC2',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale' },
    { key: 'AD',   label: 'Attaccante destro',  position_hint: 'Ala destra' },
    { key: 'PC',   label: 'Attaccante centrale',position_hint: 'Punta centrale' },
    { key: 'AS',   label: 'Attaccante sinistro',position_hint: 'Ala sinistra' },
  ],
  '2-4-2 (a 9)': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere' },
    { key: 'DC1',  label: 'Difensore',          position_hint: 'Difensore centrale' },
    { key: 'DC2',  label: 'Difensore',          position_hint: 'Difensore centrale' },
    { key: 'ED',   label: 'Esterno destro',     position_hint: 'Esterno destro' },
    { key: 'CC1',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale' },
    { key: 'CC2',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale' },
    { key: 'ES',   label: 'Esterno sinistro',   position_hint: 'Esterno sinistro' },
    { key: 'PC1',  label: 'Attaccante',         position_hint: 'Punta centrale' },
    { key: 'PC2',  label: 'Attaccante',         position_hint: 'Punta centrale' },
  ],
}

export const FORMATION_KEYS = Object.keys(FORMATIONS)

/**
 * Numero di titolari attesi per un modulo (utile per lo step Panchina)
 */
export function startersCount(formation: string): number {
  return FORMATIONS[formation]?.length ?? 11
}

/**
 * Numero massimo di panchinari consigliato per un modulo:
 * - 11 titolari → max 9 panchina (20 convocati totali)
 * -  9 titolari → max 7 panchina (16 convocati)
 * -  7 titolari → max 5 panchina (12 convocati)
 */
export function benchMax(formation: string): number {
  const n = startersCount(formation)
  if (n <= 7) return 5
  if (n <= 9) return 7
  return 9
}
