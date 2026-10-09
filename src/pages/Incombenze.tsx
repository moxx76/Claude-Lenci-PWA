import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { Icon } from '../components/Icon'

/**
 * M22 — Scadenziario incombenze estratte dai comunicati LND.
 *
 * I rilievi di tipo scadenze/gare/disciplinare che richiedono un'azione
 * di Lenci sono assegnati di default a Christian Trovato (segreteria).
 * Luca Palermo, Davide Mantovani ed Enzo Paoletti li vedono e possono
 * marcare come fatti (modello cooperativo).
 *
 * Visibilita' pagina: tutti gli admin.
 */

const RESPONSABILI_IDS = [
  '56846ffe-9a77-442e-89b8-0f87087a4091', // Christian Trovato
  'f8a0aca7-75e3-4664-8790-6cb38ca8357a', // Luca Palermo
  '44778585-1e97-4f01-b6cd-eeda12123530', // Davide Mantovani
  'b9830ffa-da57-4b3c-b2c6-439ef2614ec3', // Enzo Paoletti
]

interface Incombenza {
  id: string
  criterio: string
  testo: string
  scadenza: string | null
  stato: 'nuovo' | 'in_corso' | 'fatto' | 'ignorato'
  azione_richiesta: boolean | null
  priorita: number
  assegnato_a: string | null
  assegnato_nome?: string | null
  completato_il: string | null
  completato_da: string | null
  completato_nome?: string | null
  note_lavorazione: string | null
  comunicato_id: string | null
  comunicato_titolo?: string | null
  comunicato_link?: string | null
  creato_il: string
}

type Filter = 'da_fare' | 'da_triare' | 'fatte' | 'tutto'

