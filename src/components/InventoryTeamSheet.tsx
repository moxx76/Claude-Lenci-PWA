import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { Icon } from '../components/Icon'
import { BottomSheet } from './BottomSheet'

/**
 * M21 — Sheet dettaglio inventario materiale di UNA squadra.
 * Mostrato sia da /inventario (lista squadre) sia da TeamDetail (tab).
 *
 * Granularità:
 *  - kind='singolo' → 1 pezzo (es. maglia #10, bottiglia ghiaccio spray). Il
 *    conteggio è 0 o 1; min=1 di default (se perso, badge rosso).
 *  - kind='quantita' → contatore libero (palloni, coni, pettorine). Soglia
 *    min_quantity determina il badge.
 *
 * Permessi: scrittura allo staff del team + admin via RLS. UI mostra
 * sempre il pulsante salva: se RLS blocca ritorna errore esplicito
 * (vedi silent-fail pattern in ways-of-working).
 */

const CATEGORIES: Array<{ id: Category; label: string; icon: string; color: string; bg: string }> = [
  { id: 'maglie', label: 'Maglie', icon: 'checkroom', color: '#004a78', bg: '#cfe5ff' },
  { id: 'pettorine', label: 'Pettorine', icon: 'style', color: '#8e6300', bg: 'rgba(255,209,0,0.2)' },
  { id: 'materiale_allenamento', label: 'Materiale allenamento', icon: 'sports_soccer', color: '#006e25', bg: 'rgba(128,249,139,0.35)' },
  { id: 'borsa_medica', label: 'Borsa medica', icon: 'medical_services', color: '#93000a', bg: '#ffdad6' },
  { id: 'altro', label: 'Altro', icon: 'inventory_2', color: '#404751', bg: '#e6e8ee' },
]

type Category = 'maglie' | 'pettorine' | 'materiale_allenamento' | 'borsa_medica' | 'altro'
type Kind = 'singolo' | 'quantita'
type Status = 'ok' | 'usurato' | 'danneggiato' | 'perso' | 'in_riparazione' | null

interface InventoryItem {
  id: string
  team_id: string
  category: Category
  kind: Kind
  name: string
  current_quantity: number
  min_quantity: number
  status: Status
  shirt_number: number | null
  assigned_player_id: string | null
  expiry_date: string | null
  notes: string | null
  sort_order: number
  updated_at: string
  updated_by: string | null
  updated_by_name?: string | null
}

interface InventoryTeamSheetProps {
  open: boolean
  onClose: () => void
  teamId: string
  teamName: string
  teamColor?: string | null
  /**
   * Chiamato dopo ogni modifica salvata — serve al parent per aggiornare
   * il contatore "voci da rifornire" senza dover riaprire.
   */
  onChanged?: () => void
}

