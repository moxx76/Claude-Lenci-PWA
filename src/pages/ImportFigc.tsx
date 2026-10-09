import { useCallback, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { Icon } from '../components/Icon'
import { parseFigcPdf, type FigcDocument } from '../lib/figcParser'
import { reconcileAll, type MatchDecision, type MatchStatus, type PlayerLite, type ReconcileReport } from '../lib/figcMatcher'

/**
 * M23 — Importazione massiva tesserati FIGC da PDF.
 *
 * Flusso:
 *   1. Admin trascina il PDF del tabulato FIGC → parse lato client
 *   2. Query candidati Supabase (players attivi) → matching deterministico
 *   3. Preview tabellare con stati READY_TO_UPDATE / UNCHANGED / NOT_FOUND /
 *      AMBIGUOUS / CONFLICT / PARSE_ERROR / EXCLUDED (filtri sopra)
 *   4. (Step 5 — non ancora attivo) Approvazione + apply RPC transazionale
 *
 * Dry-run only in questa versione: zero scritture su players.
 * Visibilità: solo admin.
 */

const STATUS_LABELS: Record<MatchStatus, string> = {
  ready_to_update: 'Pronto per aggiornare',
  unchanged: 'Già allineato',
  not_found: 'Non trovato',
  ambiguous: 'Ambiguo',
  conflict: 'Conflitto',
  parse_error: 'Errore parsing',
}

const STATUS_COLORS: Record<MatchStatus, { bg: string; fg: string }> = {
  ready_to_update: { bg: '#cfe5ff', fg: '#004a78' },
  unchanged:       { bg: '#e5e7eb', fg: '#4b5563' },
  not_found:       { bg: '#ffe8c7', fg: '#7a4a00' },
  ambiguous:       { bg: '#fff4a3', fg: '#6b5600' },
  conflict:        { bg: '#ffdad6', fg: '#93000a' },
  parse_error:     { bg: '#ffdad6', fg: '#93000a' },
}

type Filter = 'all' | MatchStatus

export function ImportFigc() {
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [doc, setDoc] = useState<FigcDocument | null>(null)
  const [report, setReport] = useState<ReconcileReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileSize, setFileSize] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  // Verifica admin role (lato client; RLS fa comunque da gate server-side)
  useMemo(() => {
    (async () => {
      if (!user) { setIsAdmin(false); return }
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      setIsAdmin(data?.role === 'admin')
    })()
  }, [user])

  const processFile = useCallback(async (file: File) => {
    setError(null); setDoc(null); setReport(null); setLoading(true)
    setFileName(file.name); setFileSize(file.size)
    try {
      if (!/\.pdf$/i.test(file.name)) throw new Error('Il file deve essere un PDF.')
      if (file.size > 20 * 1024 * 1024) throw new Error('PDF troppo grande (max 20 MB).')
      const buf = await file.arrayBuffer()
      const parsed = await parseFigcPdf(buf)
      if (parsed.players.length === 0) throw new Error('Nessun giocatore riconosciuto nel PDF.')

      // Carico candidati: solo players (eviterei quelli archiviati se esistesse flag).
      // 207 righe → una query sola, dati minimi.
      const { data: players, error: pErr } = await supabase
        .from('players')
        .select(`id, team_id, first_name, last_name, birth_date, fiscal_code, card_number,
                 figc_season, figc_discipline, figc_registered_at, figc_expiry_year,
                 figc_registration_type_code, figc_registration_type_label, figc_club_id`)
      if (pErr) throw pErr

      const rep = reconcileAll(parsed.players, (players || []) as PlayerLite[], {
        season: parsed.season,
        figc_club_id: parsed.figc_club_id,
      })
      setDoc(parsed)
      setReport(rep)
    } catch (e: any) {
      setError(e?.message || 'Errore sconosciuto durante il parsing.')
    } finally {
      setLoading(false)
    }
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) processFile(f)
  }, [processFile])

  const filtered = useMemo(() => {
    if (!report) return []
    if (filter === 'all') return report.decisions
    return report.decisions.filter(d => d.status === filter)
  }, [report, filter])

  if (isAdmin === null) return <div style={{ padding: 24, textAlign: 'center', color: '#707882' }}>Caricamento…</div>
  if (!isAdmin) return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <Icon name="lock" size={48} color="#b3005c" />
      <div style={{ marginTop: 12, fontWeight: 700 }}>Area riservata agli amministratori</div>
    </div>
  )

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '16px 14px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'linear-gradient(135deg, #b3005c, #7a003e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="upload_file" size={22} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#181c20' }}>Import tesserati FIGC</div>
          <div style={{ fontSize: 12, color: '#707882' }}>Carica il tabulato PDF del club per aggiornare in blocco le anagrafiche federali.</div>
        </div>
      </div>

      {/* Upload area */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: dragging ? '2px dashed #b3005c' : '2px dashed #d4dae3',
          background: dragging ? '#ffeaf4' : '#fafbfc',
          borderRadius: 12, padding: 24, textAlign: 'center',
          cursor: 'pointer', transition: 'all 150ms',
          marginBottom: 14,
        }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }}
        />
        <Icon name="cloud_upload" size={36} color={dragging ? '#b3005c' : '#99a1ab'} />
        <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: '#181c20' }}>
          Trascina qui il PDF, o tocca per selezionarlo
        </div>
        <div style={{ marginTop: 4, fontSize: 11, color: '#707882' }}>
          Tabulato Calciatori FIGC — massimo 20 MB
        </div>
        {fileName && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#4b5563' }}>
            <Icon name="description" size={14} /> {fileName} ({fileSize ? (fileSize / 1024).toFixed(1) : '?'} KB)
          </div>
        )}
      </div>

      {loading && (
        <div style={{ padding: 24, textAlign: 'center', color: '#707882' }}>
          <div style={{ fontSize: 14 }}>Analisi del PDF in corso…</div>
        </div>
      )}

      {error && (
        <div style={{
          padding: 12, background: '#ffdad6', color: '#93000a',
          borderRadius: 8, fontSize: 13, marginBottom: 14,
        }}>
          <Icon name="error" size={16} /> {error}
        </div>
      )}

      {doc && report && (
        <>
          {/* Riepilogo metadati */}
          <div style={{
            background: '#fff', borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            padding: '12px 14px', marginBottom: 14,
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10,
          }}>
            <Meta label="Stagione" value={doc.season} />
            <Meta label="Club FIGC" value={doc.figc_club_id ? `${doc.figc_club_id}` : '—'} />
            <Meta label="Giocatori nel PDF" value={doc.players.length} />
            <Meta label="Pagine" value={doc.stats.pages} />
            <Meta label="Parser" value={doc.parser_version} />
          </div>

          {doc.warnings.length > 0 && (
            <div style={{
              padding: 10, background: '#fff4a3', color: '#6b5600',
              borderRadius: 8, fontSize: 12, marginBottom: 10,
            }}>
              <Icon name="warning" size={14} /> {doc.warnings.length} avviso/i di parsing:
              <ul style={{ margin: '4px 0 0 20px', padding: 0, fontSize: 11 }}>
                {doc.warnings.slice(0, 5).map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {/* Contatori + filtri */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            <FilterChip label={`Tutti ${report.decisions.length}`} active={filter === 'all'} onClick={() => setFilter('all')} />
            {(Object.keys(STATUS_LABELS) as MatchStatus[]).map(s => (
              report.counts[s] > 0 && (
                <FilterChip
                  key={s}
                  label={`${STATUS_LABELS[s]} ${report.counts[s]}`}
                  active={filter === s}
                  color={STATUS_COLORS[s]}
                  onClick={() => setFilter(s)}
                />
              )
            ))}
          </div>

          {/* Tabella preview */}
          <div style={{
            background: '#fff', borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            overflowX: 'auto',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f6f7fb', textAlign: 'left', color: '#4b5563' }}>
                  <th style={th}>Esito</th>
                  <th style={th}>Nome FIGC</th>
                  <th style={th}>Nato il</th>
                  <th style={th}>Matricola</th>
                  <th style={th}>Giocatore interno</th>
                  <th style={th}>Regola</th>
                  <th style={th}>Campi da modificare</th>
                  <th style={th}>Note</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => <Row key={i} d={d} />)}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: '#9ba4ad' }}>
                    Nessuna riga per il filtro selezionato.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Call to action placeholder: Apply sarà abilitato nello Step 5 */}
          <div style={{
            marginTop: 16, padding: 14, borderRadius: 12,
            background: '#eef2ff', color: '#3730a3', fontSize: 12,
          }}>
            <Icon name="info" size={14} /> <strong>Dry-run.</strong> Nessuna scrittura è stata effettuata sul
            database. L'applicazione delle modifiche verrà abilitata nel prossimo rilascio con conferma esplicita.
          </div>
        </>
      )}
    </div>
  )
}

