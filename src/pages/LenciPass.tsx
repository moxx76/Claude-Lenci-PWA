/**
 * Pagina pubblica Lenci Pass — elenco dei titolari del pass che dà diritto
 * all'ingresso gratuito alle partite casalinghe della Lenci Poirino.
 *
 * URL: /pass  (fuori da ProtectedRoute, consultabile anche senza login
 * — serve al varco per verificare al volo chi è in lista).
 *
 * Dati: tabella public.lenci_pass_holders (M31) in sola lettura con RLS
 * pubblica. L'ordinamento è per cognome ASC, mostriamo solo i record
 * con enabled=true (sospesi non compaiono ma restano nel DB).
 */

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface PassHolder {
  id: string
  first_name: string
  last_name: string
  note: string | null
  issued_at: string
}

export function LenciPass() {
  const [holders, setHolders] = useState<PassHolder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data, error: err } = await supabase
          .from('lenci_pass_holders')
          .select('id, first_name, last_name, note, issued_at')
          .eq('enabled', true)
          .order('last_name', { ascending: true })
        if (err) throw err
        if (alive) setHolders((data ?? []) as PassHolder[])
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  // Palette Lenci (bordeaux + nero) coerente col resto dell'app
  const brand = '#b3005c'
  const brandDark = '#7a003f'

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${brandDark} 0%, ${brand} 100%)`,
      padding: '24px 16px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        maxWidth: 520, width: '100%', textAlign: 'center',
        color: '#fff', marginBottom: 20,
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 999,
          background: 'rgba(255,255,255,0.18)',
          fontSize: 10, fontWeight: 800, letterSpacing: 2,
          textTransform: 'uppercase',
        }}>
          ASD Lenci Poirino
        </div>
        <h1 style={{
          margin: '14px 0 6px',
          fontSize: 36, fontWeight: 900, letterSpacing: -0.5,
          fontFamily: 'Anybody, system-ui, sans-serif',
          textShadow: '0 1px 2px rgba(0,0,0,0.15)',
        }}>
          🎟️ Lenci Pass
        </h1>
        <div style={{ fontSize: 14, opacity: 0.95, lineHeight: 1.5, padding: '0 10px' }}>
          Titolari del pass con <strong>ingresso gratuito</strong> a tutte le
          partite casalinghe della Lenci Poirino.
        </div>
      </div>

      {/* Card lista */}
      <div style={{
        maxWidth: 520, width: '100%',
        background: '#fff', borderRadius: 16,
        boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 18px',
          background: '#f8f9fc', borderBottom: '1px solid #e6e8ee',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 800, letterSpacing: 1,
            textTransform: 'uppercase', color: '#5c6773',
          }}>
            Elenco titolari
          </div>
          {!loading && !error && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 10px', borderRadius: 999,
              background: brand, color: '#fff',
              fontSize: 11, fontWeight: 800,
            }}>
              {holders.length} {holders.length === 1 ? 'persona' : 'persone'}
            </div>
          )}
        </div>

        {loading && (
          <div style={{ padding: 36, textAlign: 'center', color: '#707882', fontSize: 13 }}>
            Caricamento…
          </div>
        )}

        {error && (
          <div style={{ padding: 20, background: '#ffe4e4', color: '#7a0000', fontSize: 13 }}>
            ⚠ Errore nel caricamento: {error}
          </div>
        )}

        {!loading && !error && holders.length === 0 && (
          <div style={{ padding: 36, textAlign: 'center', color: '#707882', fontSize: 13 }}>
            Nessun titolare registrato.
          </div>
        )}

        {!loading && !error && holders.length > 0 && (
          <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {holders.map((h, idx) => {
              const initials = `${h.first_name[0] ?? ''}${h.last_name[0] ?? ''}`.toUpperCase()
              return (
                <li key={h.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 18px',
                  borderBottom: idx < holders.length - 1 ? '1px solid #f1f3fa' : 'none',
                }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${brand}, ${brandDark})`,
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 900, fontSize: 15, flexShrink: 0,
                    boxShadow: '0 2px 6px rgba(179,0,92,0.3)',
                  }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#181c20' }}>
                      {h.last_name} {h.first_name}
                    </div>
                    {h.note && (
                      <div style={{ fontSize: 11.5, color: '#707882', marginTop: 2 }}>
                        {h.note}
                      </div>
                    )}
                  </div>
                  <div style={{
                    padding: '3px 10px', borderRadius: 6,
                    background: 'rgba(0,110,37,0.1)',
                    color: '#006e25', fontSize: 10.5, fontWeight: 800,
                    letterSpacing: 0.5, textTransform: 'uppercase',
                  }}>
                    ✓ Attivo
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      {/* Footer */}
      <div style={{
        maxWidth: 520, width: '100%',
        marginTop: 18, padding: '12px 16px',
        background: 'rgba(255,255,255,0.1)', borderRadius: 10,
        color: '#fff', fontSize: 11.5, lineHeight: 1.5, textAlign: 'center',
      }}>
        Il pass è nominale: va mostrato un documento d'identità al varco
        per la verifica contro l'elenco qui sopra. Per segnalazioni o
        aggiunte scrivere alla segreteria.
      </div>
    </div>
  )
}
