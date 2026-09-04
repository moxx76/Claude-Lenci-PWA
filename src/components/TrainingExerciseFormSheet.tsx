import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { SvgFieldEditor } from './SvgFieldEditor'
import { type DiagramJson, DEFAULT_DIAGRAM, renderDiagramToSvg } from '../lib/svgDiagram'
import type { TrainingExercise, SessionPart } from '../hooks/useExerciseCatalog'
import { SESSION_PART_META } from '../hooks/useExerciseCatalog'

interface Props {
  open: boolean
  onClose: () => void
  mode: 'create' | 'edit' | 'duplicate'
  existingExercise?: TrainingExercise | null
  onSaved?: () => void
}

const AGE_OPTIONS = ['Piccoli Amici', 'Primi Calci', 'Pulcini', 'Esordienti', 'U-14', 'U-16', 'Juniores']
const SESSION_PARTS: SessionPart[] = ['attivazione', 'tecnica', 'situazionale', 'gioco']

interface FormState {
  name: string
  session_part: SessionPart
  duration_min: number
  age_ranges: string[]
  objective_possesso: string
  objective_non_possesso: string
  objective_tecnico: string
  objective_motorio: string
  objective_emotivo: string
  principles: string[]
  area_size: string
  materials: string
  description: string
  diagram_json: DiagramJson
  players_min: number | null
  players_max: number | null
  tags: string[]
}

function initFormState(ex?: TrainingExercise | null, mode?: string): FormState {
  if (ex) {
    return {
      name: mode === 'duplicate' ? `${ex.name} (copia)` : ex.name,
      session_part: ex.session_part,
      duration_min: ex.duration_min ?? 15,
      age_ranges: ex.age_ranges ?? [],
      objective_possesso: ex.objective_possesso ?? '',
      objective_non_possesso: ex.objective_non_possesso ?? '',
      objective_tecnico: ex.objective_tecnico ?? '',
      objective_motorio: ex.objective_motorio ?? '',
      objective_emotivo: ex.objective_emotivo ?? '',
      principles: ex.principles ?? [],
      area_size: ex.area_size ?? '',
      materials: ex.materials ?? '',
      description: ex.description ?? '',
      diagram_json: (ex as unknown as { diagram_json?: DiagramJson }).diagram_json ?? DEFAULT_DIAGRAM,
      players_min: ex.players_min ?? null,
      players_max: ex.players_max ?? null,
      tags: ex.tags ?? [],
    }
  }
  return {
    name: '',
    session_part: 'tecnica',
    duration_min: 15,
    age_ranges: [],
    objective_possesso: '',
    objective_non_possesso: '',
    objective_tecnico: '',
    objective_motorio: '',
    objective_emotivo: '',
    principles: [],
    area_size: '',
    materials: '',
    description: '',
    diagram_json: DEFAULT_DIAGRAM,
    players_min: null,
    players_max: null,
    tags: [],
  }
}

