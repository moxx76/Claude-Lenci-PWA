/**
 * DistintaTatticaSheet — Il secondo passaggio del flusso squadra:
 * dopo la Convocazione (max 20 convocati con is_captain/is_vice_captain già impostati),
 * qui si compila la distinta tattica vera propria:
 *   Step 1: scelta del modulo (da FORMATIONS)
 *   Step 2: assegnazione degli 11 titolari sugli slot del modulo (ibridi: label pre-compilata modificabile)
 *   Step 3: panchina + capitano/vice capitano (ereditati dalla Convocazione ma modificabili qui)
 *
 * Salvataggio:
 *   - UPDATE matches.formation e matches.lineup_completed_at/by
 *   - UPSERT match_player_stats per ogni convocato:
 *       titolari    → was_starter=true,  minute_in=0,    role_slot=<key>, slot_index, role_slot_label, position_played
 *       panchinari  → was_starter=false, minute_in=null, role_slot=null,  slot_index=null
 *   - UPDATE convocations.is_captain / is_vice_captain se cambiati qui rispetto alla convocazione originale
 *
 * IMPORTANTE: la tabella match_player_stats ha UNIQUE(match_id, player_id) → uso UPSERT su quella coppia
 * per non distruggere stats già inserite da un vecchio referto. Il PostMatchSheet a sua volta preserverà
 * role_slot/slot_index quando fa il proprio DELETE+INSERT (fix in v1.9.61).
 */

import { useState, useEffect, useMemo } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'
import { PitchView, type PitchPlayer } from './PitchView'
import { FORMATIONS, FORMATION_KEYS, startersCount, benchMax, type FormationSlot } from '../lib/formations'

export interface DistintaTatticaData {
  id: string           // match id
  opponent: string
  match_date: string
  venue: 'home' | 'away'
  team_id: string
  team_name: string
  team_category: string | null
  /** Se già presente all'apertura dello sheet, la distinta è stata salvata in precedenza */
  lineup_completed_at?: string | null
}

interface Convocato {
  player_id: string
  is_captain: boolean
  is_vice_captain: boolean
  shirt_number_override: number | null
  first_name: string
  last_name: string
  jersey_number: number | null
  position: string | null
}

interface SlotAssignment {
  key: string                // key stabile dello slot (es. "TD")
  label: string              // label editabile (default = da FORMATIONS)
  position_hint: string      // ruolo naturale
  player_id: string | null   // giocatore assegnato
}

// Metadati di una distinta compilata in una partita passata (per l'import)
interface PreviousLineup {
  match_id: string
  match_date: string
  opponent: string
  formation: string
  starters_count: number
}

interface Props {
  open: boolean
  onClose: () => void
  match: DistintaTatticaData | null
  onSaved?: () => void
}

