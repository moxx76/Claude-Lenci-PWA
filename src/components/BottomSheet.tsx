import { useEffect } from 'react'
import { Icon } from './Icon'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  maxHeight?: string
}

/**
 * Bottom sheet mobile-first.
 * - Su mobile appare dal basso, con handle drag stile iOS
 * - Su desktop diventa un modal centrato
 * - ESC per chiudere
 * - Click sul backdrop per chiudere
 */
export function BottomSheet({ open, onClose, title, children, maxHeight = '85vh' }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    // Blocca lo scroll body
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(24,28,32,0.45)',
          zIndex: 60,
          animation: 'lenciFadeIn 0.2s ease',
        }}
      />

      {/* Sheet */}
      <div
        onClick={e => e.stopPropagation()}
        className="lenci-bottom-sheet"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderRadius: '22px 22px 0 0',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.25)',
          zIndex: 70,
          maxHeight,
          display: 'flex',
          flexDirection: 'column',
          animation: 'lenciSlideUp 0.3s cubic-bezier(0.2, 0.9, 0.3, 1)',
        }}
      >
        {/* Handle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '10px 0 6px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              background: '#c0c7d2',
            }}
          />
        </div>

        {/* Header */}
        {title && (
          <div
            style={{
              padding: '4px 20px 12px',
              borderBottom: '1px solid #e6e8ee',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontFamily: 'Anybody',
                fontWeight: 800,
                fontSize: 17,
                color: '#181c20',
              }}
            >
              {title}
            </h3>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                borderRadius: '50%',
                display: 'flex',
              }}
              aria-label="Chiudi"
            >
              <Icon name="close" size={22} color="#707882" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="lenci-scroll" style={{ overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </>
  )
}
