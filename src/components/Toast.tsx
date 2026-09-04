import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

type ToastKind = 'success' | 'error' | 'info'
interface ToastMsg {
  id: number
  kind: ToastKind
  text: string
}
interface ToastCtx {
  showToast: (text: string, kind?: ToastKind) => void
}

const Ctx = createContext<ToastCtx | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([])

  const showToast = useCallback((text: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, kind, text }])
    // Auto-dismiss dopo 3.2s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3200)
  }, [])

  return (
    <Ctx.Provider value={{ showToast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          pointerEvents: 'none',
          maxWidth: 'calc(100vw - 32px)',
        }}
      >
        {toasts.map(t => (
          <ToastItem key={t.id} msg={t} />
        ))}
      </div>
    </Ctx.Provider>
  )
}

function ToastItem({ msg }: { msg: ToastMsg }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const bg = msg.kind === 'success' ? '#006e25'
    : msg.kind === 'error' ? '#93000a'
      : '#005f98'
  const icon = msg.kind === 'success' ? '✓'
    : msg.kind === 'error' ? '✕'
      : 'ℹ'

  return (
    <div
      style={{
        background: bg,
        color: '#fff',
        padding: '11px 18px 11px 14px',
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 700,
        boxShadow: '0 6px 22px rgba(0,0,0,0.28)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        pointerEvents: 'auto',
        transform: visible ? 'translateY(0)' : 'translateY(-24px)',
        opacity: visible ? 1 : 0,
        transition: 'transform 250ms ease-out, opacity 250ms ease-out',
        maxWidth: 480,
      }}
    >
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 22, height: 22, borderRadius: '50%',
        background: 'rgba(255,255,255,0.22)',
        fontWeight: 900, fontSize: 14, flexShrink: 0,
      }}>
        {icon}
      </span>
      <span style={{ flex: 1 }}>{msg.text}</span>
    </div>
  )
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx)
  if (!ctx) {
    // Fallback silenzioso: se il provider non c'è, no-op
    return { showToast: () => { /* noop */ } }
  }
  return ctx
}
