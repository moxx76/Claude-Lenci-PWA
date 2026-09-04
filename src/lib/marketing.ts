export type MarketingCategory =
  | 'dining' | 'music' | 'show' | 'tournament' | 'friendly'
  | 'fundraising' | 'family' | 'party' | 'networking'
  | 'training' | 'pr' | 'fair' | 'other'

export type MarketingStatus =
  | 'planning' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'

export const CATEGORY_META: Record<MarketingCategory, { label: string; icon: string; color: string; bg: string; emoji: string }> = {
  dining:      { label: 'Cena / Buffet',     icon: 'restaurant',    color: '#a04600', bg: '#ffe0c0', emoji: '🍕' },
  music:       { label: 'Musica / DJ',       icon: 'music_note',    color: '#7a0071', bg: '#f4d0f2', emoji: '🎵' },
  show:        { label: 'Spettacolo',        icon: 'theaters',      color: '#5a3fa0', bg: '#e0d4ff', emoji: '🎭' },
  tournament:  { label: 'Torneo / Trofeo',   icon: 'emoji_events',  color: '#8e6300', bg: 'rgba(255,209,0,0.30)', emoji: '🏆' },
  friendly:    { label: 'Amichevole',        icon: 'sports_soccer', color: '#005f98', bg: '#cfe5ff', emoji: '⚽' },
  fundraising: { label: 'Raccolta fondi',    icon: 'volunteer_activism', color: '#006e25', bg: 'rgba(128,249,139,0.35)', emoji: '💰' },
  family:      { label: 'Family day',        icon: 'family_restroom', color: '#c1006c', bg: '#ffdae7', emoji: '👨‍👩‍👧' },
  party:       { label: 'Festa',             icon: 'celebration',   color: '#c1006c', bg: '#ffdae7', emoji: '🎉' },
  networking:  { label: 'Sponsor / Network', icon: 'handshake',     color: '#404751', bg: '#e6e8ee', emoji: '🤝' },
  training:    { label: 'Formazione',        icon: 'school',        color: '#005f98', bg: '#cfe5ff', emoji: '📚' },
  pr:          { label: 'PR / Media',        icon: 'campaign',      color: '#ba1a1a', bg: '#ffdad6', emoji: '📣' },
  fair:        { label: 'Fiera / Stand',     icon: 'storefront',    color: '#6a5b00', bg: 'rgba(255,209,0,0.20)', emoji: '🎪' },
  other:       { label: 'Altro',             icon: 'category',      color: '#707882', bg: '#e6e8ee', emoji: '📌' },
}

export const STATUS_META: Record<MarketingStatus, { label: string; color: string; bg: string; icon: string }> = {
  planning:    { label: 'In pianificazione', color: '#707882', bg: '#e6e8ee', icon: 'edit_note' },
  confirmed:   { label: 'Confermato',        color: '#005f98', bg: '#cfe5ff', icon: 'check_circle' },
  in_progress: { label: 'In corso',          color: '#8e6300', bg: 'rgba(255,209,0,0.30)', icon: 'play_circle' },
  completed:   { label: 'Concluso',          color: '#006e25', bg: 'rgba(128,249,139,0.35)', icon: 'task_alt' },
  cancelled:   { label: 'Annullato',         color: '#ba1a1a', bg: '#ffdad6', icon: 'cancel' },
}

export interface MarketingEvent {
  id: string
  club_id: string | null
  title: string
  description: string | null
  category: MarketingCategory
  status: MarketingStatus
  event_date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  address: string | null
  estimated_attendance: number | null
  actual_attendance: number | null
  budget_estimated: number | null
  budget_actual: number | null
  revenue_estimated: number | null
  revenue_actual: number | null
  sponsors: string | null
  responsible_id: string | null
  responsible?: { id: string; full_name: string } | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  ticket_price: number | null
  ticket_url: string | null
  color: string | null
  notes: string | null
  checklist: Array<{ text: string; done: boolean }>
  attachments: Array<{ name: string; url: string }>
  // Pubblicazione
  is_published_calendar: boolean
  calendar_audience: string[] | null
  calendar_team_ids: string[] | null
  published_at: string | null
  published_by: string | null
  published_announcement_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
