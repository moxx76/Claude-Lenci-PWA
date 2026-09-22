/**
 * Mappa moduli tattici → slot posizionali.
 *
 * Ogni slot è (key, label, position_hint, x, y):
 * - key = identificatore stabile del ruolo tattico ("GK", "DC1", "TD", "AS", ecc.)
 *   → salvato in match_player_stats.role_slot, non cambia se l'utente rinomina la label
 * - label = etichetta visibile pre-compilata, editabile dall'utente per singolo slot
 *   → salvata in match_player_stats.role_slot_label
 * - position_hint = ruolo naturale del giocatore che di solito occupa quello slot
 *   → usato per ordinare/evidenziare i candidati nel dropdown
 * - x/y = coordinate percentuali (0..100) per il campo grafico SVG
 *   → x: 0=lato sinistro campo, 100=lato destro
 *   → y: 0=nostra porta (basso), 100=area avversaria (alto)
 *     (in SVG l'origine è in alto a sinistra: convertiremo con 100-y quando renderizziamo)
 *
 * L'ordine dell'array è quello con cui gli slot vengono renderizzati (portiere → difesa → centro → attacco).
 * slot_index (salvato in DB) = indice nell'array del modulo scelto.
 *
 * CONVENZIONE X: dal punto di vista di chi guarda il campo con noi che attacchiamo verso l'alto.
 * Riga y=8 portiere, y=28 difesa, y=45 mediana bassa, y=58 mediana alta, y=72 trequarti, y=85 attacco.
 */

export interface FormationSlot {
  key: string
  label: string
  position_hint: string
  x: number
  y: number
}