export function InventoryTeamSheet({ open, onClose, teamId, teamName, teamColor, onChanged }: InventoryTeamSheetProps) {
  const { profile } = useAuth()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addingCategory, setAddingCategory] = useState<Category | null>(null)
  const canWrite = !profile?.is_readonly

  const load = async () => {
    if (!teamId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('team_inventory_items')
      .select('*, updater:profiles!team_inventory_items_updated_by_fkey(full_name)')
      .eq('team_id', teamId)
      .order('category')
      .order('sort_order')
      .order('name')
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    const normalized: InventoryItem[] = (data || []).map((r: any) => ({
      ...r,
      updated_by_name: r.updater?.full_name || null,
    }))
    setItems(normalized)
    setLoading(false)
  }

  useEffect(() => {
    if (open && teamId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, teamId])

  // Raggruppo per categoria mantenendo l'ordine di CATEGORIES
  const grouped = useMemo(() => {
    const map: Record<Category, InventoryItem[]> = {
      maglie: [], pettorine: [], materiale_allenamento: [], borsa_medica: [], altro: [],
    }
    for (const it of items) map[it.category].push(it)
    return map
  }, [items])

  const totalBelowMin = useMemo(
    () => items.filter(it => it.current_quantity < it.min_quantity).length,
    [items],
  )

  if (!open) return null

  return (
    <BottomSheet open={open} onClose={onClose} title={`Inventario ${teamName}`}>
      <div style={{ padding: '0 18px 24px' }}>
        {/* Riepilogo in testa */}
        <div style={{
          background: '#fff', borderRadius: 12, padding: 12, marginBottom: 14,
          borderLeft: `4px solid ${teamColor || '#005f98'}`,
          boxShadow: '0 2px 8px rgba(0,120,191,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 12, color: '#404751' }}>
            <strong style={{ fontSize: 14 }}>{items.length}</strong> voci totali
          </div>
          {totalBelowMin > 0 && (
            <div style={{
              background: '#ffdad6', color: '#93000a',
              padding: '4px 10px', borderRadius: 999,
              fontSize: 11.5, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <Icon name="warning" size={13} color="#93000a" />
              {totalBelowMin} da rifornire
            </div>
          )}
        </div>

        {error && (
          <div style={{
            background: '#ffdad6', color: '#93000a',
            padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12,
          }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: 30, color: '#707882', fontSize: 13 }}>
            Carico inventario…
          </div>
        )}

        {!loading && CATEGORIES.map(cat => (
          <CategoryBlock
            key={cat.id}
            category={cat}
            items={grouped[cat.id]}
            canWrite={canWrite}
            onAdd={() => setAddingCategory(cat.id)}
            onChanged={() => { load(); onChanged?.() }}
          />
        ))}

        {addingCategory && (
          <AddItemSheet
            open={!!addingCategory}
            onClose={() => setAddingCategory(null)}
            teamId={teamId}
            category={addingCategory}
            onSaved={() => { setAddingCategory(null); load(); onChanged?.() }}
          />
        )}
      </div>
    </BottomSheet>
  )
}

// ============================================================
// CATEGORY BLOCK
// ============================================================

function CategoryBlock({
  category, items, canWrite, onAdd, onChanged,
}: {
  category: typeof CATEGORIES[number]
  items: InventoryItem[]
  canWrite: boolean
  onAdd: () => void
  onChanged: () => void
}) {
  const belowMin = items.filter(it => it.current_quantity < it.min_quantity).length

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 2px 8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: category.bg, color: category.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={category.icon} size={16} color={category.color} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#181c20' }}>{category.label}</div>
            <div style={{ fontSize: 10.5, color: '#707882' }}>
              {items.length === 0 ? 'Nessuna voce' : `${items.length} voci`}
              {belowMin > 0 && <span style={{ color: '#93000a', fontWeight: 700 }}> · {belowMin} da rifornire</span>}
            </div>
          </div>
        </div>
        {canWrite && (
          <button
            onClick={onAdd}
            style={{
              background: '#f0f9ff', color: '#005f98', border: '1px solid #cfe5ff',
              padding: '6px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Icon name="add" size={13} color="#005f98" />
            Aggiungi
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div style={{
          padding: '12px 14px', borderRadius: 8, border: '1px dashed #c0c7d2',
          fontSize: 11.5, color: '#707882', fontStyle: 'italic', textAlign: 'center',
        }}>
          Nessuna voce in questa categoria
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map(it => <ItemRow key={it.id} item={it} canWrite={canWrite} onChanged={onChanged} />)}
        </div>
      )}
    </div>
  )
}

// ============================================================
// ITEM ROW
// ============================================================

function ItemRow({ item, canWrite, onChanged }: { item: InventoryItem; canWrite: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [currentQty, setCurrentQty] = useState(item.current_quantity)
  const [minQty, setMinQty] = useState(item.min_quantity)
  const [name, setName] = useState(item.name)
  const [status, setStatus] = useState<Status>(item.status)
  const [notes, setNotes] = useState(item.notes || '')

  const belowMin = item.current_quantity < item.min_quantity

  // Resetta i form state se item cambia da fuori (reload parent)
  useEffect(() => {
    setCurrentQty(item.current_quantity)
    setMinQty(item.min_quantity)
    setName(item.name)
    setStatus(item.status)
    setNotes(item.notes || '')
  }, [item.id, item.updated_at])

  const quickDelta = async (delta: number) => {
    const newVal = Math.max(0, currentQty + delta)
    if (newVal === currentQty) return
    setSaving(true)
    setErr(null)
    const { data, error } = await supabase
      .from('team_inventory_items')
      .update({ current_quantity: newVal })
      .eq('id', item.id)
      .select('id')
    setSaving(false)
    if (error || !data || data.length === 0) {
      setErr(error?.message || 'Nessuna riga aggiornata (permessi insufficienti)')
      return
    }
    setCurrentQty(newVal)
    onChanged()
  }

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setErr('Il nome è obbligatorio'); return }
    setSaving(true)
    setErr(null)
    const { data, error } = await supabase
      .from('team_inventory_items')
      .update({
        name: trimmed,
        current_quantity: currentQty,
        min_quantity: minQty,
        status: status,
        notes: notes.trim() || null,
      })
      .eq('id', item.id)
      .select('id')
    setSaving(false)
    if (error || !data || data.length === 0) {
      setErr(error?.message || 'Modifica non salvata: permessi insufficienti')
      return
    }
    setEditing(false)
    onChanged()
  }

  const remove = async () => {
    if (!confirm(`Eliminare "${item.name}"?`)) return
    setSaving(true)
    setErr(null)
    const { data, error } = await supabase
      .from('team_inventory_items')
      .delete()
      .eq('id', item.id)
      .select('id')
    setSaving(false)
    if (error || !data || data.length === 0) {
      setErr(error?.message || 'Eliminazione non riuscita: permessi insufficienti')
      return
    }
    onChanged()
  }

  const lastUpdatedLabel = item.updated_by_name
    ? `${item.updated_by_name}, ${new Date(item.updated_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}`
    : new Date(item.updated_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })

  if (editing) {
    return (
      <div style={{
        background: '#fff', borderRadius: 10,
        border: '1.5px solid #005f98', padding: 12,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nome voce"
          style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #c0c7d2', fontSize: 13 }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <label style={{ fontSize: 11, color: '#404751' }}>
            Quantità attuale
            <input
              type="number"
              min={0}
              value={currentQty}
              onChange={e => setCurrentQty(Math.max(0, parseInt(e.target.value) || 0))}
              style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: '1px solid #c0c7d2', fontSize: 13, marginTop: 3 }}
            />
          </label>
          <label style={{ fontSize: 11, color: '#404751' }}>
            Soglia minima
            <input
              type="number"
              min={0}
              value={minQty}
              onChange={e => setMinQty(Math.max(0, parseInt(e.target.value) || 0))}
              style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: '1px solid #c0c7d2', fontSize: 13, marginTop: 3 }}
            />
          </label>
        </div>
        {item.kind === 'singolo' && (
          <label style={{ fontSize: 11, color: '#404751' }}>
            Stato
            <select
              value={status || ''}
              onChange={e => setStatus(e.target.value as Status || null)}
              style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: '1px solid #c0c7d2', fontSize: 13, marginTop: 3 }}
            >
              <option value="">— non specificato —</option>
              <option value="ok">OK</option>
              <option value="usurato">Usurato</option>
              <option value="danneggiato">Danneggiato</option>
              <option value="in_riparazione">In riparazione</option>
              <option value="perso">Perso</option>
            </select>
          </label>
        )}
        <label style={{ fontSize: 11, color: '#404751' }}>
          Note
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: '1px solid #c0c7d2', fontSize: 13, marginTop: 3, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </label>
        {err && <div style={{ color: '#93000a', fontSize: 11.5 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <button
            onClick={save}
            disabled={saving}
            style={{
              flex: 1, padding: '9px 12px', borderRadius: 7, border: 'none',
              background: '#006e25', color: '#fff', fontSize: 12.5, fontWeight: 800,
              cursor: saving ? 'wait' : 'pointer',
            }}
          >
            {saving ? 'Salvo…' : 'Salva'}
          </button>
          <button
            onClick={() => { setEditing(false); setErr(null) }}
            disabled={saving}
            style={{
              padding: '9px 12px', borderRadius: 7, border: '1px solid #c0c7d2',
              background: '#fff', color: '#404751', fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Annulla
          </button>
          <button
            onClick={remove}
            disabled={saving}
            style={{
              padding: '9px 12px', borderRadius: 7, border: '1px solid #ffbdb6',
              background: '#fff', color: '#93000a', fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Icon name="delete" size={14} color="#93000a" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: 10,
      display: 'flex', alignItems: 'center', gap: 10,
      border: belowMin ? '1.5px solid #ffbdb6' : '1px solid #e6e8ee',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#181c20', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span>{item.name}</span>
          {belowMin && (
            <span style={{
              background: '#ffdad6', color: '#93000a',
              padding: '1px 6px', borderRadius: 999,
              fontSize: 9, fontWeight: 800, letterSpacing: 0.3,
            }}>DA RIFORNIRE</span>
          )}
          {item.status && item.status !== 'ok' && (
            <span style={{
              background: '#ffe8c7', color: '#8e6300',
              padding: '1px 6px', borderRadius: 999,
              fontSize: 9, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase',
            }}>{item.status.replace('_', ' ')}</span>
          )}
        </div>
        <div style={{ fontSize: 10.5, color: '#707882', marginTop: 2 }}>
          {item.kind === 'quantita'
            ? `${item.current_quantity}${item.min_quantity > 0 ? ` / min ${item.min_quantity}` : ''}`
            : item.current_quantity > 0 ? 'presente' : 'assente'}
          <span style={{ margin: '0 6px', color: '#c0c7d2' }}>·</span>
          <span>ultima verifica: {lastUpdatedLabel}</span>
        </div>
        {err && <div style={{ color: '#93000a', fontSize: 11, marginTop: 4 }}>{err}</div>}
      </div>
      {canWrite && item.kind === 'quantita' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => quickDelta(-1)}
            disabled={saving || currentQty === 0}
            style={{
              width: 28, height: 28, borderRadius: 7, border: '1px solid #c0c7d2',
              background: '#fff', fontSize: 15, cursor: 'pointer', fontWeight: 700,
            }}
          >−</button>
          <span style={{ minWidth: 26, textAlign: 'center', fontSize: 13, fontWeight: 800 }}>
            {currentQty}
          </span>
          <button
            onClick={() => quickDelta(1)}
            disabled={saving}
            style={{
              width: 28, height: 28, borderRadius: 7, border: '1px solid #c0c7d2',
              background: '#fff', fontSize: 15, cursor: 'pointer', fontWeight: 700,
            }}
          >+</button>
        </div>
      )}
      {canWrite && item.kind === 'singolo' && (
        <button
          onClick={() => quickDelta(currentQty > 0 ? -1 : 1)}
          disabled={saving}
          style={{
            width: 32, height: 32, borderRadius: 8, border: '1px solid #c0c7d2',
            background: currentQty > 0 ? '#dcf5df' : '#ffdad6',
            color: currentQty > 0 ? '#006e25' : '#93000a',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title={currentQty > 0 ? 'Segna assente' : 'Segna presente'}
        >
          <Icon name={currentQty > 0 ? 'check' : 'close'} size={16} color={currentQty > 0 ? '#006e25' : '#93000a'} />
        </button>
      )}
      {canWrite && (
        <button
          onClick={() => setEditing(true)}
          style={{
            width: 28, height: 28, borderRadius: 7, border: '1px solid #c0c7d2',
            background: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="Modifica"
        >
          <Icon name="edit" size={13} color="#404751" />
        </button>
      )}
    </div>
  )
}

// ============================================================
// ADD ITEM SHEET
// ============================================================

function AddItemSheet({
  open, onClose, teamId, category, onSaved,
}: {
  open: boolean
  onClose: () => void
  teamId: string
  category: Category
  onSaved: () => void
}) {
  const [kind, setKind] = useState<Kind>(category === 'maglie' || category === 'borsa_medica' ? 'singolo' : 'quantita')
  const [name, setName] = useState('')
  const [currentQty, setCurrentQty] = useState(1)
  const [minQty, setMinQty] = useState(1)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const catLabel = CATEGORIES.find(c => c.id === category)?.label || category

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setErr('Il nome è obbligatorio'); return }
    setSaving(true)
    setErr(null)
    const { data, error } = await supabase
      .from('team_inventory_items')
      .insert({
        team_id: teamId,
        category,
        kind,
        name: trimmed,
        current_quantity: kind === 'singolo' ? 1 : currentQty,
        min_quantity: kind === 'singolo' ? 1 : minQty,
        notes: notes.trim() || null,
      })
      .select('id')
    setSaving(false)
    if (error || !data || data.length === 0) {
      setErr(error?.message || 'Nessuna riga inserita: permessi insufficienti')
      return
    }
    onSaved()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={`Nuova voce — ${catLabel}`}>
      <div style={{ padding: '0 18px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: '#404751', fontWeight: 700, display: 'block', marginBottom: 6 }}>
            Tipo
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setKind('singolo')}
              style={{
                flex: 1, padding: '10px', borderRadius: 7,
                border: kind === 'singolo' ? '2px solid #005f98' : '1px solid #c0c7d2',
                background: kind === 'singolo' ? '#f0f9ff' : '#fff',
                color: '#181c20', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ fontWeight: 800 }}>Pezzo singolo</div>
              <div style={{ fontSize: 10, color: '#707882', marginTop: 2 }}>
                es. "Maglia #10", "Spray ghiaccio"
              </div>
            </button>
            <button
              onClick={() => setKind('quantita')}
              style={{
                flex: 1, padding: '10px', borderRadius: 7,
                border: kind === 'quantita' ? '2px solid #005f98' : '1px solid #c0c7d2',
                background: kind === 'quantita' ? '#f0f9ff' : '#fff',
                color: '#181c20', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ fontWeight: 800 }}>Quantità</div>
              <div style={{ fontSize: 10, color: '#707882', marginTop: 2 }}>
                es. "Palloni n.4" x15
              </div>
            </button>
          </div>
        </div>

        <label style={{ fontSize: 11, color: '#404751', fontWeight: 700 }}>
          Nome voce
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={kind === 'singolo' ? 'es. Maglia #10 gialla' : 'es. Palloni size 4'}
            style={{ width: '100%', padding: '9px 10px', borderRadius: 7, border: '1px solid #c0c7d2', fontSize: 13, marginTop: 4 }}
          />
        </label>

        {kind === 'quantita' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ fontSize: 11, color: '#404751', fontWeight: 700 }}>
              Quantità attuale
              <input
                type="number"
                min={0}
                value={currentQty}
                onChange={e => setCurrentQty(Math.max(0, parseInt(e.target.value) || 0))}
                style={{ width: '100%', padding: '9px 10px', borderRadius: 7, border: '1px solid #c0c7d2', fontSize: 13, marginTop: 4 }}
              />
            </label>
            <label style={{ fontSize: 11, color: '#404751', fontWeight: 700 }}>
              Soglia minima
              <input
                type="number"
                min={0}
                value={minQty}
                onChange={e => setMinQty(Math.max(0, parseInt(e.target.value) || 0))}
                style={{ width: '100%', padding: '9px 10px', borderRadius: 7, border: '1px solid #c0c7d2', fontSize: 13, marginTop: 4 }}
              />
            </label>
          </div>
        )}

        <label style={{ fontSize: 11, color: '#404751', fontWeight: 700 }}>
          Note (opzionale)
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="dettagli, posizione…"
            style={{ width: '100%', padding: '9px 10px', borderRadius: 7, border: '1px solid #c0c7d2', fontSize: 13, marginTop: 4, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </label>

        {err && (
          <div style={{ background: '#ffdad6', color: '#93000a', padding: 10, borderRadius: 7, fontSize: 12 }}>
            {err}
          </div>
        )}

        <button
          onClick={save}
          disabled={saving}
          style={{
            marginTop: 6, padding: '12px', borderRadius: 8,
            background: '#005f98', color: '#fff', border: 'none',
            fontSize: 13.5, fontWeight: 800, cursor: saving ? 'wait' : 'pointer',
          }}
        >
          {saving ? 'Salvo…' : 'Aggiungi'}
        </button>
      </div>
    </BottomSheet>
  )
}
