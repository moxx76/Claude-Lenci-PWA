import { useEffect, useMemo, useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'

// ============= DEFINIZIONE VOCI SCHEDA =============
const TECHNICAL_ITEMS: Array<{ key: string; label: string }> = [
  { key: 'first_control', label: 'Primo controllo' },
  { key: 'passing', label: 'Passaggio' },
  { key: 'ball_control', label: 'Conduzione' },
  { key: 'dribbling', label: 'Dribbling' },
  { key: 'one_vs_one', label: '1 vs 1' },
  { key: 'finishing', label: 'Finalizzazione' },
  { key: 'cross', label: 'Cross' },
  { key: 'weak_foot', label: 'Piede debole' },
  { key: 'technique_under_pressure', label: 'Tecnica sotto pressione' },
]

const PHYSICAL_ITEMS: Array<{ key: string; label: string }> = [
  { key: 'acceleration', label: 'Accelerazione' },
  { key: 'speed', label: 'Velocità' },
  { key: 'quickness', label: 'Rapidità' },
  { key: 'change_of_direction', label: 'Cambio direzione' },
  { key: 'strength', label: 'Forza' },
  { key: 'power', label: 'Potenza' },
  { key: 'endurance', label: 'Resistenza' },
  { key: 'coordination', label: 'Coordinazione' },
  { key: 'mobility', label: 'Mobilità' },
]

const TACTICAL_ITEMS: Array<{ key: string; label: string }> = [
  { key: 'game_reading', label: 'Lettura del gioco' },
  { key: 'positioning', label: 'Posizionamento' },
  { key: 'scanning', label: 'Scanning' },
  { key: 'decision_making', label: 'Decision making' },
  { key: 'unmarking', label: 'Smarcamento' },
  { key: 'space_occupation', label: 'Occupazione spazi' },
  { key: 'defensive_phase', label: 'Fase di non possesso' },
  { key: 'transitions', label: 'Transizioni' },
]

const POSITIONS = ['Portiere', 'Difensore', 'Centrocampista', 'Attaccante']
const FOOT_OPTIONS = ['Destro', 'Sinistro', 'Ambidestro']

// ============= INTERFACCE =============
import { classifyBMI, ageInMonths } from '../lib/bmiClassification'

// Helper: calcola BMI = peso (kg) / altezza (m)^2. Restituisce numero con 1 decimale o null se input mancante.
// Nota: il BMI è un indicatore di riferimento adulto — per gli atleti in età evolutiva serve confrontarlo nel
// tempo (trend) piuttosto che classificarlo secondo soglie fisse, per cui NON associamo etichette come
// "sovrappeso/normale". Mostriamo solo il valore numerico.
function computeBMI(heightCm: number | null | undefined, weightKg: number | null | undefined): number | null {
  if (heightCm == null || weightKg == null || heightCm <= 0 || weightKg <= 0) return null
  const m = heightCm / 100
  const v = weightKg / (m * m)
  if (!isFinite(v) || v <= 0) return null
  return Math.round(v * 10) / 10
}

interface Player {
  id: string
  first_name: string
  last_name: string
  birth_date: string
  position: string | null
  dominant_foot?: string | null
  secondary_positions?: string[] | null
  height_cm?: number | null
  weight_kg?: number | null
  shoe_size?: number | null
  sex?: 'M' | 'F' | null
  team_id: string
  team?: { name: string; age_range: string | null; category: string | null } | null
}

interface Assessment {
  id: string
  assessment_date: string
  physical_skills: Record<string, number> | null
  technical_skills: Record<string, number> | null
  tactical_skills: Record<string, number> | null
  physical_score: number | null
  technical_score: number | null
  tactical_score: number | null
  overall_score: number | null
  height_cm: number | null
  weight_kg: number | null
  shoe_size: number | null
  coach_note: string | null
  author_id: string | null
  author?: { full_name: string | null } | null
}

interface Props {
  open: boolean
  onClose: () => void
  player: Player | null
  canEdit: boolean
  onSaved?: () => void
}

// ============= COMPONENTE =============
export function PlayerAssessmentSheet({ open, onClose, player, canEdit, onSaved }: Props) {
  const { profile } = useAuth()
  const [history, setHistory] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'history' | 'new' | 'edit'>('history')
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form dati generali
  const [position, setPosition] = useState('')
  const [dominantFoot, setDominantFoot] = useState('')
  const [secondaryPositions, setSecondaryPositions] = useState<string[]>([])
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [shoeSize, setShoeSize] = useState('')
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().slice(0, 10))

  // Form scores
  const [technical, setTechnical] = useState<Record<string, number>>({})
  const [physical, setPhysical] = useState<Record<string, number>>({})
  const [tactical, setTactical] = useState<Record<string, number>>({})
  const [note, setNote] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !player) return
    setMode('history')
    setEditingId(null)
    setError(null)
    loadHistory()
    // Init form dati generali dai valori player
    setPosition(player.position || '')
    setDominantFoot(player.dominant_foot || '')
    setSecondaryPositions(player.secondary_positions || [])
    setHeightCm(player.height_cm != null ? String(player.height_cm) : '')
    setWeightKg(player.weight_kg != null ? String(player.weight_kg) : '')
    setShoeSize(player.shoe_size != null ? String(player.shoe_size) : '')
    setAssessmentDate(new Date().toISOString().slice(0, 10))
    setTechnical({}); setPhysical({}); setTactical({}); setNote('')
  }, [open, player?.id])

  const loadHistory = async () => {
    if (!player) return
    setLoading(true)
    const { data } = await supabase
      .from('player_assessments')
      .select('*, author:profiles!player_assessments_author_id_fkey(full_name)')
      .eq('player_id', player.id)
      .order('assessment_date', { ascending: false })
    setHistory((data ?? []) as any)
    setLoading(false)
  }

  const mean = (obj: Record<string, number>): number | null => {
    const vals = Object.values(obj).filter(v => typeof v === 'number' && v > 0)
    if (vals.length === 0) return null
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
  }

  const handleSave = async () => {
    if (!player) return
    const t = mean(technical), f = mean(physical), tac = mean(tactical)
    const parts = [t, f, tac].filter(x => x != null) as number[]
    const overall = parts.length > 0 ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 10) / 10 : null

    setSaving(true)
    setError(null)
    try {
      // 1) Aggiorno dati anagrafici sul player (piede, ruoli, altezza, peso, scarpa, ruolo primario)
      const playerUpdate: any = {
        position: position || null,
        dominant_foot: dominantFoot || null,
        secondary_positions: secondaryPositions.length > 0 ? secondaryPositions : null,
        height_cm: heightCm ? parseFloat(heightCm) : null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        shoe_size: shoeSize ? parseFloat(shoeSize) : null,
      }
      await supabase.from('players').update(playerUpdate).eq('id', player.id)

      // 2) Insert nuovo assessment OPPURE Update se in modalità edit
      const payload = {
        player_id: player.id,
        assessment_date: assessmentDate,
        technical_skills: Object.keys(technical).length > 0 ? technical : null,
        physical_skills: Object.keys(physical).length > 0 ? physical : null,
        tactical_skills: Object.keys(tactical).length > 0 ? tactical : null,
        technical_score: t, physical_score: f, tactical_score: tac,
        overall_score: overall,
        height_cm: heightCm ? parseFloat(heightCm) : null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        shoe_size: shoeSize ? parseFloat(shoeSize) : null,
        coach_note: note.trim() || null,
      }

      if (mode === 'edit' && editingId) {
        // UPDATE: preservo player_id e author_id originali (non modificabili qui)
        const { error: err } = await supabase
          .from('player_assessments')
          .update(payload)
          .eq('id', editingId)
        if (err) throw err
      } else {
        // INSERT: nuovo assessment con author corrente
        const { error: err } = await supabase
          .from('player_assessments')
          .insert({ ...payload, author_id: profile?.id })
        if (err) throw err
      }

      onSaved?.()
      await loadHistory()
      setMode('history')
      setEditingId(null)
    } catch (e: any) {
      setError('Errore salvataggio: ' + (e.message || 'sconosciuto'))
    } finally {
      setSaving(false)
    }
  }

  // Prepara il form con i valori esistenti di una valutazione e passa in edit mode
  const startEdit = (a: Assessment) => {
    setEditingId(a.id)
    setAssessmentDate(a.assessment_date)
    // Dati anagrafici: se assessment ha i valori, prevalgono; altrimenti fallback al player
    setPosition(player?.position || '')
    setDominantFoot(player?.dominant_foot || '')
    setSecondaryPositions(player?.secondary_positions || [])
    setHeightCm(a.height_cm != null ? String(a.height_cm) : (player?.height_cm != null ? String(player.height_cm) : ''))
    setWeightKg(a.weight_kg != null ? String(a.weight_kg) : (player?.weight_kg != null ? String(player.weight_kg) : ''))
    setShoeSize(a.shoe_size != null ? String(a.shoe_size) : (player?.shoe_size != null ? String(player.shoe_size) : ''))
    // Skill scores
    setTechnical(a.technical_skills || {})
    setPhysical(a.physical_skills || {})
    setTactical(a.tactical_skills || {})
    setNote(a.coach_note || '')
    setError(null)
    setMode('edit')
  }

  // Reset form e ritorna a history
  const backToHistory = () => {
    setEditingId(null)
    setMode('history')
    setError(null)
    // Reset form ai valori default (per prossima "nuova")
    setPosition(player?.position || '')
    setDominantFoot(player?.dominant_foot || '')
    setSecondaryPositions(player?.secondary_positions || [])
    setHeightCm(player?.height_cm != null ? String(player.height_cm) : '')
    setWeightKg(player?.weight_kg != null ? String(player.weight_kg) : '')
    setShoeSize(player?.shoe_size != null ? String(player.shoe_size) : '')
    setAssessmentDate(new Date().toISOString().slice(0, 10))
    setTechnical({}); setPhysical({}); setTactical({}); setNote('')
  }

  // Prepara una nuova valutazione: reset campi skill, mantieni anagrafica dal player
  const startNew = () => {
    setEditingId(null)
    setAssessmentDate(new Date().toISOString().slice(0, 10))
    setTechnical({}); setPhysical({}); setTactical({}); setNote('')
    setError(null)
    setMode('new')
  }

  // Elimina una valutazione dopo conferma
  const handleDelete = async (a: Assessment) => {
    if (!player) return
    const d = new Date(a.assessment_date)
    const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
    const ok = window.confirm(
      `Eliminare la valutazione del ${dateStr}?\n\n` +
      `Questa azione non è reversibile: i dati salvati (punteggi, note, misure) andranno persi.`
    )
    if (!ok) return
    setError(null)
    try {
      const { error: err } = await supabase.from('player_assessments').delete().eq('id', a.id)
      if (err) throw err
      onSaved?.()
      await loadHistory()
    } catch (e: any) {
      setError('Errore eliminazione: ' + (e.message || 'sconosciuto'))
    }
  }

  if (!player) return null

  const age = player.birth_date ? new Date().getFullYear() - new Date(player.birth_date).getFullYear() : null
  const yearOfBirth = player.birth_date ? new Date(player.birth_date).getFullYear() : null

  return (
    <BottomSheet open={open} onClose={onClose}
      title={
        mode === 'new' ? `Nuova valutazione · ${player.first_name} ${player.last_name}`
        : mode === 'edit' ? `Modifica valutazione · ${player.first_name} ${player.last_name}`
        : `Scheda tecnica · ${player.first_name} ${player.last_name}`
      }>
      <div style={{ padding: '4px 20px 24px' }}>
        {error && (
          <div style={{
            background: '#ffdad6', color: '#93000a', borderRadius: 10,
            padding: '10px 12px', marginBottom: 14, fontSize: 12.5,
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <Icon name="error" size={16} color="#93000a" />{error}
          </div>
        )}

        {mode === 'history' && (
          <>
            {/* Header profilo giocatore */}
            <div style={{
              background: 'linear-gradient(135deg, #005f98, #003c5e)',
              color: '#fff', borderRadius: 14, padding: 14, marginBottom: 14,
            }}>
              <div style={{ fontSize: 10, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                Dati generali
              </div>
              <div style={{ fontFamily: 'Anybody', fontSize: 20, fontWeight: 800, margin: '2px 0 8px' }}>
                {player.first_name} {player.last_name}{age ? ` · ${age} anni` : ''}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
                {player.team?.category && <div><b style={{ opacity: 0.7 }}>Categoria:</b> {player.team.category}</div>}
                {yearOfBirth && <div><b style={{ opacity: 0.7 }}>Anno:</b> {yearOfBirth}</div>}
                {player.position && <div><b style={{ opacity: 0.7 }}>Ruolo:</b> {player.position}</div>}
                {player.dominant_foot && <div><b style={{ opacity: 0.7 }}>Piede:</b> {player.dominant_foot}</div>}
                {player.secondary_positions && player.secondary_positions.length > 0 && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <b style={{ opacity: 0.7 }}>Ruoli secondari:</b> {player.secondary_positions.join(', ')}
                  </div>
                )}
                {player.height_cm != null && <div><b style={{ opacity: 0.7 }}>Altezza:</b> {player.height_cm} cm</div>}
                {player.weight_kg != null && <div><b style={{ opacity: 0.7 }}>Peso:</b> {player.weight_kg} kg</div>}
                {computeBMI(player.height_cm, player.weight_kg) != null && (
                  <div><b style={{ opacity: 0.7 }}>BMI:</b> {computeBMI(player.height_cm, player.weight_kg)}</div>
                )}
                {player.shoe_size != null && <div><b style={{ opacity: 0.7 }}>Scarpa:</b> {player.shoe_size}</div>}
              </div>
            </div>

            {canEdit && (
              <button onClick={startNew}
                style={{
                  width: '100%', marginBottom: 16,
                  background: 'linear-gradient(135deg, #005f98, #0078bf)', color: '#fff',
                  border: 'none', borderRadius: 12, padding: '12px 16px',
                  fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  boxShadow: '0 6px 16px rgba(0,95,152,0.3)',
                }}>
                <Icon name="add_circle" size={16} color="#fff" />
                Nuova valutazione
              </button>
            )}

            {loading && <div style={{ padding: 20, textAlign: 'center', color: '#707882', fontSize: 13 }}>Carico storico…</div>}

            {!loading && history.length === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: '#707882', fontSize: 12.5, lineHeight: 1.5 }}>
                Nessuna valutazione registrata per questo giocatore.
                {canEdit && <div style={{ marginTop: 8, fontWeight: 700 }}>Compila la prima con il bottone sopra.</div>}
              </div>
            )}

            {/* Trend chart: solo se >= 2 valutazioni */}
            {!loading && history.length >= 2 && <TrendPanel history={history} />}

            {!loading && history.map(a => (
              <AssessmentCard key={a.id} assessment={a}
                canEdit={canEdit}
                onEdit={() => startEdit(a)}
                onDelete={() => handleDelete(a)} />
            ))}
          </>
        )}

        {(mode === 'new' || mode === 'edit') && canEdit && (
          <>
            <button onClick={backToHistory} disabled={saving}
              style={{
                background: 'transparent', border: 'none', color: '#005f98',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 12,
              }}>
              <Icon name="arrow_back" size={14} color="#005f98" />
              Torna allo storico
            </button>

            {/* ============= DATI GENERALI ============= */}
            <SectionTitle icon="badge" title="Dati generali" color="#005f98" />
            <Field label="Data valutazione">
              <input type="date" value={assessmentDate} onChange={e => setAssessmentDate(e.target.value)} style={inputStyle} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Ruolo principale">
                <select value={position} onChange={e => setPosition(e.target.value)} style={inputStyle}>
                  <option value="">—</option>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Piede dominante">
                <select value={dominantFoot} onChange={e => setDominantFoot(e.target.value)} style={inputStyle}>
                  <option value="">—</option>
                  {FOOT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Ruoli secondari (multiplo)">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {POSITIONS.map(p => {
                  const active = secondaryPositions.includes(p)
                  return (
                    <button key={p}
                      onClick={() => setSecondaryPositions(prev => active ? prev.filter(x => x !== p) : [...prev, p])}
                      style={{
                        padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                        border: active ? '2px solid #005f98' : '1px solid #d5dae2',
                        background: active ? '#cfe5ff' : '#fff',
                        color: active ? '#004a78' : '#404751',
                        fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
                      }}>{p}</button>
                  )
                })}
              </div>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <Field label="Altezza (cm)">
                <input type="number" step="1" min="100" max="220" value={heightCm}
                  onChange={e => setHeightCm(e.target.value)} placeholder="170" style={inputStyle} />
              </Field>
              <Field label="Peso (kg)">
                <input type="number" step="0.1" min="20" max="150" value={weightKg}
                  onChange={e => setWeightKg(e.target.value)} placeholder="60" style={inputStyle} />
              </Field>
              <Field label="Scarpa (EU)">
                <input type="number" step="0.5" min="28" max="50" value={shoeSize}
                  onChange={e => setShoeSize(e.target.value)} placeholder="42" style={inputStyle} />
              </Field>
            </div>

            {/* Anteprima BMI calcolato in tempo reale + classificazione WHO */}
            {(() => {
              const h = heightCm ? parseFloat(heightCm) : null
              const w = weightKg ? parseFloat(weightKg) : null
              const bmi = computeBMI(h, w)
              if (bmi == null) return (
                <div style={{
                  background: '#f7f9ff', border: '1px dashed #c7d5e8', borderRadius: 10,
                  padding: '8px 12px', fontSize: 11, color: '#707882', fontStyle: 'italic',
                }}>
                  Compila altezza e peso per calcolare il BMI in automatico.
                </div>
              )
              const months = ageInMonths(player.birth_date)
              const cls = classifyBMI(bmi, months, player.sex ?? null)
              return (
                <div style={{
                  background: cls?.bg || '#eef7ff',
                  border: `1px solid ${cls?.border || '#a0c4e6'}`,
                  borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    minWidth: 62, textAlign: 'center', background: '#fff', borderRadius: 8, padding: '6px 4px',
                    border: `1px solid ${cls?.border || '#a0c4e6'}`,
                  }}>
                    <div style={{
                      fontFamily: 'Anybody', fontWeight: 800, fontSize: 20,
                      color: cls?.color || '#005f98', lineHeight: 1,
                    }}>
                      {bmi}
                    </div>
                    <div style={{ fontSize: 8.5, color: '#707882', fontWeight: 700, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                      BMI
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {cls ? (
                      <>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 }}>
                          <span style={{
                            fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
                            background: '#fff', color: cls.color, border: `1px solid ${cls.border}`,
                          }}>
                            {cls.label}
                          </span>
                          <span style={{ fontSize: 10, color: '#707882', fontWeight: 700 }}>
                            {cls.reference === 'who-5-19' ? `WHO 5-19 · z ${cls.zScore >= 0 ? '+' : ''}${cls.zScore}` : 'Riferimento adulto'}
                          </span>
                        </div>
                        <div style={{ fontSize: 10.5, color: '#404751', lineHeight: 1.35 }}>
                          {cls.reference === 'who-5-19'
                            ? 'Classificazione WHO Growth Reference 5-19 anni. Il singolo dato non fa diagnosi: per valutazioni cliniche affidati sempre a pediatra o medico sportivo.'
                            : 'Soglia standard OMS per adulti. Non tiene conto di massa muscolare/composizione corporea — negli sportivi va interpretata con cautela.'}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 11, color: '#404751', lineHeight: 1.4 }}>
                        Calcolato da peso ÷ altezza². Per classificazione WHO serve la data di nascita (bambini &gt; 5 anni).
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* ============= TECNICA ============= */}
            <SectionTitle icon="sports_soccer" title="Tecnica" color="#c1006c" mean={mean(technical)} />
            {TECHNICAL_ITEMS.map(it => (
              <ScoreRow key={it.key} label={it.label}
                value={technical[it.key] || 0}
                onChange={v => setTechnical(prev => ({ ...prev, [it.key]: v }))} />
            ))}

            {/* ============= FISICA ============= */}
            <SectionTitle icon="fitness_center" title="Fisica" color="#ff6b00" mean={mean(physical)} />
            {PHYSICAL_ITEMS.map(it => (
              <ScoreRow key={it.key} label={it.label}
                value={physical[it.key] || 0}
                onChange={v => setPhysical(prev => ({ ...prev, [it.key]: v }))} />
            ))}

            {/* ============= TATTICO-COGNITIVA ============= */}
            <SectionTitle icon="psychology" title="Tattico-Cognitiva" color="#00a86b" mean={mean(tactical)} />
            {TACTICAL_ITEMS.map(it => (
              <ScoreRow key={it.key} label={it.label}
                value={tactical[it.key] || 0}
                onChange={v => setTactical(prev => ({ ...prev, [it.key]: v }))} />
            ))}

            {/* ============= NOTE ============= */}
            <Field label="Note allenatore">
              <textarea value={note} onChange={e => setNote(e.target.value)}
                rows={3} placeholder="Osservazioni, obiettivi da lavorare, punti di forza…"
                style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} />
            </Field>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={backToHistory} disabled={saving}
                style={{
                  flex: 1, padding: '12px 18px', borderRadius: 12,
                  border: '1px solid #c0c7d2', background: '#fff',
                  fontSize: 13, fontWeight: 700, color: '#404751', cursor: 'pointer',
                }}>Annulla</button>
              <button onClick={handleSave} disabled={saving}
                style={{
                  flex: 2, padding: '12px 18px', borderRadius: 12, border: 'none',
                  background: '#005f98', color: '#fff',
                  fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 6px 16px rgba(0,95,152,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: saving ? 0.6 : 1,
                }}>
                <Icon name="save" size={15} color="#fff" />
                {saving ? 'Salvo…' : (mode === 'edit' ? 'Salva modifiche' : 'Salva valutazione')}
              </button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  )
}

// ============= COMPONENTI HELPER =============

type MetricKey = 'overall' | 'technical' | 'physical' | 'tactical'

const METRIC_LABELS: Record<MetricKey, { label: string; color: string; icon: string }> = {
  overall:   { label: 'Complessivo', color: '#005f98', icon: 'insights' },
  technical: { label: 'Tecnica',     color: '#c1006c', icon: 'sports_soccer' },
  physical:  { label: 'Fisica',      color: '#ff6b00', icon: 'fitness_center' },
  tactical:  { label: 'Tattica',     color: '#00a86b', icon: 'psychology' },
}

function TrendPanel({ history }: { history: Assessment[] }) {
  const [metric, setMetric] = useState<MetricKey>('overall')

  // Ordino cronologicamente ASC (dal più vecchio al più recente)
  const points = useMemo(() => {
    const key = metric === 'overall' ? 'overall_score'
      : metric === 'technical' ? 'technical_score'
      : metric === 'physical' ? 'physical_score'
      : 'tactical_score'
    return [...history]
      .filter(a => (a as any)[key] != null)
      .map(a => ({ date: a.assessment_date, value: (a as any)[key] as number }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [history, metric])

  const meta = METRIC_LABELS[metric]

  // Delta ultima vs precedente
  const latest = points[points.length - 1]
  const previous = points[points.length - 2]
  const delta = latest && previous ? Math.round((latest.value - previous.value) * 10) / 10 : null

  if (points.length < 2) {
    // No dati sufficienti per questa metrica
    return (
      <div style={{ marginBottom: 14 }}>
        <TrendTabs metric={metric} setMetric={setMetric} />
        <div style={{
          background: '#fff', border: '1px solid #d5dae2', borderRadius: 12,
          padding: 30, textAlign: 'center', color: '#707882', fontSize: 12,
        }}>
          Servono almeno 2 valutazioni sulla sezione {meta.label.toLowerCase()} per mostrare il trend.
        </div>
      </div>
    )
  }

  const minV = Math.min(...points.map(p => p.value))
  const maxV = Math.max(...points.map(p => p.value))
  const yMin = Math.max(0, Math.floor(minV - 1))
  const yMax = Math.min(10, Math.ceil(maxV + 1))
  const yRange = Math.max(1, yMax - yMin)

  const width = 320, height = 130, padL = 24, padR = 12, padT = 12, padB = 24
  const plotW = width - padL - padR
  const plotH = height - padT - padB

  const coords = points.map((p, i) => ({
    ...p,
    x: padL + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW),
    y: padT + plotH - ((p.value - yMin) / yRange) * plotH,
  }))

  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ')

  const formatDate = (d: string) => {
    const dt = new Date(d)
    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <TrendTabs metric={metric} setMetric={setMetric} />

      <div style={{
        background: '#fff', border: '1px solid #d5dae2', borderRadius: 12,
        padding: 12, marginTop: 4,
      }}>
        {/* Header stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: meta.color, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Anybody', fontWeight: 800, fontSize: 16, flexShrink: 0,
          }}>{latest.value.toFixed(1)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: '#707882', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Ultima valutazione · {formatDate(latest.date)}
            </div>
            <div style={{ fontSize: 11.5, color: '#181c20', fontWeight: 700, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              {delta != null && delta !== 0 && (
                <>
                  <Icon name={delta > 0 ? 'trending_up' : 'trending_down'} size={14} color={delta > 0 ? '#43a047' : '#c62828'} />
                  <span style={{ color: delta > 0 ? '#43a047' : '#c62828', fontWeight: 800 }}>
                    {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                  </span>
                  <span style={{ color: '#707882', fontWeight: 600 }}>rispetto al {formatDate(previous.date)}</span>
                </>
              )}
              {delta === 0 && (
                <>
                  <Icon name="trending_flat" size={14} color="#8e6300" />
                  <span style={{ color: '#8e6300', fontWeight: 800 }}>Stabile</span>
                  <span style={{ color: '#707882', fontWeight: 600 }}>rispetto al {formatDate(previous.date)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* SVG Chart */}
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', maxWidth: '100%' }}>
          {/* Griglia orizzontale */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
            const y = padT + plotH * frac
            const v = yMax - frac * yRange
            return (
              <g key={i}>
                <line x1={padL} y1={y} x2={width - padR} y2={y}
                  stroke="#e6e8ee" strokeWidth={1} strokeDasharray={i === 0 || i === 4 ? '' : '2,3'} />
                <text x={padL - 4} y={y + 3} fontSize={8.5} fill="#707882" textAnchor="end" fontFamily="inherit">
                  {v.toFixed(1)}
                </text>
              </g>
            )
          })}

          {/* Line */}
          <path d={pathD} fill="none" stroke={meta.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

          {/* Area sotto la line (light) */}
          <path
            d={`${pathD} L ${coords[coords.length - 1].x} ${padT + plotH} L ${coords[0].x} ${padT + plotH} Z`}
            fill={meta.color} opacity={0.08}
          />

          {/* Punti + label sopra */}
          {coords.map((c, i) => (
            <g key={i}>
              <circle cx={c.x} cy={c.y} r={4} fill="#fff" stroke={meta.color} strokeWidth={2} />
              <text x={c.x} y={c.y - 8} fontSize={9} fill="#181c20" textAnchor="middle" fontWeight={700} fontFamily="inherit">
                {c.value.toFixed(1)}
              </text>
              <text x={c.x} y={height - 4} fontSize={8.5} fill="#707882" textAnchor="middle" fontFamily="inherit">
                {formatDate(c.date)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}

function TrendTabs({ metric, setMetric }: { metric: MetricKey; setMetric: (m: MetricKey) => void }) {
  const keys: MetricKey[] = ['overall', 'technical', 'physical', 'tactical']
  return (
    <div style={{
      display: 'flex', gap: 4, background: '#f1f3fa',
      padding: 3, borderRadius: 10, marginBottom: 6,
    }}>
      {keys.map(k => {
        const m = METRIC_LABELS[k]
        const active = metric === k
        return (
          <button key={k} onClick={() => setMetric(k)}
            style={{
              flex: 1, padding: '7px 4px', borderRadius: 8,
              background: active ? '#fff' : 'transparent',
              color: active ? m.color : '#707882',
              border: 'none', cursor: 'pointer',
              fontSize: 10.5, fontWeight: 800, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
              boxShadow: active ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
            }}>
            <Icon name={m.icon} size={11} color={active ? m.color : '#707882'} />
            {m.label}
          </button>
        )
      })}
    </div>
  )
}

function AssessmentCard({
  assessment, canEdit, onEdit, onDelete,
}: {
  assessment: Assessment
  canEdit?: boolean
  onEdit?: () => void
  onDelete?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const d = new Date(assessment.assessment_date)
  const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  const overall = assessment.overall_score ?? null
  const hasDetails = !!(assessment.technical_skills || assessment.physical_skills || assessment.tactical_skills)
  // "vuota" = nessun punteggio né skill compilata
  const isEmpty = assessment.technical_score == null
    && assessment.physical_score == null
    && assessment.tactical_score == null
    && !assessment.technical_skills
    && !assessment.physical_skills
    && !assessment.tactical_skills

  return (
    <div style={{
      background: '#fff',
      border: isEmpty ? '1px dashed #c47f00' : '1px solid #d5dae2',
      borderRadius: 12, padding: 12, marginBottom: 10,
    }}>
      {isEmpty && (
        <div style={{
          background: '#fff4e6', color: '#7c4700',
          fontSize: 10.5, fontWeight: 700, padding: '6px 10px',
          borderRadius: 8, marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Icon name="warning" size={13} color="#7c4700" />
          Valutazione senza punteggi — clicca “Modifica” per compilarla
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: overall ? scoreColor(overall) : '#c0c7d2', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Anybody', fontWeight: 800, fontSize: 15, flexShrink: 0,
        }}>{overall != null ? overall.toFixed(1) : '—'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#181c20' }}>{dateStr}</div>
          {assessment.author?.full_name && (
            <div style={{ fontSize: 10.5, color: '#707882', marginTop: 2 }}>
              Valutatore: {assessment.author.full_name}
            </div>
          )}
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button onClick={onEdit}
              title="Modifica valutazione"
              style={{
                width: 32, height: 32, borderRadius: 8,
                border: '1px solid #a0c4e6', background: '#eef7ff',
                color: '#004a78', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              <Icon name="edit" size={16} color="#004a78" />
            </button>
            <button onClick={onDelete}
              title="Elimina valutazione"
              style={{
                width: 32, height: 32, borderRadius: 8,
                border: '1px solid #f3b3ac', background: '#ffe6e2',
                color: '#93000a', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              <Icon name="delete" size={16} color="#93000a" />
            </button>
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        <ScoreBadge label="Tecnica" value={assessment.technical_score} color="#c1006c" />
        <ScoreBadge label="Fisica" value={assessment.physical_score} color="#ff6b00" />
        <ScoreBadge label="Tattica" value={assessment.tactical_score} color="#00a86b" />
      </div>
      {(assessment.height_cm != null || assessment.weight_kg != null || assessment.shoe_size != null) && (
        <div style={{ fontSize: 10.5, color: '#707882', marginTop: 8 }}>
          {[
            assessment.height_cm != null ? `Altezza: ${assessment.height_cm} cm` : null,
            assessment.weight_kg != null ? `Peso: ${assessment.weight_kg} kg` : null,
            computeBMI(assessment.height_cm, assessment.weight_kg) != null
              ? `BMI: ${computeBMI(assessment.height_cm, assessment.weight_kg)}` : null,
            assessment.shoe_size != null ? `Scarpa: ${assessment.shoe_size}` : null,
          ].filter(Boolean).join(' · ')}
        </div>
      )}
      {assessment.coach_note && (
        <div style={{
          fontSize: 11, color: '#404751', marginTop: 8,
          padding: '8px 10px', background: '#f1f3fa', borderRadius: 8, lineHeight: 1.4,
        }}>
          <b style={{ fontSize: 9.5, color: '#707882', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nota</b>
          <div style={{ marginTop: 2 }}>{assessment.coach_note}</div>
        </div>
      )}

      {/* Dettaglio parametri espandibile */}
      {hasDetails && (
        <>
          <button onClick={() => setExpanded(v => !v)}
            style={{
              width: '100%', marginTop: 10, padding: '8px 10px',
              background: expanded ? '#005f98' : '#f1f3fa',
              color: expanded ? '#fff' : '#005f98',
              border: 'none', borderRadius: 8, cursor: 'pointer',
              fontSize: 11, fontWeight: 800, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
            <Icon name={expanded ? 'expand_less' : 'expand_more'} size={14} color={expanded ? '#fff' : '#005f98'} />
            {expanded ? 'Nascondi dettaglio' : 'Vedi tutti i parametri'}
          </button>

          {expanded && (
            <div style={{ marginTop: 10 }}>
              {assessment.technical_skills && (
                <SkillsBlock title="Tecnica" color="#c1006c" icon="sports_soccer"
                  items={TECHNICAL_ITEMS} values={assessment.technical_skills} />
              )}
              {assessment.physical_skills && (
                <SkillsBlock title="Fisica" color="#ff6b00" icon="fitness_center"
                  items={PHYSICAL_ITEMS} values={assessment.physical_skills} />
              )}
              {assessment.tactical_skills && (
                <SkillsBlock title="Tattico-Cognitiva" color="#00a86b" icon="psychology"
                  items={TACTICAL_ITEMS} values={assessment.tactical_skills} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ScoreBadge({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div style={{
      background: value != null ? color + '15' : '#f1f3fa',
      padding: '6px 8px', borderRadius: 8, textAlign: 'center',
    }}>
      <div style={{ fontSize: 8.5, fontWeight: 800, color: '#707882', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: value != null ? color : '#c0c7d2', fontFamily: 'Anybody' }}>
        {value != null ? value.toFixed(1) : '—'}
      </div>
    </div>
  )
}

function SectionTitle({ icon, title, color, mean }: { icon: string; title: string; color: string; mean?: number | null }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      margin: '18px 0 10px', paddingBottom: 6,
      borderBottom: `2px solid ${color}20`,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, background: color, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon name={icon} size={14} color="#fff" />
      </div>
      <div style={{ flex: 1, fontSize: 13, fontWeight: 800, color: '#181c20', fontFamily: 'Anybody' }}>
        {title}
      </div>
      {mean != null && (
        <div style={{
          padding: '3px 8px', borderRadius: 999, background: color, color: '#fff',
          fontSize: 11, fontWeight: 800,
        }}>Media {mean.toFixed(1)}</div>
      )}
    </div>
  )
}

function ScoreRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: '#181c20', fontWeight: 600 }}>{label}</span>
        <span style={{
          fontSize: 12, fontWeight: 800, color: value > 0 ? scoreColor(value) : '#c0c7d2',
          minWidth: 20, textAlign: 'right',
        }}>{value > 0 ? value : '—'}</span>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => {
          const active = value === n
          const filled = value >= n
          return (
            <button key={n} onClick={() => onChange(n === value ? 0 : n)}
              style={{
                flex: 1, height: 26, borderRadius: 5, cursor: 'pointer',
                border: active ? '2px solid #181c20' : '1px solid #d5dae2',
                background: filled ? scoreColor(value) : '#fff',
                color: filled ? '#fff' : '#707882',
                fontSize: 10.5, fontWeight: 800, fontFamily: 'inherit',
              }}>{n}</button>
          )
        })}
      </div>
    </div>
  )
}

function SkillsBlock({ title, color, icon, items, values }: {
  title: string;
  color: string;
  icon: string;
  items: Array<{ key: string; label: string }>;
  values: Record<string, number>;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
        paddingBottom: 4, borderBottom: `1.5px solid ${color}25`,
      }}>
        <Icon name={icon} size={12} color={color} />
        <span style={{ fontSize: 10.5, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </span>
      </div>
      {items.map(it => {
        const v = values[it.key]
        if (v == null || v === 0) return null
        return (
          <div key={it.key} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
          }}>
            <span style={{ flex: 1, fontSize: 11, color: '#404751' }}>{it.label}</span>
            <div style={{ display: 'flex', gap: 1.5, flexShrink: 0 }}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <div key={n} style={{
                  width: 8, height: 12, borderRadius: 2,
                  background: v >= n ? scoreColor(v) : '#e6e8ee',
                }} />
              ))}
            </div>
            <span style={{
              fontSize: 11, fontWeight: 800, color: scoreColor(v),
              minWidth: 18, textAlign: 'right', fontFamily: 'Anybody',
            }}>{v}</span>
          </div>
        )
      })}
    </div>
  )
}

function scoreColor(v: number): string {
  if (v <= 3) return '#c62828'      // rosso
  if (v <= 5) return '#ff6b00'      // arancione
  if (v <= 7) return '#f9a825'      // giallo scuro
  if (v <= 8.5) return '#43a047'    // verde
  return '#005f98'                  // blu
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 12px', borderRadius: 10,
  border: '1px solid #c0c7d2', fontSize: 13.5, color: '#181c20',
  fontFamily: 'inherit', background: '#fff', outline: 'none',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 10.5, fontWeight: 700, color: '#707882',
        textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  )
}
