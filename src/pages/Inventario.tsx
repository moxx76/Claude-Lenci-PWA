import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { Icon } from '../components/Icon'
import { InventoryTeamSheet } from '../components/InventoryTeamSheet'
import { sortTeamsByAge } from '../lib/teamOrder'

/**
 * M21 — Pagina elenco inventario per squadra.
 * Mostra tutte le squadre visibili all'utente con contatore "voci da
 * rifornire". Tap su squadra → InventoryTeamSheet con dettaglio.
 *
 * Visibilità pagina: canSeeInventario in Layout (admin + director +
 * manager + chi è nello staff di almeno una squadra).
 */

interface ItemPreview {
  id: string
  name: string
  category: string
  kind: 'singolo' | 'quantita'
  current_quantity: number
  min_quantity: number
}

interface TeamRow {
  id: string
  name: string
  category: string | null
  color: string | null
  total: number
  below_min: number
  last_updated: string | null
  items: ItemPreview[]
}

const CAT_META: Record<string, { label: string; icon: string; color: string }> = {
  maglie: { label: 'Maglie', icon: 'checkroom', color: '#004a78' },
  pettorine: { label: 'Pettorine', icon: 'style', color: '#8e6300' },
  materiale_allenamento: { label: 'Materiale', icon: 'sports_soccer', color: '#006e25' },
  borsa_medica: { label: 'Borsa medica', icon: 'medical_services', color: '#93000a' },
  altro: { label: 'Altro', icon: 'inventory_2', color: '#404751' },
}