export const FORMATIONS: Record<string, FormationSlot[]> = {
  '4-4-2': [
    { key: 'GK',  label: 'Portiere',           position_hint: 'Portiere',            x: 50, y: 8  },
    { key: 'TD',  label: 'Terzino destro',     position_hint: 'Terzino destro',      x: 85, y: 28 },
    { key: 'DC1', label: 'Difensore centrale', position_hint: 'Difensore centrale',  x: 62, y: 28 },
    { key: 'DC2', label: 'Difensore centrale', position_hint: 'Difensore centrale',  x: 38, y: 28 },
    { key: 'TS',  label: 'Terzino sinistro',   position_hint: 'Terzino sinistro',    x: 15, y: 28 },
    { key: 'ED',  label: 'Esterno destro',     position_hint: 'Esterno destro',      x: 85, y: 55 },
    { key: 'CC1', label: 'Centrocampista',     position_hint: 'Centrocampista centrale', x: 62, y: 55 },
    { key: 'CC2', label: 'Centrocampista',     position_hint: 'Centrocampista centrale', x: 38, y: 55 },
    { key: 'ES',  label: 'Esterno sinistro',   position_hint: 'Esterno sinistro',    x: 15, y: 55 },
    { key: 'PC1', label: 'Punta',              position_hint: 'Punta centrale',      x: 62, y: 82 },
    { key: 'PC2', label: 'Punta',              position_hint: 'Punta centrale',      x: 38, y: 82 },
  ],
  '4-3-3': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere',           x: 50, y: 8  },
    { key: 'TD',   label: 'Terzino destro',     position_hint: 'Terzino destro',     x: 85, y: 28 },
    { key: 'DC1',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 62, y: 28 },
    { key: 'DC2',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 38, y: 28 },
    { key: 'TS',   label: 'Terzino sinistro',   position_hint: 'Terzino sinistro',   x: 15, y: 28 },
    { key: 'MED',  label: 'Mediano',            position_hint: 'Mediano',            x: 50, y: 48 },
    { key: 'INTD', label: 'Interno destro',     position_hint: 'Interno destro',     x: 70, y: 60 },
    { key: 'INTS', label: 'Interno sinistro',   position_hint: 'Interno sinistro',   x: 30, y: 60 },
    { key: 'AD',   label: 'Ala destra',         position_hint: 'Ala destra',         x: 85, y: 82 },
    { key: 'PC',   label: 'Punta centrale',     position_hint: 'Punta centrale',     x: 50, y: 85 },
    { key: 'AS',   label: 'Ala sinistra',       position_hint: 'Ala sinistra',       x: 15, y: 82 },
  ],
  '4-2-3-1': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere',           x: 50, y: 8  },
    { key: 'TD',   label: 'Terzino destro',     position_hint: 'Terzino destro',     x: 85, y: 28 },
    { key: 'DC1',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 62, y: 28 },
    { key: 'DC2',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 38, y: 28 },
    { key: 'TS',   label: 'Terzino sinistro',   position_hint: 'Terzino sinistro',   x: 15, y: 28 },
    { key: 'MED1', label: 'Mediano',            position_hint: 'Mediano',            x: 62, y: 48 },
    { key: 'MED2', label: 'Mediano',            position_hint: 'Mediano',            x: 38, y: 48 },
    { key: 'ED',   label: 'Esterno destro',     position_hint: 'Esterno destro',     x: 85, y: 68 },
    { key: 'TRQ',  label: 'Trequartista',       position_hint: 'Trequartista',       x: 50, y: 70 },
    { key: 'ES',   label: 'Esterno sinistro',   position_hint: 'Esterno sinistro',   x: 15, y: 68 },
    { key: 'PC',   label: 'Punta centrale',     position_hint: 'Punta centrale',     x: 50, y: 88 },
  ],
  '4-3-1-2': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere',           x: 50, y: 8  },
    { key: 'TD',   label: 'Terzino destro',     position_hint: 'Terzino destro',     x: 85, y: 28 },
    { key: 'DC1',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 62, y: 28 },
    { key: 'DC2',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 38, y: 28 },
    { key: 'TS',   label: 'Terzino sinistro',   position_hint: 'Terzino sinistro',   x: 15, y: 28 },
    { key: 'MED',  label: 'Mediano',            position_hint: 'Mediano',            x: 50, y: 47 },
    { key: 'INTD', label: 'Interno destro',     position_hint: 'Interno destro',     x: 75, y: 55 },
    { key: 'INTS', label: 'Interno sinistro',   position_hint: 'Interno sinistro',   x: 25, y: 55 },
    { key: 'TRQ',  label: 'Trequartista',       position_hint: 'Trequartista',       x: 50, y: 70 },
    { key: 'PC1',  label: 'Punta',              position_hint: 'Punta centrale',     x: 62, y: 87 },
    { key: 'PC2',  label: 'Seconda punta',      position_hint: 'Seconda punta',      x: 38, y: 87 },
  ],
  '4-1-4-1': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere',           x: 50, y: 8  },
    { key: 'TD',   label: 'Terzino destro',     position_hint: 'Terzino destro',     x: 85, y: 28 },
    { key: 'DC1',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 62, y: 28 },
    { key: 'DC2',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 38, y: 28 },
    { key: 'TS',   label: 'Terzino sinistro',   position_hint: 'Terzino sinistro',   x: 15, y: 28 },
    { key: 'MED',  label: 'Mediano',            position_hint: 'Mediano',            x: 50, y: 45 },
    { key: 'ED',   label: 'Esterno destro',     position_hint: 'Esterno destro',     x: 85, y: 62 },
    { key: 'CC1',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale', x: 62, y: 65 },
    { key: 'CC2',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale', x: 38, y: 65 },
    { key: 'ES',   label: 'Esterno sinistro',   position_hint: 'Esterno sinistro',   x: 15, y: 62 },
    { key: 'PC',   label: 'Punta centrale',     position_hint: 'Punta centrale',     x: 50, y: 88 },
  ],
  '4-5-1': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere',           x: 50, y: 8  },
    { key: 'TD',   label: 'Terzino destro',     position_hint: 'Terzino destro',     x: 85, y: 28 },
    { key: 'DC1',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 62, y: 28 },
    { key: 'DC2',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 38, y: 28 },
    { key: 'TS',   label: 'Terzino sinistro',   position_hint: 'Terzino sinistro',   x: 15, y: 28 },
    { key: 'ED',   label: 'Esterno destro',     position_hint: 'Esterno destro',     x: 85, y: 60 },
    { key: 'CC1',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale', x: 65, y: 60 },
    { key: 'MED',  label: 'Mediano',            position_hint: 'Mediano',            x: 50, y: 50 },
    { key: 'CC2',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale', x: 35, y: 60 },
    { key: 'ES',   label: 'Esterno sinistro',   position_hint: 'Esterno sinistro',   x: 15, y: 60 },
    { key: 'PC',   label: 'Punta centrale',     position_hint: 'Punta centrale',     x: 50, y: 88 },
  ],
  '3-5-2': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere',           x: 50, y: 8  },
    { key: 'DC1',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 75, y: 28 },
    { key: 'DC2',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 50, y: 26 },
    { key: 'DC3',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 25, y: 28 },
    { key: 'ED',   label: 'Esterno destro',     position_hint: 'Esterno destro',     x: 88, y: 55 },
    { key: 'INTD', label: 'Interno destro',     position_hint: 'Interno destro',     x: 68, y: 58 },
    { key: 'MED',  label: 'Mediano',            position_hint: 'Mediano',            x: 50, y: 50 },
    { key: 'INTS', label: 'Interno sinistro',   position_hint: 'Interno sinistro',   x: 32, y: 58 },
    { key: 'ES',   label: 'Esterno sinistro',   position_hint: 'Esterno sinistro',   x: 12, y: 55 },
    { key: 'PC1',  label: 'Punta',              position_hint: 'Punta centrale',     x: 62, y: 85 },
    { key: 'PC2',  label: 'Punta',              position_hint: 'Punta centrale',     x: 38, y: 85 },
  ],
  '3-4-3': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere',           x: 50, y: 8  },
    { key: 'DC1',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 75, y: 28 },
    { key: 'DC2',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 50, y: 26 },
    { key: 'DC3',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 25, y: 28 },
    { key: 'ED',   label: 'Esterno destro',     position_hint: 'Esterno destro',     x: 85, y: 55 },
    { key: 'CC1',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale', x: 62, y: 55 },
    { key: 'CC2',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale', x: 38, y: 55 },
    { key: 'ES',   label: 'Esterno sinistro',   position_hint: 'Esterno sinistro',   x: 15, y: 55 },
    { key: 'AD',   label: 'Ala destra',         position_hint: 'Ala destra',         x: 82, y: 82 },
    { key: 'PC',   label: 'Punta centrale',     position_hint: 'Punta centrale',     x: 50, y: 85 },
    { key: 'AS',   label: 'Ala sinistra',       position_hint: 'Ala sinistra',       x: 18, y: 82 },
  ],
  '3-4-1-2': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere',           x: 50, y: 8  },
    { key: 'DC1',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 75, y: 28 },
    { key: 'DC2',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 50, y: 26 },
    { key: 'DC3',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 25, y: 28 },
    { key: 'ED',   label: 'Esterno destro',     position_hint: 'Esterno destro',     x: 85, y: 52 },
    { key: 'CC1',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale', x: 62, y: 52 },
    { key: 'CC2',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale', x: 38, y: 52 },
    { key: 'ES',   label: 'Esterno sinistro',   position_hint: 'Esterno sinistro',   x: 15, y: 52 },
    { key: 'TRQ',  label: 'Trequartista',       position_hint: 'Trequartista',       x: 50, y: 70 },
    { key: 'PC1',  label: 'Punta',              position_hint: 'Punta centrale',     x: 62, y: 87 },
    { key: 'PC2',  label: 'Seconda punta',      position_hint: 'Seconda punta',      x: 38, y: 87 },
  ],
  '3-4-2-1': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere',           x: 50, y: 8  },
    { key: 'DC1',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 75, y: 28 },
    { key: 'DC2',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 50, y: 26 },
    { key: 'DC3',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 25, y: 28 },
    { key: 'ED',   label: 'Esterno destro',     position_hint: 'Esterno destro',     x: 85, y: 52 },
    { key: 'CC1',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale', x: 62, y: 52 },
    { key: 'CC2',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale', x: 38, y: 52 },
    { key: 'ES',   label: 'Esterno sinistro',   position_hint: 'Esterno sinistro',   x: 15, y: 52 },
    { key: 'TRQ1', label: 'Trequartista',       position_hint: 'Trequartista',       x: 65, y: 72 },
    { key: 'TRQ2', label: 'Trequartista',       position_hint: 'Trequartista',       x: 35, y: 72 },
    { key: 'PC',   label: 'Punta centrale',     position_hint: 'Punta centrale',     x: 50, y: 88 },
  ],
  '5-3-2': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere',           x: 50, y: 8  },
    { key: 'TD',   label: 'Terzino destro',     position_hint: 'Terzino destro',     x: 88, y: 30 },
    { key: 'DC1',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 68, y: 26 },
    { key: 'DC2',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 50, y: 24 },
    { key: 'DC3',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 32, y: 26 },
    { key: 'TS',   label: 'Terzino sinistro',   position_hint: 'Terzino sinistro',   x: 12, y: 30 },
    { key: 'INTD', label: 'Interno destro',     position_hint: 'Interno destro',     x: 68, y: 58 },
    { key: 'MED',  label: 'Mediano',            position_hint: 'Mediano',            x: 50, y: 50 },
    { key: 'INTS', label: 'Interno sinistro',   position_hint: 'Interno sinistro',   x: 32, y: 58 },
    { key: 'PC1',  label: 'Punta',              position_hint: 'Punta centrale',     x: 62, y: 85 },
    { key: 'PC2',  label: 'Punta',              position_hint: 'Punta centrale',     x: 38, y: 85 },
  ],
  '5-4-1': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere',           x: 50, y: 8  },
    { key: 'TD',   label: 'Terzino destro',     position_hint: 'Terzino destro',     x: 88, y: 30 },
    { key: 'DC1',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 68, y: 26 },
    { key: 'DC2',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 50, y: 24 },
    { key: 'DC3',  label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 32, y: 26 },
    { key: 'TS',   label: 'Terzino sinistro',   position_hint: 'Terzino sinistro',   x: 12, y: 30 },
    { key: 'ED',   label: 'Esterno destro',     position_hint: 'Esterno destro',     x: 85, y: 58 },
    { key: 'CC1',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale', x: 62, y: 58 },
    { key: 'CC2',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale', x: 38, y: 58 },
    { key: 'ES',   label: 'Esterno sinistro',   position_hint: 'Esterno sinistro',   x: 15, y: 58 },
    { key: 'PC',   label: 'Punta centrale',     position_hint: 'Punta centrale',     x: 50, y: 88 },
  ],
  // Formati ridotti a 7 (Pulcini/Primi Calci): 1 portiere + 6 giocatori
  '2-3-1 (a 7)': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere',           x: 50, y: 10 },
    { key: 'DC1',  label: 'Difensore',          position_hint: 'Difensore centrale', x: 65, y: 32 },
    { key: 'DC2',  label: 'Difensore',          position_hint: 'Difensore centrale', x: 35, y: 32 },
    { key: 'CD',   label: 'Centrocampista dx',  position_hint: 'Esterno destro',     x: 78, y: 58 },
    { key: 'CM',   label: 'Centrocampista',     position_hint: 'Centrocampista centrale', x: 50, y: 55 },
    { key: 'CS',   label: 'Centrocampista sx',  position_hint: 'Esterno sinistro',   x: 22, y: 58 },
    { key: 'PC',   label: 'Punta',              position_hint: 'Punta centrale',     x: 50, y: 85 },
  ],
  '3-3 (a 7)': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere',           x: 50, y: 10 },
    { key: 'DD',   label: 'Difensore destro',   position_hint: 'Terzino destro',     x: 78, y: 32 },
    { key: 'DC',   label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 50, y: 30 },
    { key: 'DS',   label: 'Difensore sinistro', position_hint: 'Terzino sinistro',   x: 22, y: 32 },
    { key: 'AD',   label: 'Attaccante destro',  position_hint: 'Ala destra',         x: 78, y: 78 },
    { key: 'PC',   label: 'Attaccante centrale',position_hint: 'Punta centrale',     x: 50, y: 82 },
    { key: 'AS',   label: 'Attaccante sinistro',position_hint: 'Ala sinistra',       x: 22, y: 78 },
  ],
  // Formati ridotti a 9 (Esordienti): 1 portiere + 8 giocatori
  '3-3-2 (a 9)': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere',           x: 50, y: 8  },
    { key: 'DD',   label: 'Difensore destro',   position_hint: 'Terzino destro',     x: 78, y: 30 },
    { key: 'DC',   label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 50, y: 28 },
    { key: 'DS',   label: 'Difensore sinistro', position_hint: 'Terzino sinistro',   x: 22, y: 30 },
    { key: 'CD',   label: 'Centrocampista dx',  position_hint: 'Esterno destro',     x: 78, y: 58 },
    { key: 'CC',   label: 'Centrocampista',     position_hint: 'Centrocampista centrale', x: 50, y: 55 },
    { key: 'CS',   label: 'Centrocampista sx',  position_hint: 'Esterno sinistro',   x: 22, y: 58 },
    { key: 'PC1',  label: 'Attaccante',         position_hint: 'Punta centrale',     x: 62, y: 85 },
    { key: 'PC2',  label: 'Attaccante',         position_hint: 'Punta centrale',     x: 38, y: 85 },
  ],
  '3-2-3 (a 9)': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere',           x: 50, y: 8  },
    { key: 'DD',   label: 'Difensore destro',   position_hint: 'Terzino destro',     x: 78, y: 30 },
    { key: 'DC',   label: 'Difensore centrale', position_hint: 'Difensore centrale', x: 50, y: 28 },
    { key: 'DS',   label: 'Difensore sinistro', position_hint: 'Terzino sinistro',   x: 22, y: 30 },
    { key: 'CC1',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale', x: 62, y: 55 },
    { key: 'CC2',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale', x: 38, y: 55 },
    { key: 'AD',   label: 'Attaccante destro',  position_hint: 'Ala destra',         x: 78, y: 82 },
    { key: 'PC',   label: 'Attaccante centrale',position_hint: 'Punta centrale',     x: 50, y: 85 },
    { key: 'AS',   label: 'Attaccante sinistro',position_hint: 'Ala sinistra',       x: 22, y: 82 },
  ],
  '2-4-2 (a 9)': [
    { key: 'GK',   label: 'Portiere',           position_hint: 'Portiere',           x: 50, y: 8  },
    { key: 'DC1',  label: 'Difensore',          position_hint: 'Difensore centrale', x: 65, y: 30 },
    { key: 'DC2',  label: 'Difensore',          position_hint: 'Difensore centrale', x: 35, y: 30 },
    { key: 'ED',   label: 'Esterno destro',     position_hint: 'Esterno destro',     x: 85, y: 55 },
    { key: 'CC1',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale', x: 62, y: 55 },
    { key: 'CC2',  label: 'Centrocampista',     position_hint: 'Centrocampista centrale', x: 38, y: 55 },
    { key: 'ES',   label: 'Esterno sinistro',   position_hint: 'Esterno sinistro',   x: 15, y: 55 },
    { key: 'PC1',  label: 'Attaccante',         position_hint: 'Punta centrale',     x: 62, y: 85 },
    { key: 'PC2',  label: 'Attaccante',         position_hint: 'Punta centrale',     x: 38, y: 85 },
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
