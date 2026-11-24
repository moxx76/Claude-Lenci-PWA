// v1.9.178 — Pagina Classifica.
// Mostra la classifica del girone della squadra selezionata (filtro squadra),
// letta dalla tabella lnd_classifiche. I dati sono aggiornati automaticamente
// 2x a settimana da edge function sync-lnd-classifiche.
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Icon } from '../components/Icon'
import { sortTeamsByAge } from '../lib/teamOrder'

interface TeamLite {
  id: string
  name: string
  color: string | null
  category: string | null
}

interface CategoriaLnd {
  codice: string
  nome: string
  tipo: string
  ordine: number
}

interface ClassificaRow {
  pos: number
  squadra: string
  g: number
  v: number
  n: number
  p: number
  gf: number
  gs: number
  dr: number
  pt: number
  pen: number
  stagione: string
  aggiornato_il: string
  fonte_url: string | null
}

interface GironeInfo {
  categoria_codice: string
  categoria_nome: string
  girone: string | null
  stagione: string
  rows: ClassificaRow[]
  aggiornato_il: string | null
  fonte_url: string | null
}

export function Classifica() {
  const [searchParams] = useSearchParams()
  // v1.9.179: ?team=<id> da link del menu squadra del Calendario
  const initialTeamId = searchParams.get('team')
  const [teams, setTeams] = useState<TeamLite[]>([])
  const [categorie, setCategorie] = useState<CategoriaLnd[]>([])
  const [teamToCategoria, setTeamToCategoria] = useState<Record<string, string>>({})
  const [teamFilter, setTeamFilter] = useState<string | null>(initialTeamId)
  const [girone, setGirone] = useState<GironeInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  // 1) Carica squadre + categorie LND + mappa team→categoria
  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const [tRes, cRes, csRes] = await Promise.all([
          supabase.from('teams').select('id, name, color, category').order('name'),
          supabase.from('lnd_categorie').select('codice, nome, tipo, ordine').order('ordine'),
          supabase.from('lnd_categorie_squadre').select('categoria_codice, team_id'),
        ])
        setTeams(sortTeamsByAge(tRes.data ?? [] as any) as any)
        setCategorie(cRes.data ?? [])
        const map: Record<string, string> = {}
        for (const r of (csRes.data ?? []) as any[]) {
          if (r.team_id) map[r.team_id] = r.categoria_codice
        }
        setTeamToCategoria(map)
        // Pre-seleziona la prima squadra con una categoria LND associata,
        // solo se non è già impostato un teamId via URL (?team=…).
        if (!initialTeamId) {
          const firstWithLnd = (tRes.data ?? []).find((t: any) => map[t.id]) as TeamLite | undefined
          if (firstWithLnd) setTeamFilter(firstWithLnd.id)
        }
      } catch (e: any) {
        setErr('Errore caricamento squadre: ' + (e?.message || String(e)))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // 2) Quando cambia il filtro squadra, carica la classifica del suo girone
  useEffect(() => {
    if (!teamFilter) { setGirone(null); return }
    const catCodice = teamToCategoria[teamFilter]
    if (!catCodice) { setGirone(null); return }
    const catNome = categorie.find(c => c.codice === catCodice)?.nome || catCodice
    ;(async () => {
      const { data, error } = await supabase
        .from('lnd_classifiche')
        .select('pos, squadra, g, v, n, p, gf, gs, dr, pt, pen, girone, stagione, aggiornato_il, fonte_url')
        .eq('categoria_codice', catCodice)
        .order('stagione', { ascending: false })
        .order('pos', { ascending: true })
      if (error) { setErr('Errore lettura classifica: ' + error.message); return }
      const rows = (data ?? []) as any[]
      if (rows.length === 0) {
        setGirone({ categoria_codice: catCodice, categoria_nome: catNome, girone: null, stagione: '', rows: [], aggiornato_il: null, fonte_url: null })
        return
      }
      // Prende la stagione più recente; se c'è più di un girone, prende il primo in ordine alfabetico
      const stagionePiuRecente = rows[0].stagione
      const righeStagione = rows.filter(r => r.stagione === stagionePiuRecente)
      const gironiDisponibili = [...new Set(righeStagione.map(r => r.girone).filter(Boolean))]
      const gironeScelto = gironiDisponibili[0] ?? null
      const righeGirone = righeStagione.filter(r => r.girone === gironeScelto)
      setGirone({
        categoria_codice: catCodice,
        categoria_nome: catNome,
        girone: gironeScelto,
        stagione: stagionePiuRecente,
        rows: righeGirone,
        aggiornato_il: righeGirone[0]?.aggiornato_il ?? null,
        fonte_url: righeGirone[0]?.fonte_url ?? null,
      })
    })()
  }, [teamFilter, teamToCategoria, categorie])

  // Squadra selezionata
  const currentTeam = useMemo(() => teams.find(t => t.id === teamFilter), [teams, teamFilter])

  // Highlight: nome squadra che include "lenci" o "poirino"
  const isLenci = (nome: string) => /\b(lenci|poirino)\b/i.test(nome)

  return (
    <div style={{ padding: '14px 12px 40px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Icon name="emoji_events" size={28} color="#005f98" />
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Classifica</h1>
      </div>

      {err && (
        <div style={{ background: '#fee', color: '#c62828', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          {err}
        </div>
      )}

      {/* Filtro squadra */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 14 }}>
        {teams.map(t => {
          const hasLnd = !!teamToCategoria[t.id]
          const active = teamFilter === t.id
          return (
            <button
              key={t.id}
              onClick={() => hasLnd && setTeamFilter(t.id)}
              disabled={!hasLnd}
              style={{
                padding: '8px 14px',
                borderRadius: 999,
                border: `1.5px solid ${active ? (t.color || '#005f98') : (hasLnd ? '#dde4ec' : '#f0f2f5')}`,
                background: active ? (t.color || '#005f98') : '#fff',
                color: active ? '#fff' : (hasLnd ? '#181c20' : '#b0b7c0'),
                fontSize: 12.5,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                cursor: hasLnd ? 'pointer' : 'not-allowed',
                flexShrink: 0,
              }}>
              {t.name}
            </button>
          )
        })}
      </div>

      {loading && <div style={{ padding: 20, textAlign: 'center', color: '#707882' }}>Caricamento…</div>}

      {!loading && !teamFilter && (
        <div style={{ padding: 30, textAlign: 'center', color: '#707882' }}>
          Seleziona una squadra per vedere la sua classifica.
        </div>
      )}

      {!loading && teamFilter && girone && girone.rows.length === 0 && (
        <div style={{ padding: 20, background: '#fff8e1', border: '1px solid #ffd54f', borderRadius: 10, color: '#7a5a00' }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Classifica stagione 2026/2027 non ancora pubblicata</div>
          <div style={{ fontSize: 13 }}>
            Il Comitato Regionale Piemonte-Valle d'Aosta non ha ancora rilasciato il PDF classifica di <b>{girone.categoria_nome}</b> per la stagione in corso.
            Appena disponibile (di solito dopo le prime giornate di campionato) verrà scaricata e mostrata qui in automatico — nessuna azione richiesta.
          </div>
        </div>
      )}

      {!loading && girone && girone.rows.length > 0 && (
        <>
          {/* Header classifica */}
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 8, flexWrap: 'wrap', gap: 8,
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#181c20' }}>
                {girone.categoria_nome}
                {girone.girone && <span style={{ color: '#005f98', marginLeft: 8 }}>· Girone {girone.girone}</span>}
              </div>
              <div style={{ fontSize: 12, color: '#707882' }}>
                Stagione {girone.stagione}
                {girone.aggiornato_il && <> · aggiornata {new Date(girone.aggiornato_il).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</>}
              </div>
            </div>
            {girone.fonte_url && (
              <a href={girone.fonte_url} target="_blank" rel="noreferrer" style={{
                fontSize: 11, color: '#005f98', textDecoration: 'none',
                border: '1px solid #cfe5ff', padding: '4px 10px', borderRadius: 999,
                background: '#f0f7ff', fontWeight: 700,
              }}>
                📄 PDF ufficiale
              </a>
            )}
          </div>

          {/* Tabella classifica */}
          <div style={{
            background: '#fff', borderRadius: 10, border: '1px solid #e6e8ee',
            overflow: 'hidden', fontSize: 13,
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '38px 1fr 32px 32px 32px 32px 44px 42px 42px',
              fontSize: 10.5, fontWeight: 800, color: '#707882',
              background: '#f5f7fa', padding: '8px 10px',
              borderBottom: '1px solid #e6e8ee', textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              <div>Pos</div>
              <div>Squadra</div>
              <div style={{ textAlign: 'center' }}>Pt</div>
              <div style={{ textAlign: 'center' }}>G</div>
              <div style={{ textAlign: 'center' }}>V</div>
              <div style={{ textAlign: 'center' }}>N</div>
              <div style={{ textAlign: 'center' }}>P</div>
              <div style={{ textAlign: 'center' }}>GF</div>
              <div style={{ textAlign: 'center' }}>GS</div>
            </div>
            {girone.rows.map(r => {
              const lenci = isLenci(r.squadra)
              return (
                <div key={r.pos + '-' + r.squadra} style={{
                  display: 'grid',
                  gridTemplateColumns: '38px 1fr 32px 32px 32px 32px 44px 42px 42px',
                  padding: '9px 10px',
                  borderBottom: '1px solid #f0f2f5',
                  background: lenci ? '#fff8e6' : 'transparent',
                  fontWeight: lenci ? 800 : 500,
                  color: lenci ? '#7a5a00' : '#181c20',
                }}>
                  <div>
                    <span style={{
                      display: 'inline-block', minWidth: 20, textAlign: 'center',
                      background: r.pos <= 3 ? '#005f98' : (r.pos >= girone.rows.length - 1 ? '#c62828' : 'transparent'),
                      color: r.pos <= 3 || r.pos >= girone.rows.length - 1 ? '#fff' : '#404751',
                      borderRadius: 4, padding: '1px 4px', fontWeight: 800, fontSize: 11.5,
                    }}>{r.pos}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {lenci && <span style={{ fontSize: 13 }}>🏠</span>}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.squadra}</span>
                    {r.pen > 0 && <span style={{ fontSize: 10, color: '#c62828', fontWeight: 800 }}>(–{r.pen})</span>}
                  </div>
                  <div style={{ textAlign: 'center', fontWeight: 800, color: lenci ? '#7a5a00' : '#005f98' }}>{r.pt}</div>
                  <div style={{ textAlign: 'center' }}>{r.g}</div>
                  <div style={{ textAlign: 'center' }}>{r.v}</div>
                  <div style={{ textAlign: 'center' }}>{r.n}</div>
                  <div style={{ textAlign: 'center' }}>{r.p}</div>
                  <div style={{ textAlign: 'center', color: '#707882' }}>{r.gf}</div>
                  <div style={{ textAlign: 'center', color: '#707882' }}>{r.gs}</div>
                </div>
              )
            })}
          </div>

          <div style={{ fontSize: 10.5, color: '#9aa0a8', marginTop: 10, textAlign: 'center' }}>
            Fonte dati: CU ufficiali Comitato Regionale Piemonte-VdA LND · sync automatico ogni lun+gio
          </div>
        </>
      )}

      {currentTeam && !teamToCategoria[currentTeam.id] && (
        <div style={{ padding: 20, background: '#fff8e1', border: '1px solid #ffd54f', borderRadius: 10, color: '#7a5a00', marginTop: 10 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Squadra non associata a un campionato LND</div>
          <div style={{ fontSize: 13 }}>
            {currentTeam.name} non ha una categoria LND configurata. Non c'è una classifica da mostrare per questa squadra.
          </div>
        </div>
      )}
    </div>
  )
}

export default Classifica
