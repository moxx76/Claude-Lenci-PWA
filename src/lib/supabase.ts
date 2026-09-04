import { createClient } from '@supabase/supabase-js'

// Stesso backend Supabase del sito recruitment (asd-lenci-poirino.netlify.app)
// Gli admin (Luca, Christian, Davide, Enzo) usano le stesse credenziali già in DB
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  || 'https://nlgknkopottaxewpdofl.supabase.co'

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sZ2tua29wb3R0YXhld3Bkb2ZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxODc0OTEsImV4cCI6MjA5NDc2MzQ5MX0.ruS3rzvUGBd5TKFXj2CWXVyPVRk2-DrO9H75KP14JNc'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,       // sessione salvata → no logout continui
    autoRefreshToken: true,     // token refresh automatico in background
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: 'lenci-pwa-auth',
  },
})

export const CLUB = {
  name: 'ASD Lenci O.N.L.U.S. Poirino',
  short: 'Lenci Poirino',
  city: 'Poirino (TO)',
} as const
