import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'

/**
 * Restituisce il numero di notifiche non lette dell'utente corrente.
 * Si aggiorna in tempo reale con subscribe alla tabella `notifications`.
 * Espone anche una refresh() manuale per forzare il re-fetch.
 */
export function useUnreadNotifications() {
  const { profile } = useAuth()
  const [count, setCount] = useState(0)

  const fetchCount = async (userId: string) => {
    const { count: n, error } = await supabase.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null)
    if (!error) setCount(n ?? 0)
  }

  useEffect(() => {
    if (!profile?.id) { setCount(0); return }
    const userId = profile.id
    fetchCount(userId)

    // Realtime: qualsiasi INSERT/UPDATE/DELETE sulle mie notifiche → re-count
    const channel = supabase.channel(`notif-unread-${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, () => fetchCount(userId))
      .subscribe()

    // Anche al focus della finestra (torno all'app da background)
    const onFocus = () => fetchCount(userId)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [profile?.id])

  const refresh = () => { if (profile?.id) fetchCount(profile.id) }

  return { count, refresh }
}