export function DistintaTatticaSheet({ open, onClose, match, onSaved }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [convocati, setConvocati] = useState<Convocato[]>([])
  const [formation, setFormation] = useState<string>('4-4-2')
  const [slots, setSlots] = useState<SlotAssignment[]>([])
  const [benchIds, setBenchIds] = useState<string[]>([])
  const [captainId, setCaptainId] = useState<string | null>(null)
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  // Import da distinta precedente
  const [previousLineups, setPreviousLineups] = useState<PreviousLineup[]>([])
  const [importedFromMatchId, setImportedFromMatchId] = useState<string | null>(null)
  // Nomi dei giocatori esclusi (in una distinta precedente ma non convocati per questa)
  const [importSkipped, setImportSkipped] = useState<{ name: string; role: string }[]>([])
  const [originalCaptainId, setOriginalCaptainId] = useState<string | null>(null)
  const [originalViceId, setOriginalViceId] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !match) return
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, match?.id])

  async function loadData() {
    if (!match) return
    setLoading(true)
    setStep(1)

    // 1. Carico convocati (status=accepted) con dati giocatore
    const { data: convRes } = await supabase.from('convocations')
      .select('player_id, is_captain, is_vice_captain, shirt_number_override, player:players(id, first_name, last_name, jersey_number, position)')
      .eq('match_id', match.id)
      .eq('status', 'accepted')

    const conv: Convocato[] = ((convRes ?? []) as any[])
      .filter(c => c.player)
      .map(c => ({
        player_id: c.player_id,
        is_captain: !!c.is_captain,
        is_vice_captain: !!c.is_vice_captain,
        shirt_number_override: c.shirt_number_override,
        first_name: c.player.first_name,
        last_name: c.player.last_name,
        jersey_number: c.shirt_number_override ?? c.player.jersey_number,
        position: c.player.position,
      }))
      .sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999) || a.last_name.localeCompare(b.last_name))
    setConvocati(conv)

    // Precompilo capitano/vice dalla convocazione
    const cap = conv.find(c => c.is_captain)?.player_id ?? null
    const vice = conv.find(c => c.is_vice_captain)?.player_id ?? null
    setCaptainId(cap)
    setViceCaptainId(vice)
    setOriginalCaptainId(cap)
    setOriginalViceId(vice)

    // 2. Carico matches.formation e distinta esistente
    const { data: matchRes } = await supabase.from('matches')
      .select('formation')
      .eq('id', match.id)
      .maybeSingle()

    const currentFormation = matchRes?.formation && FORMATION_KEYS.includes(matchRes.formation)
      ? matchRes.formation
      : '4-4-2'
    setFormation(currentFormation)

    // 3. Carico eventuali slot già assegnati da precedente distinta
    const { data: statsRes } = await supabase.from('match_player_stats')
      .select('player_id, was_starter, role_slot, role_slot_label, slot_index')
      .eq('match_id', match.id)

    const existingSlots = ((statsRes ?? []) as any[])
      .filter(s => s.was_starter && s.role_slot != null && s.slot_index != null)
      .sort((a, b) => a.slot_index - b.slot_index)

    const template = FORMATIONS[currentFormation] || FORMATIONS['4-4-2']
    const newSlots: SlotAssignment[] = template.map((t, idx) => {
      const existing = existingSlots.find(e => e.slot_index === idx && e.role_slot === t.key)
      return {
        key: t.key,
        label: existing?.role_slot_label || t.label,
        position_hint: t.position_hint,
        player_id: existing?.player_id ?? null,
      }
    })
    setSlots(newSlots)

    // Panchinari già salvati: convocati - titolari
    const starterIds = new Set(newSlots.map(s => s.player_id).filter(Boolean) as string[])
    const bench = conv.filter(c => !starterIds.has(c.player_id)).map(c => c.player_id)
    setBenchIds(bench)

    // 4. Carico ultime 10 partite passate della stessa squadra con distinta compilata (per import)
    const { data: prevRes } = await supabase.from('matches')
      .select('id, match_date, opponent, formation, lineup_completed_at')
      .eq('team_id', match.team_id)
      .neq('id', match.id)
      .not('lineup_completed_at', 'is', null)
      .order('match_date', { ascending: false })
      .limit(10)
    // Conto i titolari effettivi per ognuna: serve per mostrare 11/9/7
    const prevIds = (prevRes ?? []).map((p: any) => p.id)
    let counts: Record<string, number> = {}
    if (prevIds.length > 0) {
      const { data: cntRes } = await supabase.from('match_player_stats')
        .select('match_id, was_starter')
        .in('match_id', prevIds)
        .eq('was_starter', true)
      for (const r of (cntRes ?? []) as any[]) {
        counts[r.match_id] = (counts[r.match_id] ?? 0) + 1
      }
    }
    setPreviousLineups(((prevRes ?? []) as any[]).map(p => ({
      match_id: p.id,
      match_date: p.match_date,
      opponent: p.opponent,
      formation: p.formation || '',
      starters_count: counts[p.id] ?? 0,
    })))

    setLoading(false)
  }

  /**
   * Import da una distinta precedente (opzione C: modulo + slot con giocatori + capitani + panchina).
   * Regole:
   * - Se il modulo importato differisce dall'attuale, sostituisce il modulo
   * - Ogni giocatore titolare della vecchia distinta va nel nuovo slot (stessa key) SOLO se convocato per questa partita
   * - Se non convocato: slot lasciato vuoto (badge giallo)
   * - Panchina: importati solo i panchinari che sono convocati anche qui
   * - Capitano/Vice: importati solo se il giocatore è convocato
   * - Avviso in cima con i giocatori esclusi
   */
  async function importFromPrevious(prevMatchId: string) {
    if (!match) return
    setLoading(true)
    try {
      // 1. Prendo il modulo della partita precedente
      const { data: prevMatch } = await supabase.from('matches')
        .select('formation')
        .eq('id', prevMatchId)
        .maybeSingle()
      const prevFormation = prevMatch?.formation && FORMATION_KEYS.includes(prevMatch.formation)
        ? prevMatch.formation
        : formation

      // 2. Titolari della precedente con role_slot / slot_index
      const { data: prevStats } = await supabase.from('match_player_stats')
        .select('player_id, was_starter, role_slot, role_slot_label, slot_index, player:players(id, first_name, last_name, position)')
        .eq('match_id', prevMatchId)

      // 3. Convocati precedenti con capitano/vice
      const { data: prevConv } = await supabase.from('convocations')
        .select('player_id, is_captain, is_vice_captain')
        .eq('match_id', prevMatchId)
        .eq('status', 'accepted')

      // Set convocati per QUESTA partita
      const nowConvocatedIds = new Set(convocati.map(c => c.player_id))
      const skipped: { name: string; role: string }[] = []

      // Costruisco slot template per il modulo importato
      const template = FORMATIONS[prevFormation] || FORMATIONS['4-4-2']
      const newSlots: SlotAssignment[] = template.map((t, idx) => {
        // Cerco chi c'era in quello slot nella distinta precedente
        const prevAssign = (prevStats ?? []).find((s: any) =>
          s.was_starter && s.slot_index === idx && s.role_slot === t.key
        ) as any
        let assignedId: string | null = null
        if (prevAssign?.player_id) {
          if (nowConvocatedIds.has(prevAssign.player_id)) {
            assignedId = prevAssign.player_id
          } else if (prevAssign.player) {
            // Non convocato: lo aggiungo alla lista degli esclusi
            skipped.push({
              name: `${prevAssign.player.last_name} ${prevAssign.player.first_name[0]}.`,
              role: prevAssign.role_slot_label || t.label,
            })
          }
        }
        return {
          key: t.key,
          label: prevAssign?.role_slot_label || t.label,
          position_hint: t.position_hint,
          player_id: assignedId,
        }
      })

      // Panchinari: precedenti was_starter=false + minute_in dichiarato (o solo convocati non titolari)
      // Prendo tutti i convocati precedenti non titolari, e importo solo quelli convocati anche adesso
      const prevStarterIds = new Set(
        (prevStats ?? []).filter((s: any) => s.was_starter).map((s: any) => s.player_id)
      )
      const prevBenchIds = (prevConv ?? [])
        .map((c: any) => c.player_id)
        .filter((pid: string) => !prevStarterIds.has(pid))
      // Filtro: presenti anche nei convocati di questa partita e non ora titolari
      const importedStarterIds = new Set(newSlots.map(s => s.player_id).filter(Boolean) as string[])
      const importedBench = prevBenchIds.filter((pid: string) =>
        nowConvocatedIds.has(pid) && !importedStarterIds.has(pid)
      )

      // Capitano/Vice: importa se convocati adesso, altrimenti mantiene quelli attuali
      const prevCap = (prevConv ?? []).find((c: any) => c.is_captain) as any
      const prevVice = (prevConv ?? []).find((c: any) => c.is_vice_captain) as any
      const newCaptainId = prevCap && nowConvocatedIds.has(prevCap.player_id) ? prevCap.player_id : captainId
      let newViceId = prevVice && nowConvocatedIds.has(prevVice.player_id) ? prevVice.player_id : viceCaptainId
      // Se cap e vice coincidono, resetto vice
      if (newCaptainId && newViceId === newCaptainId) newViceId = null

      // Applico
      setFormation(prevFormation)
      setSlots(newSlots)
      setBenchIds(importedBench)
      setCaptainId(newCaptainId)
      setViceCaptainId(newViceId)
      setImportSkipped(skipped)
      setImportedFromMatchId(prevMatchId)
      // Vado direttamente allo step 2 (Titolari) per rifinire
      setStep(2)
    } finally {
      setLoading(false)
    }
  }

  // Cambio modulo: se ci sono già slot assegnati, chiedo conferma reset
  function handleFormationChange(newFormation: string) {
    const hasAssignments = slots.some(s => s.player_id)
    if (hasAssignments && !confirm('Cambiando modulo gli slot già assegnati verranno resettati. Procedere?')) return
    setFormation(newFormation)
    const template = FORMATIONS[newFormation] || FORMATIONS['4-4-2']
    setSlots(template.map(t => ({
      key: t.key,
      label: t.label,
      position_hint: t.position_hint,
      player_id: null,
    })))
    // Con reset, tutti i convocati tornano in "panchina" (nessun titolare)
    setBenchIds(convocati.map(c => c.player_id))
  }

  function assignPlayerToSlot(slotIdx: number, playerId: string | null) {
    setSlots(prev => {
      const next = [...prev]
      // Se il player era assegnato altrove, lo rimuovo dall'altro slot
      if (playerId) {
        for (let i = 0; i < next.length; i++) {
          if (i !== slotIdx && next[i].player_id === playerId) {
            next[i] = { ...next[i], player_id: null }
          }
        }
      }
      next[slotIdx] = { ...next[slotIdx], player_id: playerId }
      return next
    })
    // Aggiorno panchina: chi è titolare NON è in panchina
    setBenchIds(prev => {
      const starterSet = new Set<string>()
      slots.forEach((s, i) => {
        const pid = i === slotIdx ? playerId : s.player_id
        if (pid) starterSet.add(pid)
      })
      // panchina = convocati - titolari
      return convocati.filter(c => !starterSet.has(c.player_id)).map(c => c.player_id)
    })
  }

  function renameSlot(slotIdx: number, newLabel: string) {
    setSlots(prev => {
      const next = [...prev]
      next[slotIdx] = { ...next[slotIdx], label: newLabel }
      return next
    })
  }

  function togglePanchina(playerId: string) {
    // Se non è in panchina né in titolari, aggiungilo. Se è, rimuovilo.
    const isStarter = slots.some(s => s.player_id === playerId)
    if (isStarter) return  // non si può rimuovere qui, va deassegnato dallo slot
    setBenchIds(prev => prev.includes(playerId) ? prev.filter(p => p !== playerId) : [...prev, playerId])
  }

  // Titolari assegnati (chi ha uno slot con player_id)
  const starterIds = useMemo(
    () => new Set(slots.map(s => s.player_id).filter(Boolean) as string[]),
    [slots]
  )
  const emptySlots = slots.filter(s => !s.player_id).length
  const benchCount = benchIds.length
  const bMax = benchMax(formation)
  const sCount = startersCount(formation)

  // Convocati disponibili per un dato slot: chi non è già titolare altrove, ordinati per fit ruolo
  function candidatesForSlot(slot: SlotAssignment): Convocato[] {
    const availableIds = convocati.filter(c => {
      // Sono candidato se NON sono titolare in un altro slot (nel mio slot corrente sì)
      const inOtherSlot = slots.some(s => s.player_id === c.player_id && s.key !== slot.key)
      return !inOtherSlot
    })
    // Ordino: prima chi ha il position_hint esatto, poi tutti gli altri per numero maglia
    return availableIds.sort((a, b) => {
      const aMatch = a.position === slot.position_hint ? 0 : 1
      const bMatch = b.position === slot.position_hint ? 0 : 1
      if (aMatch !== bMatch) return aMatch - bMatch
      return (a.jersey_number ?? 999) - (b.jersey_number ?? 999)
    })
  }

  function playerLabel(c: Convocato): string {
    const num = c.jersey_number != null ? `#${c.jersey_number} ` : ''
    const posTag = c.position ? ` · ${c.position}` : ''
    return `${num}${c.last_name} ${c.first_name[0]}.${posTag}`
  }

  // Convocati eleggibili come capitano/vice: tra tutti i convocati (titolari o panchina)
  const captainCandidates = useMemo(
    () => convocati.filter(c => starterIds.has(c.player_id) || benchIds.includes(c.player_id)),
    [convocati, starterIds, benchIds]
  )

  async function handleSave() {
    if (!match) return
    if (emptySlots > 0) {
      if (!confirm(`Ci sono ${emptySlots} slot vuoti. Salvare comunque la distinta parziale?`)) return
    }
    if (!captainId) {
      if (!confirm('Nessun capitano selezionato. Salvare comunque?')) return
    }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const uid = user?.id ?? null

      // 1. UPDATE matches.formation + lineup_completed
      await supabase.from('matches').update({
        formation,
      }).eq('id', match.id)
      // lineup_completed_* in try/catch (colonne v1.9.59)
      try {
        await supabase.from('matches').update({
          lineup_completed_at: new Date().toISOString(),
          lineup_completed_by: uid,
        }).eq('id', match.id)
      } catch (err) {
        console.warn('[Distinta] lineup_completed_at/by non salvati (migration mancante?)', err)
      }

      // 2. UPSERT match_player_stats per ogni convocato
      // - titolari: was_starter=true, minute_in=0, role_slot, slot_index, role_slot_label, position_played
      // - panchinari e non-panchina: was_starter=false, minute_in=null, role_slot=null
      const upserts = convocati.map(c => {
        const slotIdx = slots.findIndex(s => s.player_id === c.player_id)
        const isStarter = slotIdx >= 0
        const slot = isStarter ? slots[slotIdx] : null
        return {
          match_id: match.id,
          player_id: c.player_id,
          was_starter: isStarter,
          minute_in: isStarter ? 0 : null,
          role_slot: slot?.key ?? null,
          role_slot_label: slot?.label ?? null,
          slot_index: isStarter ? slotIdx : null,
          position_played: slot?.label ?? null, // Retrocompat: PostMatchSheet legge position_played
        }
      })

      // UPSERT su UNIQUE(match_id, player_id) — preserva id e stats già inserite (goals, cards, minute_out)
      const { error: upsertErr } = await supabase.from('match_player_stats').upsert(upserts, {
        onConflict: 'match_id,player_id',
        // NON metto ignoreDuplicates: voglio aggiornare role_slot/was_starter/minute_in/position_played
        // ma per non azzerare goals/cards uso la strategia: aggiorno solo i campi passati (Supabase upsert default)
      })
      if (upsertErr) throw upsertErr

      // 3. Se capitano/vice sono cambiati rispetto alla convocazione, aggiorna convocations
      const capChanged = captainId !== originalCaptainId
      const viceChanged = viceCaptainId !== originalViceId
      if (capChanged || viceChanged) {
        // Reset di tutti i flag e reimposto: modo semplice e robusto
        await supabase.from('convocations')
          .update({ is_captain: false, is_vice_captain: false })
          .eq('match_id', match.id)
        if (captainId) {
          await supabase.from('convocations')
            .update({ is_captain: true, is_vice_captain: false })
            .eq('match_id', match.id).eq('player_id', captainId)
        }
        if (viceCaptainId) {
          await supabase.from('convocations')
            .update({ is_vice_captain: true })
            .eq('match_id', match.id).eq('player_id', viceCaptainId)
        }
        setOriginalCaptainId(captainId)
        setOriginalViceId(viceCaptainId)
      }

      setSavedOk(true)
      onSaved?.()
      setTimeout(() => setSavedOk(false), 1500)
    } catch (err: any) {
      alert(`Errore salvataggio distinta: ${err?.message || err}`)
    } finally {
      setSaving(false)
    }
  }

  if (!open || !match) return null

  const dateFmt = new Date(match.match_date).toLocaleDateString('it-IT', {
    weekday: 'short', day: '2-digit', month: 'short',
  })

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Distinta tattica"
    >
      <div style={{ padding: 16 }}>
        {/* Header partita */}
        <div style={{
          padding: 10, borderRadius: 10, background: '#f8f9fc',
          border: '1px solid #e6e8ee', marginBottom: 16, fontSize: 12.5,
        }}>
          <div style={{ fontWeight: 700, color: '#181c20' }}>
            {match.venue === 'home' ? '🏠' : '✈️'} {match.team_name} vs {match.opponent}
          </div>
          <div style={{ color: '#707882', marginTop: 2 }}>
            {dateFmt} · {match.team_category || ''}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#707882' }}>Caricamento…</div>
        ) : convocati.length === 0 ? (
          <div style={{
            padding: 12, borderRadius: 8, background: '#fff4e5',
            border: '1px solid #e0a800', color: '#8e6300', fontSize: 12.5,
          }}>
            <Icon name="warning" size={16} color="#8e6300" /> Nessun convocato per questa partita.
            Torna alla scheda Presenze & Convocazioni per compilare la convocazione prima di procedere con la distinta.
          </div>
        ) : (
          <>
            {/* Stepper */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14,
              fontSize: 11, fontWeight: 700,
            }}>
              {([1, 2, 3] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStep(s)}
                  style={{
                    padding: '8px 6px', borderRadius: 8,
                    background: step === s ? '#005f98' : '#f1f3fa',
                    color: step === s ? '#fff' : '#404751',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  {s}. {s === 1 ? 'Modulo' : s === 2 ? 'Titolari' : 'Panchina & fascia'}
                </button>
              ))}
            </div>

            {/* STEP 1 — Modulo */}
            {step === 1 && (
              <div>
                {/* Import da distinta precedente */}
                {previousLineups.length > 0 && (
                  <div style={{
                    marginBottom: 14, padding: 12, borderRadius: 10,
                    background: '#f0f9ff', border: '1px solid #005f98',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 12, fontWeight: 800, color: '#005f98', marginBottom: 6,
                    }}>
                      <Icon name="content_copy" size={14} color="#005f98" />
                      Importa da distinta precedente
                    </div>
                    <div style={{ fontSize: 10.5, color: '#404751', marginBottom: 8 }}>
                      Riparti da una distinta già compilata: modulo, titolari sugli slot, panchina, capitani.
                      I giocatori non convocati per questa partita saranno esclusi (con avviso).
                    </div>
                    <select
                      value=""
                      onChange={e => {
                        const v = e.target.value
                        if (v) importFromPrevious(v)
                      }}
                      style={{
                        width: '100%', padding: '7px 8px', borderRadius: 6,
                        border: '1px solid #005f98', fontSize: 12, background: '#fff',
                      }}
                    >
                      <option value="">— Scegli una partita da cui importare —</option>
                      {previousLineups.map(p => {
                        const d = new Date(p.match_date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
                        return (
                          <option key={p.match_id} value={p.match_id}>
                            {d} · vs {p.opponent} · {p.formation || 'senza modulo'} · {p.starters_count} tit.
                          </option>
                        )
                      })}
                    </select>
                  </div>
                )}
                <div style={{ fontSize: 12.5, color: '#404751', marginBottom: 10 }}>
                  {previousLineups.length > 0 ? 'Oppure ricomincia scegliendo il modulo:' : 'Scegli il modulo tattico.'} Ci sono {convocati.length} convocati, ne servono {sCount} titolari.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                  {FORMATION_KEYS.map(f => (
                    <button
                      key={f}
                      onClick={() => handleFormationChange(f)}
                      style={{
                        padding: '10px 8px', borderRadius: 8,
                        background: formation === f ? '#005f98' : '#fff',
                        color: formation === f ? '#fff' : '#181c20',
                        border: `1px solid ${formation === f ? '#005f98' : '#c0c7d2'}`,
                        cursor: 'pointer', fontSize: 12, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}
                    >
                      <span>{f}</span>
                      <span style={{ fontSize: 10, opacity: 0.7 }}>{startersCount(f)} tit.</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setStep(2)}
                  style={{
                    marginTop: 14, width: '100%', padding: 12, borderRadius: 8,
                    background: '#005f98', color: '#fff', border: 'none',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Prosegui con {formation} →
                </button>
              </div>
            )}

            {/* STEP 2 — Titolari */}
            {step === 2 && (
              <div>
                {/* Avviso: giocatori della distinta importata NON convocati per questa partita */}
                {importSkipped.length > 0 && (
                  <div style={{
                    padding: 10, borderRadius: 8, marginBottom: 10,
                    background: '#fff4e5', border: '1px solid #e0a800',
                  }}>
                    <div style={{
                      fontSize: 11.5, fontWeight: 800, color: '#8e6300',
                      display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
                    }}>
                      <Icon name="warning" size={14} color="#8e6300" />
                      {importSkipped.length} giocator{importSkipped.length === 1 ? 'e' : 'i'} della distinta importata non convocat{importSkipped.length === 1 ? 'o' : 'i'} per questa partita
                    </div>
                    <div style={{ fontSize: 10.5, color: '#8e6300', lineHeight: 1.4 }}>
                      {importSkipped.map((s, i) => (
                        <span key={i}>
                          {s.name} <span style={{ opacity: 0.75 }}>({s.role})</span>{i < importSkipped.length - 1 ? ' · ' : ''}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#8e6300', marginTop: 4, fontStyle: 'italic' }}>
                      I loro slot sono rimasti vuoti — assegna un giocatore convocato per riempirli.
                    </div>
                    <button
                      onClick={() => setImportSkipped([])}
                      style={{
                        marginTop: 6, padding: '4px 10px', borderRadius: 6, border: '1px solid #e0a800',
                        background: 'transparent', color: '#8e6300', fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      Ho capito, nascondi avviso
                    </button>
                  </div>
                )}
                <div style={{ fontSize: 12.5, color: '#404751', marginBottom: 8 }}>
                  Modulo <strong>{formation}</strong> · {sCount - emptySlots}/{sCount} slot compilati
                  {emptySlots > 0 && <span style={{ color: '#8e6300' }}> · {emptySlots} vuoti</span>}
                  {importedFromMatchId && (
                    <span style={{ color: '#005f98', fontSize: 10.5, marginLeft: 6 }}>· ⚡ importata</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {slots.map((s, idx) => {
                    const candidates = candidatesForSlot(s)
                    const assigned = s.player_id ? convocati.find(c => c.player_id === s.player_id) : null
                    return (
                      <div key={`${s.key}-${idx}`} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px', borderRadius: 10,
                        background: assigned ? 'rgba(128,249,139,0.15)' : '#fff',
                        border: `1px solid ${assigned ? '#80f98b' : '#e6e8ee'}`,
                      }}>
                        <span style={{
                          fontSize: 10, fontWeight: 800, color: '#005f98',
                          background: 'rgba(0,95,152,0.1)', padding: '2px 6px', borderRadius: 4,
                          minWidth: 24, textAlign: 'center',
                        }}>{idx + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <SlotLabel value={s.label} onChange={v => renameSlot(idx, v)} />
                          <select
                            value={s.player_id ?? ''}
                            onChange={e => assignPlayerToSlot(idx, e.target.value || null)}
                            style={{
                              width: '100%', marginTop: 4, padding: '6px 8px',
                              borderRadius: 6, border: '1px solid #c0c7d2',
                              fontSize: 12.5, background: '#fff',
                            }}
                          >
                            <option value="">— Seleziona giocatore —</option>
                            {candidates.map(c => (
                              <option key={c.player_id} value={c.player_id}>
                                {playerLabel(c)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
                  <button onClick={() => setStep(1)} style={btnSecondary}>← Modulo</button>
                  <button onClick={() => setStep(3)} style={btnPrimary}>Panchina & fascia →</button>
                </div>
              </div>
            )}

            {/* STEP 3 — Panchina + Capitani */}
            {step === 3 && (
              <div>
                {/* Anteprima campo grafico con la distinta corrente */}
                <div style={{
                  marginBottom: 14, borderRadius: 12, overflow: 'hidden',
                  border: '1px solid #e6e8ee',
                }}>
                  <PitchView
                    formation={formation}
                    players={slots
                      .filter(s => s.player_id)
                      .map(s => {
                        const c = convocati.find(cc => cc.player_id === s.player_id)!
                        return {
                          slot_key: s.key,
                          slot_label: s.label,
                          jersey_number: c.jersey_number,
                          last_name: c.last_name,
                          first_name: c.first_name,
                          is_captain: c.player_id === captainId,
                          is_vice_captain: c.player_id === viceCaptainId,
                        } as PitchPlayer
                      })
                    }
                    height={300}
                  />
                </div>
                <div style={{ fontSize: 12.5, color: '#404751', marginBottom: 8 }}>
                  Panchina: {benchCount}/{bMax} massimo · {convocati.length - starterIds.size - benchCount} convocati non in distinta
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
                  {convocati.filter(c => !starterIds.has(c.player_id)).map(c => {
                    const inBench = benchIds.includes(c.player_id)
                    return (
                      <div key={c.player_id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 10px', borderRadius: 8,
                        background: inBench ? 'rgba(0,95,152,0.08)' : '#fff',
                        border: `1px solid ${inBench ? '#005f98' : '#e6e8ee'}`,
                      }}>
                        <button
                          onClick={() => togglePanchina(c.player_id)}
                          style={{
                            width: 24, height: 24, borderRadius: 6, border: 'none',
                            background: inBench ? '#005f98' : '#e6e8ee',
                            color: '#fff', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Icon name={inBench ? 'check' : 'add'} size={12} color={inBench ? '#fff' : '#707882'} />
                        </button>
                        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>
                          {playerLabel(c)}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Capitano + Vice */}
                <div style={{
                  padding: 12, borderRadius: 10, background: '#f8f9fc',
                  border: '1px solid #e6e8ee', marginBottom: 14,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#181c20', marginBottom: 8 }}>
                    Fascia di capitano
                  </div>
                  <label style={{ display: 'block', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: '#404751', display: 'block', marginBottom: 3 }}>
                      ⭐ Capitano
                    </span>
                    <select
                      value={captainId ?? ''}
                      onChange={e => {
                        const v = e.target.value || null
                        setCaptainId(v)
                        // Il capitano non può essere anche vice
                        if (v && v === viceCaptainId) setViceCaptainId(null)
                      }}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #c0c7d2', fontSize: 12.5 }}
                    >
                      <option value="">— Nessun capitano —</option>
                      {captainCandidates.map(c => (
                        <option key={c.player_id} value={c.player_id}>{playerLabel(c)}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: 'block' }}>
                    <span style={{ fontSize: 11, color: '#404751', display: 'block', marginBottom: 3 }}>
                      ⯪ Vice capitano
                    </span>
                    <select
                      value={viceCaptainId ?? ''}
                      onChange={e => setViceCaptainId(e.target.value || null)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #c0c7d2', fontSize: 12.5 }}
                    >
                      <option value="">— Nessun vice —</option>
                      {captainCandidates.filter(c => c.player_id !== captainId).map(c => (
                        <option key={c.player_id} value={c.player_id}>{playerLabel(c)}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button onClick={() => setStep(2)} style={btnSecondary}>← Titolari</button>
                  <button onClick={handleSave} disabled={saving} style={{
                    ...btnPrimary,
                    background: savedOk ? '#006e25' : (saving ? '#707882' : '#005f98'),
                  }}>
                    {savedOk ? '✓ Salvata!' : saving ? 'Salvo…' : '💾 Salva distinta'}
                  </button>
                </div>

                {/* Foglio partita: appare come CTA secondaria dopo il salvataggio (o se la distinta era già salvata all'apertura) */}
                {(savedOk || match.lineup_completed_at) && (
                  <a
                    href={`/foglio-partita/${match.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      marginTop: 8, padding: '11px 18px', borderRadius: 10, border: '1.5px solid #404751',
                      background: '#fff', color: '#404751', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      textDecoration: 'none', boxSizing: 'border-box',
                    }}
                  >
                    🖨️ Foglio partita A4 (stampa / PDF)
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  )
}

// Etichetta slot cliccabile per rinomina inline
function SlotLabel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  useEffect(() => { setDraft(value) }, [value])
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); if (draft.trim()) onChange(draft.trim()) }}
        onKeyDown={e => {
          if (e.key === 'Enter') { setEditing(false); if (draft.trim()) onChange(draft.trim()) }
          if (e.key === 'Escape') { setEditing(false); setDraft(value) }
        }}
        style={{
          width: '100%', padding: '3px 5px', borderRadius: 4,
          border: '1px solid #005f98', fontSize: 11.5, fontWeight: 700, color: '#005f98',
        }}
      />
    )
  }
  return (
    <div
      onClick={() => setEditing(true)}
      title="Clicca per rinominare"
      style={{
        fontSize: 11.5, fontWeight: 700, color: '#005f98',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
      }}
    >
      <span>{value}</span>
      <Icon name="edit" size={11} color="#c0c7d2" />
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  width: '100%', padding: 11, borderRadius: 8,
  background: '#005f98', color: '#fff', border: 'none',
  fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
}
const btnSecondary: React.CSSProperties = {
  width: '100%', padding: 11, borderRadius: 8,
  background: '#f1f3fa', color: '#404751', border: '1px solid #e6e8ee',
  fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
}
