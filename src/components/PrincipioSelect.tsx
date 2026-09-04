import { useEffect, useState } from 'react'

/**
 * Dropdown per principi/sotto-principi di gioco con opzione "Altro" che rivela
 * un input libero. Il valore salvato è una stringa (una delle opzioni predefinite
 * o il testo libero se è stato scelto "Altro").
 */
interface Props {
  value: string
  onChange: (val: string) => void
  options: string[]
  placeholder?: string
  otherLabel?: string
  otherPlaceholder?: string
}

const OTHER_MARKER = '__ALTRO__'

export function PrincipioSelect({
  value,
  onChange,
  options,
  placeholder = '— Seleziona —',
  otherLabel = 'Altro (specifica…)',
  otherPlaceholder = 'Scrivi qui il principio',
}: Props) {
  // Determina se il valore corrente è un "Altro" (cioè non è vuoto e non è tra le opzioni)
  const initialIsOther = !!value && !options.includes(value)
  const [isOther, setIsOther] = useState(initialIsOther)

  // Se il valore cambia dall'esterno (es. caricamento evento esistente), risincronizza
  useEffect(() => {
    setIsOther(!!value && !options.includes(value))
  }, [value, options])

  const selectValue = isOther ? OTHER_MARKER : (options.includes(value) ? value : '')

  return (
    <div>
      <select
        value={selectValue}
        onChange={e => {
          const v = e.target.value
          if (v === OTHER_MARKER) {
            setIsOther(true)
            // Non svuoto il valore: se prima c'era testo libero lo preservo
            if (options.includes(value)) onChange('')
          } else {
            setIsOther(false)
            onChange(v)
          }
        }}
        style={selectStyle}
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
        <option value={OTHER_MARKER}>➕ {otherLabel}</option>
      </select>

      {isOther && (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={otherPlaceholder}
          autoFocus
          style={{ ...selectStyle, marginTop: 6 }}
        />
      )}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  borderRadius: 8,
  border: '1px solid #c0c7d2',
  fontSize: 12.5,
  background: '#fff',
  color: '#181c20',
  fontFamily: 'inherit',
}

// ============================================================
// Elenchi ufficiali (dalla metodologia dei principi di gioco Lenci)
// ============================================================

export const PRINCIPI_GIOCO: string[] = [
  'COSTRUZIONE - CONQUISTA CAMPO IN AVANTI',
  'COSTRUZIONE - RICERCA AMPIEZZA E PROFONDITÀ',
  'COSTRUZIONE - RICONOSCERE LA SUPERIORITÀ NUMERICA',
  'MANOVRA - RICONOSCERE LA SUPERIORITÀ NUMERICA',
  'MANOVRA - MANTENIMENTO',
  'MANOVRA - RICERCA AMPIEZZA E PROFONDITÀ',
  'MANOVRA - ATTACCO ZONA DEBOLE',
  'MANOVRA - SCAGLIONAMENTO',
  'FINALIZZARE - TRANSIZIONI',
  'FINALIZZARE - ATTACCO VELOCE DELLA PORTA',
  'FINALIZZARE - ATTACCO LATO DEBOLE',
  'SVILUPPO DUELLO FRONTALE',
  'SVILUPPO DUELLO LATERALE',
  'SVILUPPO DUELLO INSEGUIMENTO',
  'SVILUPPO DUELLO DORSALE',
]

export const SOTTO_PRINCIPI_GIOCO: string[] = [
  'UTILIZZO DEL PORTIERE',
  'PRIMO CONTROLLO IN AVANTI',
  'TRASMISSIONE IN DIAGONALE',
  'FORNIRE LINEE DI PASSAGGIO',
  'CONCETTO SOSTEGNO/APPOGGIO',
  'GIOCARE DENTRO/FUORI',
  'GIOCATA AVANTI/DIETRO',
  'RICERCA DEL 3° UOMO',
  'RECUPERO VELOCE DELLA PALLA',
  'SAPER DIFENDERE IN MENO',
  'PUNTARE IN VELOCITÀ - CAMBIO RITMO',
  'PRINCIPI FINTA E DRIBBLING',
  'DIFESA DELLA PALLA',
  'TECNICA DEL DIFENDENTE',
]

// Aspetti condizionali (capacità fisiche generali che si allenano trasversalmente)
export const TAG_CONDIZIONALI: string[] = [
  'FORZA',
  'RESISTENZA',
  'VELOCITÀ',
  'PRONTEZZA DEI RIFLESSI',
  'COORDINAZIONE',
]

// Fondamentali tecnici individuali del calcio
export const TAG_TECNICI: string[] = [
  'COLPIRE LA PALLA',
  'RICEVERE LA PALLA',
  'CONDUZIONE',
  'COLPO DI TESTA',
  'CONTRASTO',
  'RIMESSA LATERALE',
]
