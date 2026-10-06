import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { Icon } from '../components/Icon'
import { isAdmin } from '../lib/types'

interface Modulo {
  id: string
  name: string
  description: string | null
  category: string | null
  file_path: string
  file_name: string
  size_bytes: number | null
  mime_type: string | null
  sort_order: number
  uploaded_at: string
  uploaded_by: string | null
}

// Moduli di seed caricati automaticamente al primo accesso di un admin se la tabella è vuota.
// I file sono in /public/moduli-seed/ ed esclusi dal precache PWA (vedi vite.config.ts).
const SEED_MODULI: Array<{
  src: string
  file_name: string
  name: string
  description: string
  category: string
  sort_order: number
}> = [
  {
    src: '/moduli-seed/modulo-iscrizione-stag-sport-2025-2026.pdf',
    file_name: 'modulo-iscrizione-stag-sport-2025-2026.pdf',
    name: 'Modulo iscrizione stagione sportiva 2025/2026',
    description: 'Modulo di iscrizione da compilare e firmare dai genitori per il tesseramento del nuovo tesserato',
    category: 'Iscrizioni',
    sort_order: 10,
  },
  {
    src: '/moduli-seed/modulo-richiesta-certificato-plurimo.pdf',
    file_name: 'modulo-richiesta-certificato-plurimo.pdf',
    name: 'Richiesta certificato medico plurimo',
    description: 'Modulo di richiesta del certificato medico sportivo in forma plurima',
    category: 'Iscrizioni',
    sort_order: 20,
  },
  {
    src: '/moduli-seed/modulo-uscita-autonoma.pdf',
    file_name: 'modulo-uscita-autonoma.pdf',
    name: 'Modulo uscita autonoma',
    description: 'Autorizzazione all\'uscita autonoma del minore al termine dell\'attività sportiva',
    category: 'Autorizzazioni',
    sort_order: 30,
  },
  {
    src: '/moduli-seed/modulo-scarico-responsabilita.pdf',
    file_name: 'modulo-scarico-responsabilita.pdf',
    name: 'Modulo di scarico responsabilità',
    description: 'Dichiarazione liberatoria di scarico responsabilità',
    category: 'Autorizzazioni',
    sort_order: 40,
  },
  {
    src: '/moduli-seed/regole-di-comportamento.pdf',
    file_name: 'regole-di-comportamento.pdf',
    name: 'Regole di comportamento',
    description: 'Codice di comportamento ASD Lenci Poirino per famiglie, atleti e staff',
    category: 'Informative',
    sort_order: 50,
  },
  {
    src: '/moduli-seed/brochure-calcio-2026-27.pdf',
    file_name: 'brochure-calcio-2026-27.pdf',
    name: 'Brochure stagione 2026/2027',
    description: 'Brochure di presentazione del settore calcio ASD Lenci Poirino per la stagione 2026/27',
    category: 'Brochure',
    sort_order: 60,
  },
]

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export function Moduli() {
  const { profile } = useAuth()
  const [moduli, setModuli] = useState<Modulo[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const seededRef = useRef(false) // evita doppio-seed in StrictMode

  const canManage = isAdmin(profile?.role)

  const load = async () => {
    const { data, error: err } = await supabase
      .from('moduli')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('uploaded_at', { ascending: false })
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    setModuli((data as Modulo[]) || [])
    setLoading(false)

    // Auto-seed: se admin e tabella vuota, importa automaticamente i 6 moduli iniziali
    if (canManage && profile?.club_id && (data?.length ?? 0) === 0 && !seededRef.current) {
      seededRef.current = true
      await autoSeed()
    }
  }

  const autoSeed = async () => {
    if (!profile?.club_id) return
    setSeeding(true)
    setError(null)
    try {
      for (const seed of SEED_MODULI) {
        // Fetch del PDF dal path statico
        const resp = await fetch(seed.src)
        if (!resp.ok) throw new Error(`Download fallito: ${seed.src}`)
        const blob = await resp.blob()
        const storagePath = `${profile.club_id}/${seed.file_name}`

        // Upload nel bucket Storage
        const { error: upErr } = await supabase.storage
          .from('moduli')
          .upload(storagePath, blob, {
            cacheControl: '3600',
            upsert: true,
            contentType: 'application/pdf',
          })
        if (upErr) throw upErr

        // INSERT nella tabella
        const { error: insErr } = await supabase.from('moduli').insert({
          club_id: profile.club_id,
          name: seed.name,
          description: seed.description,
          category: seed.category,
          file_path: storagePath,
          file_name: seed.file_name,
          size_bytes: blob.size,
          mime_type: 'application/pdf',
          sort_order: seed.sort_order,
          uploaded_by: profile.id,
        })
        if (insErr) throw insErr
      }
      // Ricarica lista
      const { data } = await supabase
        .from('moduli')
        .select('*')
        .order('sort_order', { ascending: true })
      setModuli((data as Modulo[]) || [])
    } catch (e: any) {
      setError('Errore durante l\'importazione iniziale: ' + (e?.message || String(e)))
    } finally {
      setSeeding(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  const handleDownload = async (m: Modulo) => {
    setDownloading(m.id)
    try {
      const { data, error: err } = await supabase.storage
        .from('moduli')
        .createSignedUrl(m.file_path, 60)
      if (err || !data?.signedUrl) throw err || new Error('URL non generato')
      // Avvio download diretto
      const resp = await fetch(data.signedUrl)
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = m.file_name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert('Download fallito: ' + (e?.message || String(e)))
    } finally {
      setDownloading(null)
    }
  }

  const handleUpload = async (file: File) => {
    if (!profile?.club_id) return
    setUploading(true)
    setError(null)
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase()
      const storagePath = `${profile.club_id}/${Date.now()}-${safe}`
      const { error: upErr } = await supabase.storage
        .from('moduli')
        .upload(storagePath, file, { cacheControl: '3600', contentType: file.type || 'application/pdf' })
      if (upErr) throw upErr
      const defaultName = file.name.replace(/\.[^.]+$/, '')
      const { error: insErr } = await supabase.from('moduli').insert({
        club_id: profile.club_id,
        name: defaultName,
        file_path: storagePath,
        file_name: file.name,
        size_bytes: file.size,
        mime_type: file.type || 'application/pdf',
        sort_order: (moduli[moduli.length - 1]?.sort_order ?? 0) + 10,
        uploaded_by: profile.id,
      })
      if (insErr) throw insErr
      await load()
    } catch (e: any) {
      setError('Upload fallito: ' + (e?.message || String(e)))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (m: Modulo) => {
    if (!confirm(`Eliminare "${m.name}"?\n\nL'operazione non può essere annullata.`)) return
    setDeleting(m.id)
    try {
      await supabase.storage.from('moduli').remove([m.file_path])
      await supabase.from('moduli').delete().eq('id', m.id)
      await load()
    } catch (e: any) {
      alert('Eliminazione fallita: ' + (e?.message || String(e)))
    } finally {
      setDeleting(null)
    }
  }

  const categories = Array.from(new Set(moduli.map(m => m.category).filter(Boolean) as string[]))

  return (
    <div className="max-w-md md:max-w-3xl mx-auto flex flex-col" style={{ padding: '20px 18px', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon name="folder" style={{ fontSize: 26, color: '#8b6f47' }} />
        <h2 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 22, color: '#181c20', margin: 0 }}>
          Moduli e documenti
        </h2>
      </div>

      <p style={{ margin: 0, fontSize: 13, color: '#59616c', lineHeight: 1.4 }}>
        Area di gestione per amministratori e dirigenti. Scarica i moduli societari da stampare o inviare alle famiglie.
      </p>

      {error && (
        <div style={{ padding: 12, background: '#ffdad6', border: '1px solid #93000a', color: '#93000a', borderRadius: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      {seeding && (
        <div style={{ padding: 14, background: '#cfe5ff', border: '1px solid #004a78', color: '#004a78', borderRadius: 10, fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 20, height: 20, border: '2px solid #004a78', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <span>Importazione dei moduli iniziali in corso…</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {canManage && !seeding && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,image/png,image/jpeg"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px dashed #005f98',
              background: uploading ? '#f3f6fb' : '#eef5fc',
              color: '#005f98',
              fontWeight: 600,
              cursor: uploading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              justifyContent: 'center',
            }}
          >
            <Icon name="upload_file" style={{ fontSize: 18 }} />
            {uploading ? 'Caricamento…' : 'Carica nuovo modulo'}
          </button>
        </>
      )}

      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#59616c' }}>Caricamento…</div>
      ) : moduli.length === 0 && !seeding ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#59616c', background: '#f5f7fa', borderRadius: 12 }}>
          Nessun modulo presente.
          {canManage && <div style={{ marginTop: 6, fontSize: 12 }}>Usa il bottone qui sopra per caricare il primo.</div>}
        </div>
      ) : (
        categories.map(cat => {
          const items = moduli.filter(m => m.category === cat)
          return (
            <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#8b6f47', textTransform: 'uppercase', letterSpacing: 0.5, margin: '6px 0 0 0' }}>
                {cat}
              </h3>
              {items.map(m => (
                <div
                  key={m.id}
                  style={{
                    background: '#fff',
                    borderRadius: 14,
                    padding: 14,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ fontSize: 32, color: '#c73434', flex: 'none' }}>
                    <Icon name="picture_as_pdf" style={{ fontSize: 32 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#181c20', lineHeight: 1.3 }}>{m.name}</div>
                    {m.description && (
                      <div style={{ fontSize: 12, color: '#59616c', marginTop: 2, lineHeight: 1.35 }}>{m.description}</div>
                    )}
                    <div style={{ fontSize: 11, color: '#8b8f99', marginTop: 4 }}>
                      {formatSize(m.size_bytes)} · {new Date(m.uploaded_at).toLocaleDateString('it-IT')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button
                      onClick={() => handleDownload(m)}
                      disabled={downloading === m.id}
                      aria-label="Scarica"
                      style={{
                        width: 40, height: 40, borderRadius: 10,
                        border: 'none', background: '#005f98', color: '#fff',
                        cursor: downloading === m.id ? 'wait' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Icon name={downloading === m.id ? 'hourglass_empty' : 'download'} style={{ fontSize: 20 }} />
                    </button>
                    {canManage && (
                      <button
                        onClick={() => handleDelete(m)}
                        disabled={deleting === m.id}
                        aria-label="Elimina"
                        style={{
                          width: 40, height: 40, borderRadius: 10,
                          border: '1px solid #ffdad6', background: '#fff', color: '#93000a',
                          cursor: deleting === m.id ? 'wait' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Icon name={deleting === m.id ? 'hourglass_empty' : 'delete_outline'} style={{ fontSize: 18 }} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        })
      )}
    </div>
  )
}
