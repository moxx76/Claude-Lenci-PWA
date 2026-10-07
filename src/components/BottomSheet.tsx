import { useEffect, useId, useRef } from 'react'
import { Icon } from './Icon'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  maxHeight?: string
}

// A12: counter globale di sheet aperti per gestire correttamente il lock dello
// scroll body quando più sheet sono stackati (chiusura di uno interno non deve
// riabilitare lo scroll se un altro è ancora aperto).
let openSheetCount = 0

/**
 * Bottom sheet mobile-first.
 * - Su mobile appare dal basso, con handle drag stile iOS
 * - Su desktop diventa un modal centrato
 * - ESC per chiudere
 * - Click sul backdrop per chiudere
 * - A12: semantica aria dialog modale con focus trap minimale (focus iniziale
 *   sul primo focusable, ritorno al trigger alla chiusura, Tab wrap)
 */
export function BottomSheet({ open, onClose, title, children, maxHeight = '85vh' }: BottomSheetProps) {
  const titleId = useId()
  const sheetRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previousFocusRef.current = document.activeElement as HTMLElement | null

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      // Focus trap: wrap Tab/Shift+Tab dentro il sheet
      if (e.key === 'Tab' && sheetRef.current) {
        const focusables = sheetRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', handler)

    openSheetCount += 1
    if (openSheetCount === 1) document.body.style.overflow = 'hidden'

    // Focus iniziale sul primo focusable (microtask per lasciare che il DOM
    // sia renderizzato)
    const focusTimer = window.setTimeout(() => {
      const el = sheetRef.current?.querySelector<HTMLElement>(
        'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])'
      )
      el?.focus()
    }, 50)

    return () => {
      window.removeEventListener('keydown', handler)
      window.clearTimeout(focusTimer)
      openSheetCount = Math.max(0, openSheetCount - 1)
      if (openSheetCount === 0) document.body.style.overflow = ''
      previousFocusRef.current?.focus()
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
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        data-bottom-sheet="open"
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
              id={titleId}
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