export function Incombenze() {
  const { profile } = useAuth()
  const [items, setItems] = useState<Incombenza[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('da_fare')

  const load = async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('lnd_rilievi')
      .select(`
        id, criterio, testo, scadenza, stato, azione_richiesta, priorita,
        assegnato_a, completato_il, completato_da, note_lavorazione,
        comunicato_id, creato_il,
        assegnato_profile:profiles!lnd_rilievi_assegnato_a_fkey(full_name),
        completato_profile:profiles!lnd_rilievi_completato_da_fkey(full_name),
        comunicato:lnd_comunicati(titolo, link)
      `)
      .order('scadenza', { ascending: true, nullsFirst: false })
    if (err) { setError(err.message); setLoading(false); return }
    const normalized: Incombenza[] = (data || []).map((r: any) => ({
      ...r,
      assegnato_nome: r.assegnato_profile?.full_name || null,
      completato_nome: r.completato_profile?.full_name || null,
      comunicato_titolo: r.comunicato?.titolo || null,
      comunicato_link: r.comunicato?.link || null,
    }))
    setItems(normalized)
    setLoading(false)
  }

  useEffect(() => { if (profile?.id) load() }, [profile?.id])

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    switch (filter) {
      case 'da_fare':
        return items.filter(it => it.azione_richiesta === true && it.stato !== 'fatto' && it.stato !== 'ignorato' && (!it.scadenza || it.scadenza >= today))
      case 'da_triare':
        return items.filter(it => it.azione_richiesta === null && it.stato !== 'fatto' && (!it.scadenza || it.scadenza >= today))
      case 'fatte':
        return items.filter(it => it.stato === 'fatto' || it.stato === 'ignorato')
      default:
        return items
    }
  }, [items, filter])

  // Metriche in testa
  const counts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const in48h = new Date(Date.now() + 48 * 3600000).toISOString().slice(0, 10)
    let urgenti = 0, totali = 0, scadute = 0, triare = 0
    for (const it of items) {
      if (it.stato === 'fatto' || it.stato === 'ignorato') continue
      if (it.azione_richiesta === null) triare++
      if (it.azione_richiesta === true) {
        if (!it.scadenza) { totali++; continue }
        if (it.scadenza < today) scadute++
        else if (it.scadenza <= in48h) urgenti++
        totali++
      }
    }
    return { totali, urgenti, scadute, triare }
  }, [items])

  const isResponsabile = profile?.id && RESPONSABILI_IDS.includes(profile.id)

  return (
    <div className="max-w-md md:max-w-2xl mx-auto flex flex-col" style={{ padding: '20px 18px', gap: 16 }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg,#8e0048,#b3005c)',
        color: '#fff', borderRadius: 18, padding: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="assignment_late" size={24} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 20, margin: 0 }}>
              Scadenziario
            </h1>
            <p style={{ fontSize: 12.5, opacity: 0.9, margin: '3px 0 0' }}>
              Incombenze estratte dai comunicati LND. Assegnate di default a Christian; chiunque dei responsabili può marcarle fatte.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <StatPill label="Attive" value={counts.totali} />
          {counts.scadute > 0 && <StatPill label="Scadute" value={counts.scadute} tone="danger" />}
          {counts.urgenti > 0 && <StatPill label="Entro 48h" value={counts.urgenti} tone="warn" />}
          {counts.triare > 0 && <StatPill label="Da triare" value={counts.triare} tone="info" />}
        </div>
      </div>

      {!isResponsabile && (
        <div style={{
          background: '#fff4d6', color: '#8e6300',
          padding: 10, borderRadius: 10, fontSize: 11.5,
          display: 'flex', alignItems: 'start', gap: 6,
        }}>
          <Icon name="info" size={14} color="#8e6300" />
          <span>Puoi consultare lo scadenziario ma non sei responsabile. I 4 responsabili sono: Christian Trovato (segreteria), Luca Palermo, Davide Mantovani, Enzo Paoletti.</span>
        </div>
      )}

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
        <FilterChip active={filter === 'da_fare'} onClick={() => setFilter('da_fare')}>
          Da fare ({counts.totali})
        </FilterChip>
        <FilterChip active={filter === 'da_triare'} onClick={() => setFilter('da_triare')}>
          Da triare ({counts.triare})
        </FilterChip>
        <FilterChip active={filter === 'fatte'} onClick={() => setFilter('fatte')}>
          Fatte / Ignorate
        </FilterChip>
        <FilterChip active={filter === 'tutto'} onClick={() => setFilter('tutto')}>
          Tutto
        </FilterChip>
      </div>

      {error && (
        <div style={{ background: '#ffdad6', color: '#93000a', padding: 10, borderRadius: 10, fontSize: 12 }}>{error}</div>
      )}

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#707882', fontSize: 13 }}>Carico incombenze…</div>}

      {!loading && filtered.length === 0 && (
        <div style={{
          background: '#fff', borderRadius: 14, padding: 30, textAlign: 'center',
          boxShadow: '0 6px 16px rgba(0,120,191,0.05)',
        }}>
          <Icon name="task_alt" size={32} color="#006e25" />
          <p style={{ margin: '10px 0 0', fontSize: 13, color: '#707882' }}>Nessuna incombenza in questa vista.</p>
        </div>
      )}

      {!loading && filtered.map(it => <IncombenzaCard key={it.id} item={it} onChanged={load} canEdit={profile?.role === 'admin'} />)}
    </div>
  )
}

// ============================================================
// SUBCOMPONENTS
// ============================================================

function StatPill({ label, value, tone }: { label: string; value: number; tone?: 'danger' | 'warn' | 'info' }) {
  const bg = tone === 'danger' ? 'rgba(255,255,255,0.25)' : tone === 'warn' ? 'rgba(255,209,0,0.3)' : tone === 'info' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.15)'
  return (
    <div style={{
      background: bg, padding: '5px 10px', borderRadius: 8,
      fontSize: 11.5, fontWeight: 800, display: 'flex', gap: 5, alignItems: 'center',
    }}>
      <span style={{ fontSize: 15, fontFamily: 'Anybody' }}>{value}</span>
      <span style={{ opacity: 0.9 }}>{label}</span>
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 12px', borderRadius: 999,
        background: active ? '#005f98' : '#fff',
        color: active ? '#fff' : '#404751',
        border: `1px solid ${active ? '#005f98' : '#c0c7d2'}`,
        fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
        whiteSpace: 'nowrap', fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  )
}

