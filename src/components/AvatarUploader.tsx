import { useRef, useState } from 'react'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'
import { avatarBg } from '../lib/utils'

interface Props {
  currentUrl: string | null | undefined
  displayName: string        // Per iniziali e alt-text
  entityKind: 'player' | 'staff'
  entityId: string           // Player.id o Profile.id (per naming file)
  size?: number              // Dimensione avatar (default 80)
  onUploaded: (url: string) => void
  onRemoved?: () => void
}

export function AvatarUploader({
  currentUrl, displayName, entityKind, entityId, size = 80, onUploaded, onRemoved,
}: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initials = displayName.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  const bg = avatarBg(displayName)

  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const handleSelectGallery = () => galleryRef.current?.click()
  const handleSelectCamera = () => cameraRef.current?.click()

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    // Validazione base
    if (!file.type.startsWith('image/')) {
      setError('Seleziona una immagine (JPG, PNG, WebP)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Immagine troppo grande (max 5 MB)')
      return
    }

    setUploading(true)
    try {
      // Compress/resize lato client per non caricare 20MB da fotocamera
      const compressed = await compressImage(file, 600)

      // Path: <kind>/<id>/<timestamp>.<ext>
      const ext = 'jpg' // dopo compress è sempre jpeg
      const path = `${entityKind}/${entityId}/${Date.now()}.${ext}`

      const { error: upErr } = await supabase.storage.from('avatars')
        .upload(path, compressed, {
          contentType: 'image/jpeg',
          upsert: true, cacheControl: '3600',
        })
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)

      // Elimino eventuali vecchi file dell'entità (mantengo solo l'ultimo)
      const { data: existingList } = await supabase.storage.from('avatars').list(`${entityKind}/${entityId}`)
      if (existingList && existingList.length > 0) {
        const toRemove = existingList
          .filter(f => !path.endsWith(f.name))
          .map(f => `${entityKind}/${entityId}/${f.name}`)
        if (toRemove.length > 0) {
          await supabase.storage.from('avatars').remove(toRemove)
        }
      }

      onUploaded(publicUrl)
    } catch (e: any) {
      console.error('avatar upload err:', e)
      setError('Errore upload: ' + (e.message || 'sconosciuto'))
    } finally {
      setUploading(false)
      if (galleryRef.current) galleryRef.current.value = ''
      if (cameraRef.current) cameraRef.current.value = ''
    }
  }

  const handleRemove = async () => {
    if (!currentUrl || !onRemoved) return
    if (!confirm('Rimuovere la foto?')) return
    setUploading(true)
    try {
      const { data: existingList } = await supabase.storage.from('avatars').list(`${entityKind}/${entityId}`)
      if (existingList && existingList.length > 0) {
        const paths = existingList.map(f => `${entityKind}/${entityId}/${f.name}`)
        await supabase.storage.from('avatars').remove(paths)
      }
      onRemoved()
    } catch (e: any) {
      setError('Errore rimozione: ' + (e.message || ''))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: size, height: size, borderRadius: size / 2,
        background: currentUrl ? '#fff' : bg,
        border: '2px solid #d5dae2',
        overflow: 'hidden', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {currentUrl ? (
          <img src={currentUrl} alt={displayName}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{
            color: '#fff', fontFamily: 'Anybody', fontWeight: 800,
            fontSize: size * 0.35,
          }}>{initials || '?'}</span>
        )}
        {uploading && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 24, height: 24, border: '3px solid #fff',
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={handleSelectGallery} disabled={uploading}
          style={{
            padding: '6px 10px', borderRadius: 999,
            background: '#005f98', color: '#fff', border: 'none',
            fontSize: 10.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
          <Icon name="photo_library" size={12} color="#fff" />
          {currentUrl ? 'Cambia da galleria' : 'Da galleria'}
        </button>
        <button onClick={handleSelectCamera} disabled={uploading}
          style={{
            padding: '6px 10px', borderRadius: 999,
            background: '#fff', color: '#005f98', border: '1px solid #005f98',
            fontSize: 10.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
          <Icon name="photo_camera" size={12} color="#005f98" />
          Scatta foto
        </button>
        {currentUrl && onRemoved && (
          <button onClick={handleRemove} disabled={uploading}
            title="Rimuovi foto"
            style={{
              padding: '6px 8px', borderRadius: 999,
              background: '#fff', color: '#c62828', border: '1px solid #ffcdd2',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center',
            }}>
            <Icon name="delete" size={12} color="#c62828" />
          </button>
        )}
      </div>

      {error && (
        <div style={{ fontSize: 10, color: '#c62828', textAlign: 'center', maxWidth: 200 }}>{error}</div>
      )}

      {/* Input nascosto per selezione da galleria (senza capture = mostra file picker) */}
      <input ref={galleryRef} type="file" accept="image/*"
        onChange={handleFile} style={{ display: 'none' }} />
      {/* Input nascosto per fotocamera (capture apre direttamente la camera) */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment"
        onChange={handleFile} style={{ display: 'none' }} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// Riduce e comprime immagine lato client (max lato + JPEG quality)
async function compressImage(file: File, maxSize: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let w = img.width, h = img.height
      if (w > h && w > maxSize) { h = h * (maxSize / w); w = maxSize }
      else if (h >= w && h > maxSize) { w = w * (maxSize / h); h = maxSize }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas ctx')); return }
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(blob => {
        if (!blob) reject(new Error('toBlob null'))
        else resolve(blob)
      }, 'image/jpeg', 0.85)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load')) }
    img.src = url
  })
}
