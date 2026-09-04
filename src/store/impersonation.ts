import { create } from 'zustand'

const KEY = 'impersonated_manager_id'

function readInitial(): string | null {
  try { return localStorage.getItem(KEY) } catch { return null }
}

interface State {
  managerId: string | null
  setManager: (id: string | null) => void
  clear: () => void
}

export const useImpersonation = create<State>((set) => ({
  managerId: readInitial(),
  setManager: (id) => {
    if (id) { try { localStorage.setItem(KEY, id) } catch { /* ignore */ } }
    else { try { localStorage.removeItem(KEY) } catch { /* ignore */ } }
    set({ managerId: id })
  },
  clear: () => {
    try { localStorage.removeItem(KEY) } catch { /* ignore */ }
    set({ managerId: null })
  },
}))