export function TrainingExerciseFormSheet({ open, onClose, mode, existingExercise, onSaved }: Props) {
  const { profile } = useAuth()
  const [form, setForm] = useState<FormState>(() => initFormState(existingExercise, mode))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [principleInput, setPrincipleInput] = useState('')
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    if (open) {
      setForm(initFormState(existingExercise, mode))
      setError(null)
    }
  }, [open, existingExercise, mode])

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(f => ({ ...f, [key]: value }))
  }

  const toggleAge = (age: string) => {
    setForm(f => ({
      ...f,
      age_ranges: f.age_ranges.includes(age) ? f.age_ranges.filter(a => a !== age) : [...f.age_ranges, age],
    }))
  }

  const addPrinciple = () => {
    const v = principleInput.trim()
    if (!v) return
    setForm(f => ({ ...f, principles: [...f.principles, v] }))
    setPrincipleInput('')
  }
  const removePrinciple = (i: number) => setForm(f => ({ ...f, principles: f.principles.filter((_, j) => j !== i) }))

  const addTag = () => {
    const v = tagInput.trim().toLowerCase()
    if (!v) return
    setForm(f => ({ ...f, tags: [...f.tags, v] }))
    setTagInput('')
  }
  const removeTag = (i: number) => setForm(f => ({ ...f, tags: f.tags.filter((_, j) => j !== i) }))

  const handleSave = async () => {
    if (!profile?.club_id) return
    setError(null)

    // Validazione minima
    if (!form.name.trim()) {
      setError('Il nome dell\'esercizio è obbligatorio.')
      return
    }
    if (form.duration_min <= 0) {
      setError('La durata deve essere maggiore di 0.')
      return
    }
    if (form.age_ranges.length === 0) {
      setError('Seleziona almeno una fascia d\'età.')
      return
    }

    setSaving(true)
    try {
      const diagram_svg = renderDiagramToSvg(form.diagram_json)
      const payload = {
        club_id: profile.club_id,
        name: form.name.trim(),
        session_part: form.session_part,
        duration_min: form.duration_min,
        age_ranges: form.age_ranges,
        objective_possesso: form.objective_possesso.trim() || null,
        objective_non_possesso: form.objective_non_possesso.trim() || null,
        objective_tecnico: form.objective_tecnico.trim() || null,
        objective_motorio: form.objective_motorio.trim() || null,
        objective_emotivo: form.objective_emotivo.trim() || null,
        principles: form.principles.length > 0 ? form.principles : null,
        area_size: form.area_size.trim() || null,
        materials: form.materials.trim() || null,
        description: form.description.trim() || null,
        diagram_svg,
        diagram_json: form.diagram_json,
        players_min: form.players_min,
        players_max: form.players_max,
        tags: form.tags.length > 0 ? form.tags : null,
        is_official: false, // Sempre false per esercizi utente
      }

      if (mode === 'edit' && existingExercise) {
        const { error: upErr } = await supabase
          .from('training_exercises')
          .update(payload)
          .eq('id', existingExercise.id)
        if (upErr) throw upErr
      } else {
        // create o duplicate: entrambi INSERT
        const { error: insErr } = await supabase
          .from('training_exercises')
          .insert({ ...payload, created_by: profile.id })
        if (insErr) throw insErr
      }

      onSaved?.()
      onClose()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(`Errore salvataggio: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  const title = mode === 'edit' ? 'Modifica esercizio' : mode === 'duplicate' ? 'Duplica esercizio' : 'Nuovo esercizio custom'

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div style={{ padding: '10px 14px 20px', display: 'grid', gap: 14 }}>
        {/* Nome */}
        <Field label="Nome esercizio *">
          <input
            value={form.name}
            onChange={e => patch('name', e.target.value)}
            placeholder="Es: Torello dinamico 4vs2"
            style={inputStyle}
          />
        </Field>

        {/* Parte della seduta - chip selector */}
        <Field label="Parte della seduta *">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SESSION_PARTS.map(p => {
              const meta = SESSION_PART_META[p]
              const isActive = form.session_part === p
              return (
                <button
                  key={p}
                  onClick={() => patch('session_part', p)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 20,
                    border: isActive ? `2px solid ${meta.fg}` : '1px solid #c0c7d2',
                    background: isActive ? meta.bg : '#fff',
                    color: isActive ? meta.fg : '#404751',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontFamily: 'inherit',
                  }}
                >
                  <Icon name={meta.icon} size={14} color={isActive ? meta.fg : '#404751'} />
                  {meta.label}
                </button>
              )
            })}
          </div>
        </Field>

        {/* Durata */}
        <Field label="Durata (minuti) *">
          <input
            type="number"
            value={form.duration_min}
            onChange={e => patch('duration_min', parseInt(e.target.value) || 0)}
            min={1}
            max={120}
            style={{ ...inputStyle, maxWidth: 100 }}
          />
        </Field>

        {/* Fasce età - multiselect */}
        <Field label="Fasce d'età consigliate *">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {AGE_OPTIONS.map(age => {
              const isActive = form.age_ranges.includes(age)
              return (
                <button
                  key={age}
                  onClick={() => toggleAge(age)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 20,
                    border: isActive ? '2px solid #005f98' : '1px solid #c0c7d2',
                    background: isActive ? '#e0f0ff' : '#fff',
                    color: isActive ? '#004a78' : '#404751',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {isActive && '✓ '}{age}
                </button>
              )
            })}
          </div>
        </Field>

        {/* Editor SVG */}
        <Field label="Schema tattico">
          <SvgFieldEditor value={form.diagram_json} onChange={v => patch('diagram_json', v)} />
        </Field>

        {/* Obiettivi 5 tipi */}
        <details style={sectionStyle}>
          <summary style={sectionSummary}>🎯 Obiettivi didattici</summary>
          <div style={{ display: 'grid', gap: 10, paddingTop: 10 }}>
            <Field label="Fase di possesso" sub="Cosa si allena in attacco">
              <textarea
                value={form.objective_possesso}
                onChange={e => patch('objective_possesso', e.target.value)}
                rows={2}
                placeholder="Es: mantenere il possesso sotto pressione"
                style={textareaStyle}
              />
            </Field>
            <Field label="Fase di non possesso" sub="Cosa si allena in difesa">
              <textarea
                value={form.objective_non_possesso}
                onChange={e => patch('objective_non_possesso', e.target.value)}
                rows={2}
                placeholder="Es: pressione al portatore, chiusura passaggio"
                style={textareaStyle}
              />
            </Field>
            <Field label="Obiettivo tecnico">
              <textarea
                value={form.objective_tecnico}
                onChange={e => patch('objective_tecnico', e.target.value)}
                rows={2}
                placeholder="Es: passaggio a un tocco, controllo orientato"
                style={textareaStyle}
              />
            </Field>
            <Field label="Obiettivo motorio">
              <textarea
                value={form.objective_motorio}
                onChange={e => patch('objective_motorio', e.target.value)}
                rows={2}
                placeholder="Es: cambi di direzione, ripetute brevi"
                style={textareaStyle}
              />
            </Field>
            <Field label="Obiettivo emotivo / cognitivo">
              <textarea
                value={form.objective_emotivo}
                onChange={e => patch('objective_emotivo', e.target.value)}
                rows={2}
                placeholder="Es: attenzione, comunicazione, decisione rapida"
                style={textareaStyle}
              />
            </Field>
          </div>
        </details>

        {/* Principi */}
        <Field label="Principi di gioco" sub="Aggiungi uno alla volta">
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input
              value={principleInput}
              onChange={e => setPrincipleInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addPrinciple()
                }
              }}
              placeholder="Es: ampiezza, verticalizzazione"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={addPrinciple} style={addBtnStyle}>+ Aggiungi</button>
          </div>
          {form.principles.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {form.principles.map((p, i) => (
                <span key={i} style={chipStyle}>
                  {p}
                  <button onClick={() => removePrinciple(i)} style={chipXStyle}>×</button>
                </span>
              ))}
            </div>
          )}
        </Field>

        {/* Setup */}
        <details style={sectionStyle}>
          <summary style={sectionSummary}>📐 Setup pratico</summary>
          <div style={{ display: 'grid', gap: 10, paddingTop: 10 }}>
            <Field label="Dimensioni area">
              <input
                value={form.area_size}
                onChange={e => patch('area_size', e.target.value)}
                placeholder="Es: 20x15 metri, metà campo"
                style={inputStyle}
              />
            </Field>
            <Field label="Materiali necessari">
              <input
                value={form.materials}
                onChange={e => patch('materials', e.target.value)}
                placeholder="Es: 4 coni, 8 casacche, 2 palloni"
                style={inputStyle}
              />
            </Field>
            <div style={{ display: 'flex', gap: 10 }}>
              <Field label="Giocatori min">
                <input
                  type="number"
                  value={form.players_min ?? ''}
                  onChange={e => patch('players_min', e.target.value ? parseInt(e.target.value) : null)}
                  min={1}
                  style={{ ...inputStyle, width: 80 }}
                />
              </Field>
              <Field label="Giocatori max">
                <input
                  type="number"
                  value={form.players_max ?? ''}
                  onChange={e => patch('players_max', e.target.value ? parseInt(e.target.value) : null)}
                  min={1}
                  style={{ ...inputStyle, width: 80 }}
                />
              </Field>
            </div>
          </div>
        </details>

        {/* Descrizione */}
        <Field label="Descrizione / Esecuzione">
          <textarea
            value={form.description}
            onChange={e => patch('description', e.target.value)}
            rows={5}
            placeholder="Descrivi l'esercizio in modo che un altro mister possa applicarlo: setup, regole, rotazioni, varianti, focus, tempi..."
            style={textareaStyle}
          />
        </Field>

        {/* Tag */}
        <Field label="Tag (per ricerca)">
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTag()
                }
              }}
              placeholder="Es: passaggio, pressing, 1vs1"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={addTag} style={addBtnStyle}>+ Tag</button>
          </div>
          {form.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {form.tags.map((t, i) => (
                <span key={i} style={{ ...chipStyle, background: '#f0f0f2', color: '#404751', borderColor: '#c0c7d2' }}>
                  #{t}
                  <button onClick={() => removeTag(i)} style={chipXStyle}>×</button>
                </span>
              ))}
            </div>
          )}
        </Field>

        {/* Errore */}
        {error && (
          <div
            style={{
              padding: '10px 12px',
              background: '#ffe4e4',
              color: '#7a0000',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              border: '1px solid #ffb4b4',
            }}
          >
            ⚠ {error}
          </div>
        )}

        {/* Salva */}
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 10,
              background: '#fff',
              color: '#404751',
              border: '1px solid #c0c7d2',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 2,
              padding: '12px',
              borderRadius: 10,
              background: '#005f98',
              color: '#fff',
              border: 'none',
              fontSize: 13.5,
              fontWeight: 800,
              cursor: saving ? 'wait' : 'pointer',
              boxShadow: saving ? 'none' : '0 3px 8px rgba(0,95,152,0.3)',
              opacity: saving ? 0.6 : 1,
              fontFamily: 'inherit',
            }}
          >
            {saving ? 'Salvataggio…' : mode === 'edit' ? '💾 Salva modifiche' : '💾 Salva esercizio'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

// ---------- Sotto-componenti stile ----------

function Field({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#404751', marginBottom: 4 }}>
        {label}
        {sub && <span style={{ marginLeft: 6, color: '#707882', fontWeight: 500, fontSize: 11 }}>({sub})</span>}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #c0c7d2',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  minHeight: 60,
  lineHeight: 1.4,
}

const addBtnStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 8,
  background: '#005f98',
  color: '#fff',
  border: 'none',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  fontFamily: 'inherit',
}

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 8px 4px 10px',
  background: '#eef2ff',
  color: '#005f98',
  border: '1px solid #d0dcf0',
  borderRadius: 12,
  fontSize: 11.5,
  fontWeight: 600,
}

const chipXStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'inherit',
  fontSize: 14,
  fontWeight: 800,
  cursor: 'pointer',
  padding: '0 2px',
  lineHeight: 1,
}

const sectionStyle: React.CSSProperties = {
  border: '1px solid #dfe3ea',
  borderRadius: 10,
  padding: '8px 12px',
  background: '#fafbfc',
}

const sectionSummary: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: '#181c20',
  cursor: 'pointer',
  padding: '4px 0',
  outline: 'none',
}
