import { create } from 'zustand'

export type ViewMode = 'admin' | 'parent'

const KEY = 'view_mode'

function readInitial(): ViewMode | null {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'admin' || v === 'parent') return v
  } catch { /* ignore */ }
  return null
}

interface ViewState {
  mode: ViewMode | null
  setMode: (m: ViewMode) => void
  clear: () => void
}

export const useViewMode = create<ViewState>((set) => ({
  mode: readInitial(),
  setMode: (m) => { localStorage.setItem(KEY, m); set({ mode: m }) },
  clear: () => { localStorage.removeItem(KEY); set({ mode: null }) },
}))
