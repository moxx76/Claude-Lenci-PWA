import { useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'

// Tabelle raggruppate per categoria
const TABLE_GROUPS: Array<{ key: string; label: string; icon: string; color: string; tables: string[]; description: string }> = [
  {
    key: 'anagrafica',
    label: 'Anagrafica',
    icon: 'group',
    color: '#005f98',
    description: 'Utenti staff, genitori, squadre, giocatori',
    tables: ['profiles', 'clubs', 'teams', 'players'],
  },
  {
    key: 'eventi',
    label: 'Eventi',
    icon: 'event',
    color: '#7a0071',
    description: 'Allenamenti, partite, programmi',
    tables: ['trainings', 'matches'],
  },
  {
    key: 'presenze',
    label: 'Presenze e convocazioni',
    icon: 'how_to_reg',
    color: '#00a86b',
    description: 'Firme presenze allenamenti, convocazioni partite, statistiche',
    tables: ['attendances', 'convocations', 'event_responses', 'match_player_stats'],
  },
  {
    key: 'valutazioni',
    label: 'Valutazioni e obiettivi',
    icon: 'analytics',
    color: '#c1006c',
    description: 'Schede tecniche giocatori, obiettivi, provvedimenti disciplinari',
    tables: ['player_assessments', 'player_goals', 'disciplinary_records'],
  },
  {
    key: 'comunicazioni',
    label: 'Comunicazioni',
    icon: 'campaign',
    color: '#ff6b00',
    description: 'Annunci pubblicati (esclude notifiche per privacy e dimensione)',
    tables: ['announcements'],
  },
  {
    key: 'pagamenti',
    label: 'Pagamenti',
    icon: 'payments',
    color: '#8e6300',
    description: 'Movimenti economici registrati',
    tables: ['payments'],
  },
]

interface Props {
  open: boolean
  onClose: () => void
}

interface TableStatus {
  table: string
  status: 'pending' | 'loading' | 'done' | 'error'
  count?: number
  error?: string
}

export function DatabaseBackupSheet({ open, onClose }: Props) {
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(TABLE_GROUPS.map(g => [g.key, true]))
  )
  const [running, setRunning] = useState(false)
  const [statuses, setStatuses] = useState<TableStatus[]>([])
  const [done, setDone] = useState(false)
  const [totalRecords, setTotalRecords] = useState(0)

  const toggle = (key: string) => {
    if (running) return
    setSelected(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const generateBackup = async () => {
    setRunning(true)
    setDone(false)
    setTotalRecords(0)

    // Raccolgo tutte le tabelle da esportare
    const tables: string[] = []
    for (const g of TABLE_GROUPS) {
      if (selected[g.key]) tables.push(...g.tables)
    }
    const initialStatuses: TableStatus[] = tables.map(t => ({ table: t, status: 'pending' }))
    setStatuses(initialStatuses)

    const backup: any = {
      metadata: {
        export_date: new Date().toISOString(),
        club: 'ASD Lenci Poirino',
        version: 1,
        tables_included: tables,
        generated_by: 'Backup on-demand da app',
      },
      data: {},
    }

    let totRecs = 0
    const finalStatuses = [...initialStatuses]

    for (let i = 0; i < tables.length; i++) {
      const t = tables[i]
      finalStatuses[i] = { ...finalStatuses[i], status: 'loading' }
      setStatuses([...finalStatuses])
      try {
        const { data, error } = await supabase.from(t).select('*')
        if (error) throw error
        backup.data[t] = data ?? []
        const cnt = (data ?? []).length
        totRecs += cnt
        finalStatuses[i] = { table: t, status: 'done', count: cnt }
        setStatuses([...finalStatuses])
      } catch (e: any) {
        console.error(`Backup ${t} err:`, e)
        finalStatuses[i] = { table: t, status: 'error', error: e.message || 'errore' }
        setStatuses([...finalStatuses])
      }
    }

    setTotalRecords(totRecs)

    // Scarico il JSON
    const now = new Date()
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`
    const filename = `lenci_backup_${stamp}.json`
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)

    setDone(true)
    setRunning(false)
  }

  const totalTables = TABLE_GROUPS.filter(g => selected[g.key]).flatMap(g => g.tables).length

  return (
    <BottomSheet open={open} onClose={onClose} title="🗄 Backup del database">
      <div style={{ padding: '4px 20px 24px' }}>
        <p style={{ fontSize: 12, color: '#404751', lineHeight: 1.5, margin: '0 0 12px' }}>
          Scarica un file JSON contenente tutti i dati del club selezionati. Il file può essere conservato in cloud (Drive, Dropbox) come copia di sicurezza aggiuntiva rispetto ai backup automatici di Supabase.
        </p>

        <div style={{
          background: '#eef4fb', padding: 10, borderRadius: 10, marginBottom: 14,
          fontSize: 10.5, color: '#404751', lineHeight: 1.45,
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <Icon name="info" size={14} color="#005f98" />
          <div>
            <b>Backup Supabase automatici</b>: Anthropic mantiene automaticamente backup giornalieri del database per 7 giorni sul piano Free. Per un restore contattare il team tecnico.
          </div>
        </div>

        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#707882', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          Cosa includere
        </div>

        {TABLE_GROUPS.map(g => {
          const active = selected[g.key]
          return (
            <button key={g.key} onClick={() => toggle(g.key)} disabled={running}
              style={{
                width: '100%', textAlign: 'left', cursor: running ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
                padding: 10, borderRadius: 10, marginBottom: 6,
                border: active ? `2px solid ${g.color}` : '1px solid #d5dae2',
                background: active ? g.color + '10' : '#fff',
                fontFamily: 'inherit', opacity: running ? 0.6 : 1,
              }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8, background: g.color, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name={g.icon} size={15} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: active ? g.color : '#181c20' }}>
                  {g.label}
                </div>
                <div style={{ fontSize: 10, color: '#707882', lineHeight: 1.3 }}>
                  {g.description}
                </div>
              </div>
              <div style={{
                width: 20, height: 20, borderRadius: 6,
                border: active ? `2px solid ${g.color}` : '1.5px solid #c0c7d2',
                background: active ? g.color : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {active && <Icon name="check" size={12} color="#fff" />}
              </div>
            </button>
          )
        })}

        {/* Progress + risultati */}
        {statuses.length > 0 && (
          <div style={{
            marginTop: 14, background: '#f7f9ff', border: '1px solid #d5e5ff',
            borderRadius: 10, padding: 10,
          }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#005f98', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              {done ? '✓ Backup completato' : 'Esporto in corso…'}
            </div>
            {statuses.map(s => (
              <div key={s.table} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11, marginBottom: 3, color: '#404751',
              }}>
                {s.status === 'pending' && <span style={{ width: 12, height: 12, borderRadius: 999, background: '#d5dae2' }} />}
                {s.status === 'loading' && <div style={{ width: 12, height: 12, border: '2px solid #005f98', borderTopColor: 'transparent', borderRadius: 999, animation: 'spin 0.8s linear infinite' }} />}
                {s.status === 'done' && <Icon name="check_circle" size={13} color="#43a047" />}
                {s.status === 'error' && <Icon name="error" size={13} color="#c62828" />}
                <span style={{ flex: 1 }}>{s.table}</span>
                {s.status === 'done' && <span style={{ fontWeight: 700 }}>{s.count} record</span>}
                {s.status === 'error' && <span style={{ color: '#c62828', fontSize: 10 }}>{s.error}</span>}
              </div>
            ))}
            {done && (
              <div style={{
                marginTop: 8, paddingTop: 8, borderTop: '1px solid #d5e5ff',
                fontSize: 11.5, fontWeight: 800, color: '#005f98',
              }}>
                Totale: {totalRecords} record esportati · Download avviato
              </div>
            )}
          </div>
        )}

        {/* Azioni */}
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={onClose} disabled={running}
            style={{
              flex: 1, padding: '12px 18px', borderRadius: 12,
              border: '1px solid #c0c7d2', background: '#fff',
              fontSize: 13, fontWeight: 700, color: '#404751', cursor: 'pointer',
              opacity: running ? 0.6 : 1,
            }}>Chiudi</button>
          <button onClick={generateBackup} disabled={running || totalTables === 0}
            style={{
              flex: 2, padding: '12px 18px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, #005f98, #003c5e)', color: '#fff',
              fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 6px 16px rgba(0,95,152,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: (running || totalTables === 0) ? 0.6 : 1,
            }}>
            <Icon name="download" size={15} color="#fff" />
            {running ? 'Esporto…' : done ? 'Rigenera' : 'Genera backup'}
          </button>
        </div>

        <div style={{
          marginTop: 14, fontSize: 10, color: '#707882', textAlign: 'center',
          lineHeight: 1.5,
        }}>
          Il file scaricato è in formato JSON leggibile. Non condividerlo pubblicamente: contiene dati personali di giocatori, genitori e staff.
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </BottomSheet>
  )
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
