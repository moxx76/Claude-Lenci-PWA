import { useEffect, useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import {
  buildWeekendPlannerPng,
  downloadBlob,
  shareOrDownload,
  type WeekendPlannerData,
} from '../lib/weekendPlannerBuilder'

interface Props {
  open: boolean
  onClose: () => void
  data: WeekendPlannerData | null
}

/**
 * Sheet di anteprima del planner weekend PNG.
 * Genera l'immagine on-open, poi permette Condividi (Web Share API su mobile)
 * o Scarica (fallback desktop).
 */
export function WeekendPlannerSheet({ open, onClose, data }: Props) {
  const [blob, setBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !data) {
      setBlob(null)
      setPreviewUrl(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    buildWeekendPlannerPng(data)
      .then(b => {
        if (cancelled) return
        setBlob(b)
        setPreviewUrl(URL.createObjectURL(b))
      })
      .catch(e => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [open, data])

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [previewUrl])

  const filename = data
    ? `Planner_Weekend_${data.saturdayISO}${data.teamFilterName ? '_' + data.teamFilterName.replace(/\s+/g, '') : ''}.png`
    : 'planner_weekend.png'

  const shareTitle = data
    ? `Planner Weekend${data.teamFilterName ? ' ' + data.teamFilterName : ''} · ${data.saturdayISO} / ${data.sundayISO}`
    : 'Planner Weekend'

  return (
    <BottomSheet open={open} onClose={onClose} title="Planner Weekend">
      <div style={{ padding: '10px 14px 24px' }}>
        {loading && (
          <div style={{ padding: 50, textAlign: 'center', color: '#707882', fontSize: 13 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🎨</div>
            Genero il planner…
          </div>
        )}

        {error && (
          <div style={{
            padding: 12, background: '#ffe4e4', color: '#7a0000',
            borderRadius: 8, fontSize: 12, fontWeight: 600,
          }}>
            ⚠ Errore: {error}
          </div>
        )}

        {!loading && !error && previewUrl && data && (
          <>
            <div style={{ fontSize: 11.5, color: '#707882', marginBottom: 8, textAlign: 'center', lineHeight: 1.4 }}>
              Formato 9:16 · perfetto per WhatsApp Status, Instagram e gruppo staff
            </div>

            {/* Preview immagine */}
            <div style={{
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              marginBottom: 14,
              background: '#000',
              maxHeight: '55vh',
              display: 'flex',
              justifyContent: 'center',
            }}>
              <img
                src={previewUrl}
                alt="Anteprima planner weekend"
                style={{ maxWidth: '100%', maxHeight: '55vh', display: 'block', objectFit: 'contain' }}
              />
            </div>

            {/* Riepilogo veloce numeri */}
            <div style={{
              display: 'flex', gap: 12, marginBottom: 14, justifyContent: 'center',
              fontSize: 11.5, color: '#404751', fontWeight: 700,
            }}>
              <span>{data.events.filter(e => e.date === data.saturdayISO).length} sabato</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{data.events.filter(e => e.date === data.sundayISO).length} domenica</span>
              {data.teamFilterName && (
                <>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span style={{ color: '#005f98' }}>{data.teamFilterName}</span>
                </>
              )}
            </div>

            {/* Azioni */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <button
                onClick={() => blob && shareOrDownload(blob, filename, shareTitle)}
                style={{
                  padding: '13px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                  color: '#fff', border: 'none',
                  fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 5px 12px rgba(37,211,102,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontFamily: 'inherit',
                }}
              >
                <Icon name="share" size={16} color="#fff" />
                Condividi
              </button>
              <button
                onClick={() => blob && downloadBlob(blob, filename)}
                style={{
                  padding: '13px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #7a0071 0%, #a71a9a 100%)',
                  color: '#fff', border: 'none',
                  fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 5px 12px rgba(122,0,113,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontFamily: 'inherit',
                }}
              >
                <Icon name="download" size={16} color="#fff" />
                Scarica PNG
              </button>
            </div>

            <div style={{
              padding: '8px 10px', background: '#f0f7ff', borderRadius: 8,
              fontSize: 11, color: '#004a78', lineHeight: 1.45, marginTop: 4,
            }}>
              💡 <strong>Condividi</strong> apre il selettore nativo (WhatsApp, Instagram, ecc.) su mobile. Su desktop scarica direttamente.
            </div>

            <button
              onClick={onClose}
              style={{
                width: '100%', marginTop: 12, padding: '11px',
                borderRadius: 10, background: '#fff', border: '1px solid #c0c7d2',
                color: '#404751', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Chiudi
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
