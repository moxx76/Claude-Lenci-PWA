import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  initialized: boolean

  init: () => Promise<void>
  refreshProfile: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,
  initialized: false,

  init: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    set({ session, user: session?.user ?? null, loading: false, initialized: true })
    if (session?.user) await get().refreshProfile()

    supabase.auth.onAuthStateChange(async (event, newSession) => {
      // A06: su PASSWORD_RECOVERY (link ricevuto via email) forza il flow verso
      // la pagina dedicata, qualunque sia la route corrente. Il link ha sessione
      // di recovery che consente updateUser({password}) senza quella vecchia.
      if (event === 'PASSWORD_RECOVERY') {
        set({ session: newSession, user: newSession?.user ?? null })
        if (typeof window !== 'undefined' && window.location.pathname !== '/reset-password') {
          window.location.replace('/reset-password')
        }
        return
      }
      set({ session: newSession, user: newSession?.user ?? null })
      if (newSession?.user) await get().refreshProfile()
      else set({ profile: null })
    })
  },

  refreshProfile: async () => {
    const user = get().user
    if (!user) return
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!error && data) set({ profile: data as Profile })
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) {
      if (error.message.toLowerCase().includes('invalid'))
        return { error: 'Email o password non corretti.' }
      return { error: error.message }
    }
    return { error: null }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    try { localStorage.removeItem('view_mode') } catch { /* ignore */ }
    // A01: pulisci le Cache API al logout. Impedisce che una sessione successiva
    // sullo stesso dispositivo possa vedere dati REST cached dalla sessione
    // precedente (anche su rete lenta/down). Il SW nuovo è già NetworkOnly, ma
    // potenziali cache 'supabase-api-v2' residue da versioni precedenti vengono
    // comunque eliminate.
    try {
      if ('caches' in window) {
        const names = await caches.keys()
        await Promise.all(
          names
            .filter(n => n.startsWith('supabase-api') || n === 'navigations')
            .map(n => caches.delete(n))
        )
      }
    } catch { /* ignore */ }
    set({ session: null, user: null, profile: null })
  },
}))
