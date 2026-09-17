// Ruoli REALI del DB Supabase (enum user_role) - aggiornato con 'athlete'
export type UserRole = 'admin' | 'coach' | 'parent' | 'athlete' | 'public'

export type LeadStatus =
  | 'new' | 'contacted' | 'tryout' | 'enrolled' | 'not_interested' | 'open_day'
  // 'open_day' rimane compatibile col DB ma non è più esposto nella UI

export interface Profile {
  id: string
  full_name: string | null
  email: string
  phone: string | null
  role: UserRole | string
  avatar_url: string | null
  club_id: string | null
  is_active: boolean | null
  is_director: boolean | null
  is_manager: boolean | null
  is_marketing: boolean | null
  is_shuttle_driver: boolean | null
  is_push_auto_prompt: boolean | null
  can_switch_to_parent: boolean | null
  is_supervisor: boolean | null
  is_readonly: boolean | null
  is_journalist?: boolean | null
  created_at: string
  updated_at: string
}

export interface RecruitmentLead {
  id: string
  first_name: string
  last_name: string
  birth_date: string | null
  category: string | null
  position: string | null
  status: LeadStatus
  parent_name: string | null
  parent_phone: string | null
  parent_email: string | null
  player_phone: string | null
  previous_club: string | null
  parent_profile_id: string | null
  campaign_slug: string | null
  season: string | null
  notes: string | null
  internal_notes: string | null
  created_at: string
  updated_at: string
}

// ============ Etichette IT ============
export const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  coach: 'Allenatore',
  parent: 'Genitore',
  athlete: 'Atleta',
  public: 'Pubblico',
}

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'Nuovo',
  contacted: 'Contattato',
  tryout: 'Provino',
  enrolled: 'Tesserato',
  not_interested: 'Non interessato',
  open_day: 'Open Day',
}

// Chip inline styles usando colori esatti del design
export const STATUS_STYLE: Record<LeadStatus, { bg: string; color: string }> = {
  new:              { bg: '#e6e8ee', color: '#181c20' },
  contacted:        { bg: '#cfe5ff', color: '#004a78' },
  tryout:           { bg: 'rgba(255,209,0,0.2)', color: '#8e6300' },
  enrolled:         { bg: 'rgba(128,249,139,0.35)', color: '#006e25' },
  not_interested:   { bg: '#ffdad6', color: '#93000a' },
  open_day:         { bg: '#e6e8ee', color: '#404751' },
}

// Category → colore chip (verde U-12, cyan U-15, etc)
export function categoryStyle(category?: string | null): { bg: string; color: string } {
  if (!category) return { bg: '#e6e8ee', color: '#181c20' }
  const c = category.toLowerCase()
  if (c.includes('u-19') || c.includes('u19')) return { bg: '#ffd9e2', color: '#8e0048' }
  if (c.includes('u-17') || c.includes('u17')) return { bg: '#cfe5ff', color: '#004a78' }
  if (c.includes('u-15') || c.includes('u15')) return { bg: 'rgba(0,178,227,0.15)', color: '#0090b8' }
  if (c.includes('u-13') || c.includes('u13')) return { bg: 'rgba(255,209,0,0.2)', color: '#8e6300' }
  if (c.includes('u-12') || c.includes('u12')) return { bg: 'rgba(128,249,139,0.35)', color: '#006e25' }
  if (c.includes('u-11') || c.includes('u11')) return { bg: 'rgba(128,249,139,0.35)', color: '#006e25' }
  return { bg: '#e6e8ee', color: '#181c20' }
}

// Avatar background dinamico per varietà visiva
export function avatarBg(seed: string): string {
  const colors = ['#005f98', '#b3005c', '#0078bf', '#006e25', '#004a78', '#8e0048']
  let h = 0
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h)
  return colors[Math.abs(h) % colors.length]
}

// Role helpers
export function isAdmin(role?: string | null): boolean { return role === 'admin' }
export function isCoach(role?: string | null): boolean { return role === 'coach' }
export function isParent(role?: string | null): boolean { return role === 'parent' }
export function isAthlete(role?: string | null): boolean { return role === 'athlete' }
export function isStaff(role?: string | null): boolean { return role === 'admin' || role === 'coach' }
