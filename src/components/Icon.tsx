import type { CSSProperties } from 'react'

interface IconProps {
  name: string
  size?: number | string
  color?: string
  className?: string
  style?: CSSProperties
  filled?: boolean
}

export function Icon({ name, size = 20, color, className = '', style, filled }: IconProps) {
  const finalStyle: CSSProperties = {
    fontSize: typeof size === 'number' ? `${size}px` : size,
    color,
    fontVariationSettings: filled ? "'FILL' 1" : undefined,
    ...style,
  }
  return (
    <span className={`msi ${className}`} style={finalStyle}>
      {name}
    </span>
  )
}
