import { create } from 'zustand'
import type { Session, User, Subscription } from '@supabase/supabase-js'
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

// A14 (bonus assessment): idempotenza di init.
// StrictMode in sviluppo monta App due volte: senza queste guardie, init si
// registrava due listener auth e invocava refreshProfile due volte,
// potenzialmente con risultati race-condition. Ora:
// - initPromise: se init è già in corso, le chiamate successive attendono
// - authSubscription: tenuta in modulo scope, unsubscribe al secondo init
let initPromise: Promise<void> | null = null
let authSubscription: Subscription | null = null

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,
  initialized: false,

  init: async () => {
    if (initPromise) return initPromise
    if (get().initialized) return
    initPromise = (async () => {
      // Clean up listener precedente (dev StrictMode remount, hot-reload)
      if (authSubscription) {
        authSubscription.unsubscribe()
        authSubscription = null
      }

      const { data: { session } } = await supabase.auth.getSession()
      set({ session, user: session?.user ?? null, loading: false, initialized: true })
      if (session?.user) await get().refreshProfile()

      const { data } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        // A06: su PASSWORD_RECOVERY forza il flow verso la pagina dedicata
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
      authSubscription = data.subscription
    })()
    return initPromise
  },

  refreshProfile: async () => {
    const currentUserId = get().user?.id
    if (!currentUserId) return
    const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUserId).single()
    // Guardia race: se durante la fetch l'utente è cambiato (logout o altro),
    // non sovrascrivere il profilo con dati che non appartengono alla sessione attuale
    if (get().user?.id !== currentUserId) return
    if (!error && data) set({ profile: data as Profile })
    else if (error && error.code !== 'PGRST116') console.warn('[auth] refreshProfile error', error)
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
