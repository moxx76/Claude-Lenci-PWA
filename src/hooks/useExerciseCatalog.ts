import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { DiagramJson } from '../lib/svgDiagram'

export type SessionPart = 'attivazione' | 'tecnica' | 'situazionale' | 'gioco'

export interface TrainingExercise {
  id: string
  club_id: string | null
  name: string
  session_part: SessionPart
  duration_min: number
  age_ranges: string[]
  objective_possesso: string | null
  objective_non_possesso: string | null
  objective_tecnico: string | null
  objective_motorio: string | null
  objective_emotivo: string | null
  principles: string[]
  area_size: string | null
  materials: string | null
  description: string | null
  diagram_svg: string | null
  diagram_json: DiagramJson | null
  players_min: number
  players_max: number
  tags: string[]
  is_official: boolean
  created_by: string | null
  created_at: string
}

export interface UseExerciseCatalogFilters {
  session_part?: SessionPart | 'all'
  age_range?: string
  search?: string
  tag?: string
  refreshKey?: number
}

export function useExerciseCatalog(filters?: UseExerciseCatalogFilters) {
  const [exercises, setExercises] = useState<TrainingExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    supabase
      .from('training_exercises')
      .select('*')
      .order('session_part', { ascending: true })
      .order('name', { ascending: true })
      .then(({ data, error: e }) => {
        if (!alive) return
        if (e) {
          setError(e.message)
          setExercises([])
        } else {
          setExercises((data as TrainingExercise[]) || [])
        }
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [filters?.refreshKey])

  const filtered = useMemo(() => {
    let out = exercises
    if (filters?.session_part && filters.session_part !== 'all') {
      out = out.filter(e => e.session_part === filters.session_part)
    }
    if (filters?.age_range) {
      out = out.filter(e => e.age_ranges.includes(filters.age_range!))
    }
    if (filters?.tag) {
      out = out.filter(e => e.tags.includes(filters.tag!))
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase().trim()
      if (q) {
        out = out.filter(
          e =>
            e.name.toLowerCase().includes(q) ||
            (e.description || '').toLowerCase().includes(q) ||
            e.tags.some(t => t.toLowerCase().includes(q))
        )
      }
    }
    return out
  }, [exercises, filters?.session_part, filters?.age_range, filters?.search, filters?.tag])

  return { exercises: filtered, allExercises: exercises, loading, error }
}

// Labels + colori per session_part (coerenti in tutta la UI)
export const SESSION_PART_META: Record<SessionPart, { label: string; short: string; bg: string; fg: string; icon: string; recommendedMin: number }> = {
  attivazione: {
    label: '1° parte - Attivazione motoria',
    short: 'Attivazione',
    bg: '#fff3cd',
    fg: '#856404',
    icon: 'directions_run',
    recommendedMin: 12,
  },
  tecnica: {
    label: '1° parte - Tecnica di base',
    short: 'Tecnica',
    bg: '#d1ecf1',
    fg: '#0c5460',
    icon: 'sports_soccer',
    recommendedMin: 15,
  },
  situazionale: {
    label: '2° parte - Situazionale',
    short: 'Situazionale',
    bg: '#f8d7da',
    fg: '#721c24',
    icon: 'shield',
    recommendedMin: 35,
  },
  gioco: {
    label: '3° parte - Gioco/Partita',
    short: 'Gioco',
    bg: '#d4edda',
    fg: '#155724',
    icon: 'emoji_events',
    recommendedMin: 30,
  },
}

export function getSessionPartMeta(part: SessionPart) {
  return SESSION_PART_META[part]
}
