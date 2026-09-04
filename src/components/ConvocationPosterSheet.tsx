import { useEffect, useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import {
  generateConvocationPoster,
  shareOrDownload,
  downloadBlob,
  type ConvocationPosterData,
} from '../lib/convocationPoster'

interface Props {
  open: boolean
  onClose: () => void
  data: ConvocationPosterData | null
}

export function ConvocationPosterSheet({ open, onClose, data }: Props) {
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
    generateConvocationPoster(data)
      .then(b => {
        if (cancelled) return
        setBlob(b)
        setPreviewUrl(URL.createObjectURL(b))
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [open, data])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const buildFilename = () => {
    if (!data) return 'convocazione.png'
    const dd = new Date(data.matchDate)
    const dateStr = isNaN(dd.getTime())
      ? 'match'
      : `${String(dd.getDate()).padStart(2, '0')}-${String(dd.getMonth() + 1).padStart(2, '0')}`
    const team = data.teamName.replace(/\s+/g, '')
    const opp = data.opponent.replace(/[^\w]/g, '').slice(0, 15)
    return `Convocazione_${team}_vs_${opp}_${dateStr}.png`
  }

  const handleShare = async () => {
    if (!blob) return
    await shareOrDownload(blob, buildFilename(), `Convocazioni ${data?.teamName || ''}`)
  }

  const handleDownload = () => {
    if (!blob) return
    downloadBlob(blob, buildFilename())
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Locandina convocazione">
      <div style={{ padding: '10px 14px 24px' }}>
        {loading && (
          <div style={{ padding: 50, textAlign: 'center', color: '#707882', fontSize: 13 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🎨</div>
            Genero la locandina…
          </div>
        )}

        {error && (
          <div
            style={{
              padding: 12,
              background: '#ffe4e4',
              color: '#7a0000',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            ⚠ Errore: {error}
          </div>
        )}

        {!loading && !error && previewUrl && (
          <>
            <div style={{ fontSize: 11.5, color: '#707882', marginBottom: 8, textAlign: 'center', lineHeight: 1.4 }}>
              Formato 4:5 · ottimo per WhatsApp Status, Instagram e Facebook
            </div>

            {/* Preview */}
            <div
              style={{
                borderRadius: 12,
                overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                marginBottom: 14,
                background: '#000',
              }}
            >
              <img
                src={previewUrl}
                alt="Anteprima convocazione"
                style={{ width: '100%', display: 'block' }}
              />
            </div>

            {/* Azioni */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <button
                onClick={handleShare}
                style={{
                  padding: '13px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                  color: '#fff',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 5px 12px rgba(37,211,102,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontFamily: 'inherit',
                }}
              >
                <Icon name="share" size={16} color="#fff" />
                Condividi
              </button>
              <button
                onClick={handleDownload}
                style={{
                  padding: '13px',
                  borderRadius: 12,
                  background: '#005f98',
                  color: '#fff',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 5px 12px rgba(0,95,152,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontFamily: 'inherit',
                }}
              >
                <Icon name="download" size={16} color="#fff" />
                Scarica PNG
              </button>
            </div>

            <div
              style={{
                padding: '8px 10px',
                background: '#f0f7ff',
                borderRadius: 8,
                fontSize: 11,
                color: '#004a78',
                lineHeight: 1.45,
                marginTop: 4,
              }}
            >
              💡 <strong>Condividi</strong> apre il selettore nativo (WhatsApp, Instagram, ecc.) su mobile. Su desktop scarica il file direttamente.
            </div>

            <button
              onClick={onClose}
              style={{
                width: '100%',
                marginTop: 12,
                padding: '11px',
                borderRadius: 10,
                background: '#fff',
                border: '1px solid #c0c7d2',
                color: '#404751',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
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
