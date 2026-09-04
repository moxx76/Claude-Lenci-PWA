import { useRef, useState } from 'react'
import { Icon } from './Icon'
import {
  type DiagramJson,
  type ElementType,
  type DiagramElement,
  ELEMENT_LABELS,
  renderDiagramToSvg,
  generateElementId,
} from '../lib/svgDiagram'

interface Props {
  value: DiagramJson
  onChange: (v: DiagramJson) => void
}

const TOOLS: { group: string; items: ElementType[] }[] = [
  { group: 'Giocatori', items: ['player_blue', 'player_red', 'player_green', 'player_pink', 'player_purple', 'player_keeper', 'player_jolly'] },
  { group: 'Palloni & cerchi', items: ['ball', 'hoop'] },
  { group: 'Attrezzi', items: ['cone', 'flat_marker', 'hurdle', 'pole', 'ladder'] },
  { group: 'Frecce', items: ['arrow_pass', 'arrow_drib', 'arrow_move'] },
  { group: 'Extra', items: ['zone', 'text_label'] },
]

export function SvgFieldEditor({ value, onChange }: Props) {
  const [selectedTool, setSelectedTool] = useState<ElementType | null>(null)
  const [pendingArrow, setPendingArrow] = useState<{ x: number; y: number } | null>(null)
  const [selectedElId, setSelectedElId] = useState<string | null>(null)
  const [labelInput, setLabelInput] = useState('')
  const svgRef = useRef<SVGSVGElement | null>(null)

  const svgString = renderDiagramToSvg(value)

  const getSvgCoords = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const scaleX = value.width / rect.width
    const scaleY = value.height / rect.height
    return {
      x: Math.round((clientX - rect.left) * scaleX),
      y: Math.round((clientY - rect.top) * scaleY),
    }
  }

  const handleSvgTap = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    let clientX: number, clientY: number
    if ('touches' in e) {
      const t = e.changedTouches[0]
      if (!t) return
      clientX = t.clientX
      clientY = t.clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }
    const p = getSvgCoords(clientX, clientY)
    if (!p) return

    if (!selectedTool) {
      // Modalità selezione: trova elemento sotto tap per selezione/eliminazione
      const nearest = findNearestElement(value.elements, p.x, p.y)
      setSelectedElId(nearest?.id || null)
      if (nearest?.label !== undefined) setLabelInput(nearest.label)
      return
    }

    const meta = ELEMENT_LABELS[selectedTool]
    if (meta.needsTwoPoints) {
      if (!pendingArrow) {
        setPendingArrow(p)
      } else {
        // Chiudi freccia
        const newEl: DiagramElement = {
          id: generateElementId(),
          type: selectedTool,
          x: pendingArrow.x,
          y: pendingArrow.y,
          x2: p.x,
          y2: p.y,
        }
        onChange({ ...value, elements: [...value.elements, newEl] })
        setPendingArrow(null)
      }
    } else {
      // Piazza elemento singolo
      const defaults: Partial<DiagramElement> = {}
      if (selectedTool === 'zone') {
        defaults.w = 120
        defaults.h = 80
      }
      if (selectedTool === 'text_label') {
        const testo = window.prompt('Testo da inserire:', '')?.trim()
        if (!testo) return // annullato
        defaults.label = testo.slice(0, 32)
      }
      const newEl: DiagramElement = {
        id: generateElementId(),
        type: selectedTool,
        x: p.x,
        y: p.y,
        ...defaults,
      }
      onChange({ ...value, elements: [...value.elements, newEl] })
    }
  }

  const handleRemoveSelected = () => {
    if (!selectedElId) return
    onChange({ ...value, elements: value.elements.filter(el => el.id !== selectedElId) })
    setSelectedElId(null)
  }

  const handleUndo = () => {
    if (value.elements.length === 0) return
    onChange({ ...value, elements: value.elements.slice(0, -1) })
  }

  const handleClearAll = () => {
    if (!confirm('Cancellare TUTTI gli elementi disegnati?')) return
    onChange({ ...value, elements: [] })
    setSelectedElId(null)
  }

  const handleUpdateLabel = () => {
    if (!selectedElId) return
    const el = value.elements.find(x => x.id === selectedElId)
    if (!el) return
    const maxLen = el.type === 'text_label' ? 32 : 4
    onChange({
      ...value,
      elements: value.elements.map(x => (x.id === selectedElId ? { ...x, label: labelInput.slice(0, maxLen) } : x)),
    })
  }

  const changeField = (fieldType: DiagramJson['fieldType']) => {
    onChange({ ...value, fieldType })
  }

  const selectedEl = selectedElId ? value.elements.find(el => el.id === selectedElId) : null

  return (
    <div>
      {/* Toolbar tipo campo */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button
          onClick={() => changeField('plain')}
          style={fieldBtn(value.fieldType === 'plain')}
        >
          Campo aperto
        </button>
        <button
          onClick={() => changeField('half_top_goal')}
          style={fieldBtn(value.fieldType === 'half_top_goal')}
        >
          ½ campo + porta
        </button>
        <button
          onClick={() => changeField('two_goals')}
          style={fieldBtn(value.fieldType === 'two_goals')}
        >
          2 porte (lati corti)
        </button>
      </div>

      {/* SVG canvas */}
      <div
        style={{
          position: 'relative',
          border: `2px solid ${selectedTool ? '#005f98' : '#c0c7d2'}`,
          borderRadius: 10,
          overflow: 'hidden',
          background: '#3d9b47',
          marginBottom: 10,
          touchAction: 'manipulation',
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${value.width} ${value.height}`}
          xmlns="http://www.w3.org/2000/svg"
          onClick={handleSvgTap}
          onTouchEnd={e => {
            e.preventDefault()
            handleSvgTap(e)
          }}
          style={{ width: '100%', height: 'auto', display: 'block', cursor: selectedTool ? 'crosshair' : 'default' }}
          dangerouslySetInnerHTML={{ __html: svgString.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '') }}
        />
        {/* Overlay: cursore freccia pending */}
        {pendingArrow && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              right: 0,
              padding: '4px 8px',
              background: 'rgba(0,95,152,0.9)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              textAlign: 'center',
            }}
          >
            👆 Tap sul punto di ARRIVO della freccia (o clicca di nuovo lo strumento per annullare)
          </div>
        )}
        {/* Overlay elemento selezionato */}
        {selectedEl && !selectedTool && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '6px 10px',
              background: 'rgba(186,26,26,0.92)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <span>Elemento selezionato: {ELEMENT_LABELS[selectedEl.type].label}</span>
            <button
              onClick={handleRemoveSelected}
              style={{
                background: '#fff',
                color: '#ba1a1a',
                border: 'none',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🗑 Elimina
            </button>
          </div>
        )}
      </div>

      {/* Toolbar strumenti */}
      <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
        {TOOLS.map(group => (
          <div key={group.group}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#707882', marginBottom: 4, letterSpacing: 0.3, textTransform: 'uppercase' }}>
              {group.group}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {group.items.map(t => {
                const meta = ELEMENT_LABELS[t]
                const isActive = selectedTool === t
                return (
                  <button
                    key={t}
                    onClick={() => {
                      setSelectedTool(isActive ? null : t)
                      setPendingArrow(null)
                      setSelectedElId(null)
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: isActive ? `2px solid #005f98` : '1px solid #c0c7d2',
                      background: isActive ? '#e0f0ff' : '#fff',
                      color: '#181c20',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontFamily: 'inherit',
                      minWidth: 68,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: t === 'ladder' ? 22 : 18,
                        height: t === 'flat_marker' ? 8 : t === 'pole' ? 22 : t === 'hurdle' ? 10 : 18,
                        borderRadius:
                          t.startsWith('player_') || t === 'hoop' || t === 'ball'
                            ? '50%'
                            : t === 'flat_marker'
                            ? '50%'
                            : t === 'pole'
                            ? 2
                            : 3,
                        background: meta.color,
                        border: '1px solid #fff',
                        boxShadow: '0 0 0 1px rgba(0,0,0,0.1)',
                      }}
                    />
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Editor label elemento selezionato */}
      {selectedEl && (selectedEl.type.startsWith('player_') || selectedEl.type === 'text_label') && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10, padding: 8, background: '#f9fafb', borderRadius: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#404751', whiteSpace: 'nowrap' }}>
            {selectedEl.type === 'text_label' ? 'Testo:' : 'Etichetta:'}
          </span>
          <input
            value={labelInput}
            onChange={e => {
              const maxLen = selectedEl.type === 'text_label' ? 32 : 4
              setLabelInput(e.target.value.slice(0, maxLen))
            }}
            placeholder={selectedEl.type === 'text_label' ? 'Es. Pressing alto, Zona 3' : 'A, 1, B'}
            maxLength={selectedEl.type === 'text_label' ? 32 : 4}
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #c0c7d2',
              fontSize: 12.5,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleUpdateLabel}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              background: '#005f98',
              color: '#fff',
              border: 'none',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Salva
          </button>
        </div>
      )}

      {/* Azioni globali */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={handleUndo}
          disabled={value.elements.length === 0}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #c0c7d2',
            background: '#fff',
            color: '#404751',
            fontSize: 12,
            fontWeight: 700,
            cursor: value.elements.length === 0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            opacity: value.elements.length === 0 ? 0.5 : 1,
            fontFamily: 'inherit',
          }}
        >
          <Icon name="undo" size={14} color="#404751" />
          Annulla ultimo
        </button>
        <button
          onClick={handleClearAll}
          disabled={value.elements.length === 0}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #ffb4b4',
            background: '#fff',
            color: '#ba1a1a',
            fontSize: 12,
            fontWeight: 700,
            cursor: value.elements.length === 0 ? 'not-allowed' : 'pointer',
            opacity: value.elements.length === 0 ? 0.5 : 1,
            fontFamily: 'inherit',
          }}
        >
          🗑 Cancella tutto
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#707882' }}>
          {value.elements.length} elementi
        </span>
      </div>

      {/* Hint */}
      <div
        style={{
          marginTop: 10,
          padding: '8px 10px',
          background: '#f0f7ff',
          borderRadius: 6,
          fontSize: 11,
          color: '#004a78',
          lineHeight: 1.4,
        }}
      >
        💡 <strong>Come usare</strong>: scegli uno strumento → tap sul campo per piazzare. Per le frecce servono <strong>2 tap</strong> (partenza + arrivo). Per <strong>Testo</strong> il testo viene chiesto subito al piazzamento. Deseleziona lo strumento → tap su un elemento per selezionarlo, modificarne l'etichetta o eliminarlo.
      </div>
    </div>
  )
}

function findNearestElement(elements: DiagramElement[], x: number, y: number): DiagramElement | null {
  let best: DiagramElement | null = null
  let bestDist = 900
  for (const el of elements) {
    // Per frecce controllo distanza dal punto medio
    const ex = el.x2 !== undefined ? (el.x + el.x2) / 2 : el.x
    const ey = el.y2 !== undefined ? (el.y + el.y2) / 2 : el.y
    const d = Math.pow(ex - x, 2) + Math.pow(ey - y, 2)
    if (d < bestDist) {
      bestDist = d
      best = el
    }
  }
  return best
}

const fieldBtn = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '6px 8px',
  borderRadius: 8,
  border: active ? '2px solid #005f98' : '1px solid #c0c7d2',
  background: active ? '#e0f0ff' : '#fff',
  color: active ? '#004a78' : '#404751',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
})
