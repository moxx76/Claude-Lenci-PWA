/**
 * Classificazione BMI usando la WHO Growth Reference 5-19 anni.
 * Per adulti (>= 19 anni) usa le soglie standard WHO/OMS.
 * Per bambini < 5 anni: attualmente non supportato (le tabelle 0-5 anni non sono
 * incluse; la fascia rilevante per il club parte dai Piccoli Amici a 5-6 anni).
 *
 * Fonte curve: WHO 2007 Reference for School-age Children and Adolescents (5-19 y).
 */

import { BMI_BOYS_5_19, BMI_GIRLS_5_19, MIN_MONTHS, MAX_MONTHS, type BmiRow } from './whoBmiReference'

export type BmiCategory =
  | 'severe_thinness'
  | 'thinness'
  | 'normal'
  | 'overweight'
  | 'obesity'

export interface BmiClassification {
  category: BmiCategory
  /** Etichetta italiana neutra (non allarmistica) */
  label: string
  /** Z-score approssimato (interpolato tra i 7 punti SD della tabella WHO) */
  zScore: number
  /** Riferimento normativo usato: WHO 5-19 anni o adulto */
  reference: 'who-5-19' | 'adult'
  /** Colori tenui per la UI, evitando rosso allarmistico */
  color: string
  bg: string
  border: string
}

/**
 * Calcola l'età in mesi da data di nascita a data valutazione (o oggi).
 * Restituisce null se input non valido.
 */
export function ageInMonths(birthDate: string | null | undefined, at?: Date): number | null {
  if (!birthDate) return null
  const b = new Date(birthDate)
  if (isNaN(b.getTime())) return null
  const d = at ?? new Date()
  const years = d.getFullYear() - b.getFullYear()
  const months = d.getMonth() - b.getMonth()
  let total = years * 12 + months
  // Se il giorno del mese non è ancora arrivato, tolgo un mese
  if (d.getDate() < b.getDate()) total--
  return total < 0 ? null : total
}

/**
 * Interpolazione lineare del BMI di riferimento a una data età (in mesi non intera possibile)
 */
function interpolateRow(rows: BmiRow[], months: number): BmiRow | null {
  if (months < MIN_MONTHS || months > MAX_MONTHS) return null
  // Trova indice più vicino sotto
  const lowerMonths = Math.floor(months)
  const upperMonths = Math.ceil(months)
  const lowerIdx = lowerMonths - MIN_MONTHS
  const upperIdx = upperMonths - MIN_MONTHS
  if (lowerIdx < 0 || upperIdx >= rows.length) return null
  if (lowerIdx === upperIdx) return rows[lowerIdx]
  const t = months - lowerMonths
  const a = rows[lowerIdx]
  const b = rows[upperIdx]
  // Interpolazione lineare valore per valore
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
    a[4] + (b[4] - a[4]) * t,
    a[5] + (b[5] - a[5]) * t,
    a[6] + (b[6] - a[6]) * t,
  ] as BmiRow
}

/**
 * Approssimazione lineare della z-score dai 7 punti SD.
 * Non è la formula LMS esatta ma è accurata al livello di categoria WHO
 * (che è quello che ci serve per uso non clinico).
 */
function approximateZScore(bmi: number, row: BmiRow): number {
  // Punti noti: SD -3, -2, -1, 0, +1, +2, +3 → BMI in row[0..6]
  const sds = [-3, -2, -1, 0, 1, 2, 3]
  // Se sotto il primo o sopra l'ultimo, estrapoliamo dai due punti estremi
  if (bmi <= row[0]) {
    // Estrapolazione oltre -3SD usando pendenza [-3, -2]
    const slope = (sds[1] - sds[0]) / (row[1] - row[0])
    return sds[0] + (bmi - row[0]) * slope
  }
  if (bmi >= row[6]) {
    // Estrapolazione oltre +3SD usando pendenza [+2, +3]
    const slope = (sds[6] - sds[5]) / (row[6] - row[5])
    return sds[6] + (bmi - row[6]) * slope
  }
  // Trova tra quali due punti si trova bmi e interpola linearmente
  for (let i = 0; i < 6; i++) {
    if (bmi >= row[i] && bmi <= row[i + 1]) {
      const t = (bmi - row[i]) / (row[i + 1] - row[i])
      return sds[i] + t * (sds[i + 1] - sds[i])
    }
  }
  return 0 // non dovrebbe mai capitare
}

/**
 * Meta grafica per ciascuna categoria — colori tenui e neutrali,
 * evitando rosso allarmistico su minori
 */
const CATEGORY_META: Record<BmiCategory, { label: string; color: string; bg: string; border: string }> = {
  severe_thinness: { label: 'Magrezza grave',    color: '#7c4700', bg: '#fff4e6', border: '#e6a94a' },
  thinness:        { label: 'Magrezza',          color: '#8e6300', bg: '#fff8ec', border: '#f0c063' },
  normal:          { label: 'Nella norma',       color: '#2e7d32', bg: '#e8f5e9', border: '#a5d6a7' },
  overweight:      { label: 'Sopra la norma',    color: '#8e6300', bg: '#fff8ec', border: '#f0c063' },
  obesity:         { label: 'Molto sopra',       color: '#7c4700', bg: '#fff4e6', border: '#e6a94a' },
}

function categorizeFromZ(z: number): BmiCategory {
  if (z < -3) return 'severe_thinness'
  if (z < -2) return 'thinness'
  if (z <= 1) return 'normal'
  if (z <= 2) return 'overweight'
  return 'obesity'
}

/**
 * Classificazione principale. Se età <= 228 mesi (19 anni) usa WHO Reference,
 * altrimenti fallback alle soglie standard adulto.
 * Se sex null, assume 'M' come default (contesto club maschile).
 * Se età < 61 mesi (< 5 anni) → attualmente ritorna null (non supportato).
 */
export function classifyBMI(
  bmi: number,
  ageMonths: number | null,
  sex: 'M' | 'F' | null | undefined
): BmiClassification | null {
  if (!isFinite(bmi) || bmi <= 0) return null
  if (ageMonths == null) return null

  // Bambini sotto i 5 anni: non supportato (tabelle 0-5 diverse)
  if (ageMonths < MIN_MONTHS) return null

  // Adulti (> 19 anni): fallback a soglie standard OMS
  if (ageMonths > MAX_MONTHS) {
    let cat: BmiCategory
    // Usando soglie coerenti con WHO adulto e allineate al passaggio dolce a 19 anni
    if (bmi < 16)     cat = 'severe_thinness'
    else if (bmi < 18.5) cat = 'thinness'
    else if (bmi < 25)   cat = 'normal'
    else if (bmi < 30)   cat = 'overweight'
    else                 cat = 'obesity'
    const meta = CATEGORY_META[cat]
    return { category: cat, ...meta, zScore: 0, reference: 'adult' }
  }

  const sexKey = sex === 'F' ? 'F' : 'M'
  const rows = sexKey === 'F' ? BMI_GIRLS_5_19 : BMI_BOYS_5_19
  const row = interpolateRow(rows, ageMonths)
  if (!row) return null

  const z = approximateZScore(bmi, row)
  const cat = categorizeFromZ(z)
  const meta = CATEGORY_META[cat]

  return {
    category: cat,
    ...meta,
    zScore: Math.round(z * 100) / 100,
    reference: 'who-5-19',
  }
}