const th: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #e5e7eb', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #f6f7fb', verticalAlign: 'top' }

function Meta({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#9ba4ad', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#181c20' }}>{String(value ?? '—')}</div>
    </div>
  )
}

function FilterChip({ label, active, onClick, color }: {
  label: string; active: boolean; onClick: () => void; color?: { bg: string; fg: string }
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 10px', borderRadius: 20,
        background: active ? (color?.bg ?? '#b3005c') : '#fff',
        color: active ? (color?.fg ?? '#fff') : '#4b5563',
        border: `1px solid ${active ? (color?.bg ?? '#b3005c') : '#d4dae3'}`,
        fontSize: 11, fontWeight: 700, cursor: 'pointer',
      }}>
      {label}
    </button>
  )
}

function Row({ d }: { d: MatchDecision }) {
  const color = STATUS_COLORS[d.status]
  return (
    <tr>
      <td style={td}>
        <span style={{
          display: 'inline-block', padding: '3px 8px', borderRadius: 6,
          background: color.bg, color: color.fg, fontSize: 10, fontWeight: 800,
        }}>{STATUS_LABELS[d.status]}</span>
      </td>
      <td style={{ ...td, fontWeight: 600 }}>{d.row.full_name_raw}</td>
      <td style={td}>{d.row.birth_date ? new Date(d.row.birth_date).toLocaleDateString('it-IT') : '—'}</td>
      <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{d.row.figc_player_id}</td>
      <td style={td}>
        {d.matched_player_id ? <span style={{ color: '#004a78' }}>✓ collegato</span> : <span style={{ color: '#9ba4ad' }}>—</span>}
      </td>
      <td style={{ ...td, fontSize: 10, color: '#707882' }}>{d.match_rule ?? '—'}</td>
      <td style={td}>
        {d.changes.length === 0 ? <span style={{ color: '#9ba4ad' }}>—</span> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {d.changes.slice(0, 4).map((c, i) => (
              <div key={i} style={{ fontSize: 10, color: c.requires_review ? '#93000a' : '#4b5563' }}>
                <strong>{c.field}</strong>: {String(c.current_value ?? '∅')} → {String(c.proposed_value)}
                {c.requires_review && ' ⚠'}
              </div>
            ))}
            {d.changes.length > 4 && <div style={{ fontSize: 10, color: '#9ba4ad' }}>+{d.changes.length - 4} altri</div>}
          </div>
        )}
      </td>
      <td style={{ ...td, fontSize: 10, color: '#707882' }}>
        {d.warnings.map((w, i) => <div key={i}>{w}</div>)}
        {d.row.parse_warnings.length > 0 && d.row.parse_warnings.map((w, i) => (
          <div key={`p${i}`} style={{ color: '#7a4a00' }}>{w}</div>
        ))}
      </td>
    </tr>
  )
}
