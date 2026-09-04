import type { CSSProperties } from 'react'

interface LogoProps {
  size?: number
  showWordmark?: boolean
  variant?: 'default' | 'framed' | 'plain'
  className?: string
  style?: CSSProperties
}

/**
 * Logo ufficiale ASD Lenci Poirino (5 omini colorati)
 *
 * - default: rounded circle bianco con logo dentro
 * - framed: box white con ombra
 * - plain: solo l'immagine, no background
 */
export function Logo({
  size = 34,
  showWordmark = false,
  variant = 'default',
  className = '',
  style,
}: LogoProps) {
  const baseStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: variant === 'plain' ? 0 : '50%',
    background: variant === 'plain' ? 'transparent' : '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
    boxShadow:
      variant === 'framed'
        ? '0 4px 12px rgba(0,95,152,0.15)'
        : 'none',
    padding: variant === 'plain' ? 0 : Math.max(2, size * 0.05),
    ...style,
  }

  if (showWordmark) {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <div style={baseStyle}>
          <img
            src="/logo.png"
            alt="Lenci LAB · ASD Lenci Poirino"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span
            style={{
              fontFamily: 'Anybody',
              fontWeight: 800,
              fontSize: 16,
              color: '#005f98',
              letterSpacing: '-0.005em',
            }}
          >
            Lenci LAB
          </span>
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              color: '#707882',
              letterSpacing: 0.4,
              marginTop: 3,
              textTransform: 'uppercase',
            }}
          >
            ASD Lenci Poirino
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={className} style={baseStyle}>
      <img
        src="/logo.png"
        alt="Lenci LAB · ASD Lenci Poirino"
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>
  )
}