function IncombenzaCard({ item, onChanged, canEdit }: { item: Incombenza; onChanged: () => void; canEdit: boolean }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [expandedNote, setExpandedNote] = useState(false)
  const [noteText, setNoteText] = useState(item.note_lavorazione || '')

  const today = new Date().toISOString().slice(0, 10)
  const scaduta = item.scadenza && item.scadenza < today
  const urgente = item.scadenza && item.scadenza >= today && item.scadenza <= new Date(Date.now() + 48 * 3600000).toISOString().slice(0, 10)

  const giorniRimanenti = item.scadenza
    ? Math.ceil((new Date(item.scadenza).getTime() - new Date(today).getTime()) / 86400000)
    : null

  const colorBordo = item.stato === 'fatto' ? '#006e25'
    : item.stato === 'ignorato' ? '#c0c7d2'
    : scaduta ? '#93000a'
    : urgente ? '#8e6300'
    : item.azione_richiesta === true ? '#005f98'
    : '#c0c7d2'

  const bgCard = item.stato === 'fatto' ? '#f0f9f2'
    : item.stato === 'ignorato' ? '#f6f7fb'
    : '#fff'

  const update = async (patch: Partial<Incombenza>) => {
    setBusy(true); setErr(null)
    const { data, error } = await supabase
      .from('lnd_rilievi')
      .update(patch)
      .eq('id', item.id)
      .select('id')
    setBusy(false)
    if (error || !data || data.length === 0) {
      setErr(error?.message || 'Aggiornamento non riuscito: permessi insufficienti')
      return
    }
    onChanged()
  }

  const markDone = () => update({
    stato: 'fatto',
    completato_il: new Date().toISOString(),
    completato_da: null, // trigger auto-fill? per ora lo lascio al chiamante
    note_lavorazione: noteText.trim() || null,
  } as any)

  const markIgnore = () => update({ stato: 'ignorato', note_lavorazione: noteText.trim() || item.note_lavorazione })
  const markInCorso = () => update({ stato: 'in_corso' })
  const reopenAsNew = () => update({ stato: 'nuovo', completato_il: null, completato_da: null } as any)

  const setAzioneRichiesta = (val: boolean) => update({ azione_richiesta: val })

  return (
    <div style={{
      background: bgCard, borderRadius: 12, padding: 14,
      borderLeft: `4px solid ${colorBordo}`,
      boxShadow: '0 4px 12px rgba(0,120,191,0.04)',
      opacity: item.stato === 'ignorato' ? 0.7 : 1,
    }}>
      {/* Header: scadenza + badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        {item.scadenza ? (
          <div style={{
            background: scaduta ? '#ffdad6' : urgente ? '#ffe8c7' : '#cfe5ff',
            color: scaduta ? '#93000a' : urgente ? '#8e6300' : '#004a78',
            padding: '3px 9px', borderRadius: 999,
            fontSize: 11, fontWeight: 800,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Icon name={scaduta ? 'warning' : 'schedule'} size={11} color={scaduta ? '#93000a' : urgente ? '#8e6300' : '#004a78'} />
            {new Date(item.scadenza).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
            {giorniRimanenti !== null && (
              <span style={{ opacity: 0.75, marginLeft: 2 }}>
                · {giorniRimanenti < 0 ? `scaduta da ${-giorniRimanenti}g` : giorniRimanenti === 0 ? 'oggi' : giorniRimanenti === 1 ? 'domani' : `fra ${giorniRimanenti}g`}
              </span>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: '#707882', fontStyle: 'italic' }}>senza scadenza</div>
        )}
        <CriterioChip criterio={item.criterio} />
        {item.stato === 'fatto' && (
          <div style={{ background: '#dcf5df', color: '#006e25', padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 800 }}>
            FATTO
          </div>
        )}
        {item.stato === 'in_corso' && (
          <div style={{ background: '#fff4d6', color: '#8e6300', padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 800 }}>
            IN CORSO
          </div>
        )}
        {item.azione_richiesta === null && (
          <div style={{ background: '#e8f0f9', color: '#005f98', padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 800 }}>
            DA TRIARE
          </div>
        )}
      </div>

      {/* Testo */}
      <div style={{ fontSize: 12.5, color: '#181c20', lineHeight: 1.45, marginBottom: 8 }}>
        {item.testo}
      </div>

      {/* Assegnatario + comunicato */}
      <div style={{ fontSize: 10.5, color: '#707882', marginBottom: 8, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {item.assegnato_nome && (
          <span>
            <Icon name="person" size={11} color="#707882" style={{ verticalAlign: 'middle', marginRight: 2 }} />
            {item.assegnato_nome}
          </span>
        )}
        {item.completato_nome && item.completato_il && (
          <span style={{ color: '#006e25' }}>
            <Icon name="check_circle" size={11} color="#006e25" style={{ verticalAlign: 'middle', marginRight: 2 }} />
            {item.completato_nome}, {new Date(item.completato_il).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
          </span>
        )}
        {item.comunicato_link && (
          <a href={item.comunicato_link} target="_blank" rel="noopener noreferrer"
            style={{ color: '#005f98', textDecoration: 'none', fontWeight: 700 }}>
            Apri CU PDF →
          </a>
        )}
      </div>

      {item.note_lavorazione && !expandedNote && (
        <div style={{
          background: '#f6f7fb', padding: '6px 10px', borderRadius: 7,
          fontSize: 11, color: '#404751', fontStyle: 'italic', marginBottom: 8,
        }}>
          <strong>Note:</strong> {item.note_lavorazione}
        </div>
      )}

      {err && <div style={{ color: '#93000a', fontSize: 11, marginBottom: 6 }}>{err}</div>}

      {/* Azioni */}
      {canEdit && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {item.azione_richiesta === null && (
            <>
              <button
                onClick={() => setAzioneRichiesta(true)}
                disabled={busy}
                style={{ ...btnPrimary, background: '#005f98' }}
              >
                ✓ Si, azione richiesta
              </button>
              <button
                onClick={() => setAzioneRichiesta(false)}
                disabled={busy}
                style={{ ...btnPrimary, background: '#707882' }}
              >
                No, informativa
              </button>
            </>
          )}
          {item.azione_richiesta === true && item.stato === 'nuovo' && (
            <>
              <button onClick={markInCorso} disabled={busy} style={{ ...btnPrimary, background: '#8e6300' }}>
                In corso
              </button>
              <button onClick={markDone} disabled={busy} style={{ ...btnPrimary, background: '#006e25' }}>
                ✓ Fatto
              </button>
              <button onClick={markIgnore} disabled={busy} style={{ ...btnGhostLocal }}>
                Ignora
              </button>
            </>
          )}
          {item.azione_richiesta === true && item.stato === 'in_corso' && (
            <>
              <button onClick={markDone} disabled={busy} style={{ ...btnPrimary, background: '#006e25' }}>
                ✓ Fatto
              </button>
              <button onClick={markIgnore} disabled={busy} style={{ ...btnGhostLocal }}>
                Ignora
              </button>
            </>
          )}
          {(item.stato === 'fatto' || item.stato === 'ignorato') && (
            <button onClick={reopenAsNew} disabled={busy} style={{ ...btnGhostLocal }}>
              Riapri
            </button>
          )}
          <button onClick={() => setExpandedNote(v => !v)} disabled={busy} style={{ ...btnGhostLocal }}>
            {expandedNote ? 'Chiudi nota' : 'Nota'}
          </button>
        </div>
      )}

      {canEdit && expandedNote && (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Note di lavorazione (es. 'inviato scheda via PEC', 'telefonato a delegazione', ecc.)"
            rows={2}
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #c0c7d2', fontSize: 12, fontFamily: 'inherit' }}
          />
          <button
            onClick={() => update({ note_lavorazione: noteText.trim() || null })}
            disabled={busy}
            style={{ ...btnPrimary, background: '#005f98', marginTop: 6 }}
          >
            Salva nota
          </button>
        </div>
      )}
    </div>
  )
}

function CriterioChip({ criterio }: { criterio: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    scadenze: { bg: '#cfe5ff', color: '#004a78', label: 'SCADENZE' },
    disciplinare: { bg: '#ffdad6', color: '#93000a', label: 'DISCIPLINARE' },
    gare: { bg: '#dcf5df', color: '#006e25', label: 'GARE' },
    societa: { bg: '#f4d4ec', color: '#8e0048', label: 'SOCIETA' },
  }
  const style = map[criterio] || { bg: '#e6e8ee', color: '#404751', label: criterio.toUpperCase() }
  return (
    <span style={{
      background: style.bg, color: style.color,
      padding: '2px 7px', borderRadius: 999,
      fontSize: 9.5, fontWeight: 800, letterSpacing: 0.3,
    }}>{style.label}</span>
  )
}

const btnPrimary: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 7, border: 'none',
  color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
  fontFamily: 'inherit',
}
const btnGhostLocal: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 7,
  background: '#fff', color: '#404751', border: '1px solid #c0c7d2',
  fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
  fontFamily: 'inherit',
}

export default Incombenze
