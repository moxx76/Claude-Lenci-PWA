/**
 * PitchView — Mini campo verde SVG con giocatori posizionati sugli slot del modulo.
 * Riutilizzabile in: preview distinta dashboard, DistintaTatticaSheet step 3, Journalist page.
 *
 * Il campo è renderizzato con noi che attacchiamo verso l'alto (portiere in basso).
 * Coordinate slot: x/y da FORMATIONS in scala 0..100.
 * Convenzione: y=0 in fondo (nostra porta), y=100 in alto (area avversaria).
 * In SVG l'origine è top-left, quindi in resa faccio 100 - y per invertire.
 */

import { FORMATIONS } from '../lib/formations'

export interface PitchPlayer {
  slot_key: string
  slot_label: string
  jersey_number: number | null
  last_name: string
  first_name: string
  is_captain?: boolean
  is_vice_captain?: boolean
}

interface Props {
  formation: string
  players: PitchPlayer[]
  /** Ratio del container: default 3:4 (larghezza:altezza), tipico display verticale */
  height?: number
  /** Colore campo (default verde stadio) */
  fieldColor?: string
  /** Colore linee bianche */
  lineColor?: string
  /** Colore casacca giocatori (default rosso Lenci) */
  shirtColor?: string
  /** Se true mostra il nome sotto ogni giocatore (default true) */
  showNames?: boolean
  /** Se true, il campo occupa tutta la larghezza disponibile */
  fullWidth?: boolean
}

const VB_W = 100
const VB_H = 140  // Campo verticale con proporzione realistica

export function PitchView({
  formation,
  players,
  height = 320,
  fieldColor = '#2d7a3e',
  lineColor = 'rgba(255,255,255,0.6)',
  shirtColor = '#b3005c',
  showNames = true,
  fullWidth = true,
}: Props) {
  const template = FORMATIONS[formation]
  if (!template) {
    return (
      <div style={{
        padding: 12, borderRadius: 8, background: '#fff4e5',
        border: '1px solid #e0a800', color: '#8e6300', fontSize: 12,
      }}>
        Modulo "{formation}" non riconosciuto — impossibile disegnare il campo
      </div>
    )
  }

  // Ordino: template come base + player assegnato allo slot corrispondente
  const slotsWithPlayers = template.map(slot => {
    const p = players.find(pl => pl.slot_key === slot.key)
    return { slot, player: p }
  })

  // Converto y (0..100, 0=nostra porta in basso) → SVG y (0..VB_H, 0=alto)
  const yToSvg = (y: number) => (100 - y) * (VB_H / 100)
  const xToSvg = (x: number) => x * (VB_W / 100)

  return (
    <div style={{
      width: fullWidth ? '100%' : 'auto',
      background: fieldColor,
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: 'inset 0 0 30px rgba(0,0,0,0.15)',
      position: 'relative',
    }}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: `${height}px`, display: 'block' }}
      >
        {/* Righe di gioco */}
        <FieldLines lineColor={lineColor} />

        {/* Giocatori */}
        {slotsWithPlayers.map(({ slot, player }, i) => {
          const cx = xToSvg(slot.x)
          const cy = yToSvg(slot.y)
          const isCap = !!player?.is_captain
          const isVice = !!player?.is_vice_captain
          const isGK = slot.key === 'GK'
          return (
            <g key={`${slot.key}-${i}`}>
              {/* Cerchio casacca */}
              <circle
                cx={cx}
                cy={cy}
                r={4.2}
                fill={isGK ? '#f5b800' : shirtColor}
                stroke="#fff"
                strokeWidth={0.5}
              />
              {/* Numero maglia (o "?" se non assegnato) */}
              <text
                x={cx}
                y={cy + 1.3}
                textAnchor="middle"
                fontSize={3.2}
                fontWeight={800}
                fill={player ? '#fff' : 'rgba(255,255,255,0.5)'}
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              >
                {player?.jersey_number ?? (player ? '•' : '?')}
              </text>
              {/* Badge capitano (bordo dorato) */}
              {isCap && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={5.2}
                  fill="none"
                  stroke="#ffd100"
                  strokeWidth={0.8}
                />
              )}
              {/* Badge vice (bordo blu tratteggiato) */}
              {isVice && !isCap && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={5.2}
                  fill="none"
                  stroke="#8ecdff"
                  strokeWidth={0.8}
                  strokeDasharray="1.5,1"
                />
              )}
              {/* Nome sotto */}
              {showNames && player && (
                <text
                  x={cx}
                  y={cy + 8}
                  textAnchor="middle"
                  fontSize={2.6}
                  fontWeight={700}
                  fill="#fff"
                  stroke="rgba(0,0,0,0.4)"
                  strokeWidth={0.15}
                  paintOrder="stroke"
                  style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                >
                  {player.last_name}
                  {(isCap || isVice) && (
                    <tspan fontSize={2.2} fill={isCap ? '#ffd100' : '#8ecdff'}>
                      {' '}({isCap ? 'C' : 'VC'})
                    </tspan>
                  )}
                </text>
              )}
              {showNames && !player && (
                <text
                  x={cx}
                  y={cy + 8}
                  textAnchor="middle"
                  fontSize={2.4}
                  fill="rgba(255,255,255,0.6)"
                  style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                >
                  {slot.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// Linee del campo — semplice e leggibile
function FieldLines({ lineColor }: { lineColor: string }) {
  return (
    <g stroke={lineColor} strokeWidth={0.35} fill="none">
      {/* Cornice */}
      <rect x={2} y={2} width={96} height={136} />
      {/* Metà campo */}
      <line x1={2} y1={70} x2={98} y2={70} />
      {/* Cerchio centrocampo */}
      <circle cx={50} cy={70} r={10} />
      <circle cx={50} cy={70} r={0.6} fill={lineColor} />
      {/* Area di rigore nostra (in basso) */}
      <rect x={22} y={122} width={56} height={16} />
      <rect x={35} y={132} width={30} height={6} />
      {/* Dischetto rigore nostro */}
      <circle cx={50} cy={128} r={0.6} fill={lineColor} />
      {/* Area di rigore avversaria (in alto) */}
      <rect x={22} y={2} width={56} height={16} />
      <rect x={35} y={2} width={30} height={6} />
      <circle cx={50} cy={12} r={0.6} fill={lineColor} />
      {/* Semicerchi delle aree */}
      <path d="M 40 18 A 10 10 0 0 0 60 18" />
      <path d="M 40 122 A 10 10 0 0 1 60 122" />
    </g>
  )
}