export function Inventario() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<TeamRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openTeamId, setOpenTeamId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    // 1. Prendo le squadre che l'utente può vedere (RLS su teams)
    const { data: teams, error: tErr } = await supabase
      .from('teams')
      .select('id, name, category, color')
    if (tErr) {
      setError(tErr.message); setLoading(false); return
    }
    // 2. Prendo le voci (RLS applicata) con nome/qty/categoria per anteprima inline
    const { data: items, error: iErr } = await supabase
      .from('team_inventory_items')
      .select('id, team_id, name, category, kind, current_quantity, min_quantity, updated_at, sort_order')
      .order('category')
      .order('sort_order')
      .order('name')
    if (iErr) {
      setError(iErr.message); setLoading(false); return
    }
    const stats: Record<string, { total: number; belowMin: number; lastUpdated: string | null; items: ItemPreview[] }> = {}
    for (const it of (items || []) as any[]) {
      const s = stats[it.team_id] ||= { total: 0, belowMin: 0, lastUpdated: null, items: [] }
      s.total++
      if ((it.current_quantity ?? 0) < (it.min_quantity ?? 0)) s.belowMin++
      if (!s.lastUpdated || it.updated_at > s.lastUpdated) s.lastUpdated = it.updated_at
      s.items.push({
        id: it.id,
        name: it.name,
        category: it.category,
        kind: it.kind,
        current_quantity: it.current_quantity,
        min_quantity: it.min_quantity,
      })
    }
    const combined: TeamRow[] = (teams || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      color: t.color,
      total: stats[t.id]?.total ?? 0,
      below_min: stats[t.id]?.belowMin ?? 0,
      last_updated: stats[t.id]?.lastUpdated ?? null,
      items: stats[t.id]?.items ?? [],
    }))
    setRows(sortTeamsByAge(combined))
    setLoading(false)
  }

  useEffect(() => {
    if (profile?.id) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  const totalBelowMin = useMemo(() => rows.reduce((a, r) => a + r.below_min, 0), [rows])

  return (
    <div className="max-w-md md:max-w-2xl mx-auto flex flex-col" style={{ padding: '20px 18px', gap: 16 }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg,#005f98,#0078bf)',
        color: '#fff', borderRadius: 18, padding: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="inventory_2" size={24} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 20, margin: 0 }}>
              Inventario materiale
            </h1>
            <p style={{ fontSize: 12.5, opacity: 0.9, margin: '3px 0 0' }}>
              Scegli una squadra per gestire maglie, pettorine, borsa medica e altro.
            </p>
          </div>
        </div>
        {totalBelowMin > 0 && (
          <div style={{
            marginTop: 14, background: 'rgba(147,0,10,0.85)',
            padding: '8px 12px', borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 12.5, fontWeight: 700,
          }}>
            <Icon name="warning" size={16} color="#fff" />
            {totalBelowMin} {totalBelowMin === 1 ? 'voce' : 'voci'} sotto soglia in {rows.filter(r => r.below_min > 0).length} squadre
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: '#ffdad6', color: '#93000a', padding: 12, borderRadius: 10, fontSize: 12 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#707882', fontSize: 13 }}>
          Carico squadre…
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div style={{
          background: '#fff', borderRadius: 14, padding: 30, textAlign: 'center',
          boxShadow: '0 6px 16px rgba(0,120,191,0.05)',
        }}>
          <Icon name="info" size={32} color="#c0c7d2" />
          <p style={{ margin: '10px 0 0', fontSize: 13, color: '#707882' }}>
            Nessuna squadra visibile. Contatta la segreteria.
          </p>
        </div>
      )}

      {!loading && rows.map(team => (
        <div
          key={team.id}
          style={{
            background: '#fff', borderRadius: 14,
            borderLeft: `4px solid ${team.color || '#005f98'}`,
            boxShadow: '0 6px 16px rgba(0,120,191,0.05)',
            overflow: 'hidden',
          }}
        >
          {/* Header squadra cliccabile → apre lo sheet dettaglio (add/edit) */}
          <button
            onClick={() => setOpenTeamId(team.id)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              textAlign: 'left', fontFamily: 'inherit', width: '100%',
              display: 'flex', alignItems: 'center', gap: 12, padding: 14,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: '#181c20' }}>
                {team.name}
              </div>
              <div style={{ fontSize: 11, color: '#707882', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {team.category && <span>{team.category}</span>}
                <span>·</span>
                <span>{team.total === 0 ? 'Nessuna voce — tocca per aggiungere' : `${team.total} ${team.total === 1 ? 'voce' : 'voci'}`}</span>
                {team.last_updated && (
                  <>
                    <span>·</span>
                    <span>aggiornato {new Date(team.last_updated).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}</span>
                  </>
                )}
              </div>
            </div>
            {team.below_min > 0 && (
              <div style={{
                background: '#ffdad6', color: '#93000a',
                padding: '4px 10px', borderRadius: 999,
                fontSize: 11.5, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4,
                flexShrink: 0,
              }}>
                <Icon name="warning" size={12} color="#93000a" />
                {team.below_min}
              </div>
            )}
            <Icon name="chevron_right" size={18} color="#c0c7d2" />
          </button>

          {/* Lista voci inline (sotto la squadra, raggruppate per categoria).
              Tap su una voce → stesso sheet dettaglio pre-focalizzato sulla
              categoria. Mostro solo nome + stato compatti; +/-, edit, note
              restano nello sheet per non appesantire la lista. */}
          {team.items.length > 0 && (
            <div style={{ borderTop: '1px solid #eef0f5' }}>
              {groupByCategory(team.items).map(([cat, catItems]) => {
                const meta = CAT_META[cat] || CAT_META.altro
                return (
                  <div key={cat} style={{ padding: '8px 14px', borderBottom: '1px solid #f6f7fb' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 10, fontWeight: 800, color: meta.color,
                      textTransform: 'uppercase', letterSpacing: 0.3,
                      marginBottom: 4,
                    }}>
                      <Icon name={meta.icon} size={11} color={meta.color} />
                      {meta.label}
                    </div>
                    {catItems.map(it => {
                      const belowMin = it.current_quantity < it.min_quantity
                      return (
                        <button
                          key={it.id}
                          onClick={() => setOpenTeamId(team.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '4px 2px', width: '100%',
                            background: 'transparent', border: 'none',
                            cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                          }}
                        >
                          <span style={{ flex: 1, fontSize: 12.5, color: '#181c20', fontWeight: 600 }}>
                            {it.name}
                          </span>
                          <span style={{
                            fontSize: 11, color: belowMin ? '#93000a' : '#404751',
                            fontWeight: belowMin ? 800 : 600,
                          }}>
                            {it.kind === 'quantita'
                              ? `${it.current_quantity}${it.min_quantity > 0 ? ` / ${it.min_quantity}` : ''}`
                              : it.current_quantity > 0 ? 'ok' : 'assente'}
                          </span>
                          {belowMin && (
                            <span style={{
                              background: '#ffdad6', color: '#93000a',
                              padding: '1px 6px', borderRadius: 999,
                              fontSize: 9, fontWeight: 800, letterSpacing: 0.3,
                            }}>DA RIFORNIRE</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}

      {openTeamId && (() => {
        const t = rows.find(r => r.id === openTeamId)
        return (
          <InventoryTeamSheet
            open={!!openTeamId}
            onClose={() => setOpenTeamId(null)}
            teamId={openTeamId}
            teamName={t?.name || 'Squadra'}
            teamColor={t?.color}
            onChanged={load}
          />
        )
      })()}
    </div>
  )
}

// Raggruppa items per categoria mantenendo l'ordine di CAT_META
function groupByCategory(items: ItemPreview[]): Array<[string, ItemPreview[]]> {
  const map: Record<string, ItemPreview[]> = {}
  for (const it of items) {
    if (!map[it.category]) map[it.category] = []
    map[it.category].push(it)
  }
  const order = ['maglie', 'pettorine', 'materiale_allenamento', 'borsa_medica', 'altro']
  return order.filter(c => map[c]?.length).map(c => [c, map[c]] as [string, ItemPreview[]])
}

export default Inventario
