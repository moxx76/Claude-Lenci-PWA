import { useState } from 'react'
import { useAuth } from '../store/auth'
import { ROLE_LABEL } from '../lib/types'
import { Icon } from '../components/Icon'
import { PushNotificationsCard } from '../components/PushNotificationsCard'
import { ViewModeSwitchCard } from '../components/ViewModeSwitchCard'
import { SupervisorSwitchCard } from '../components/SupervisorSwitchCard'
import { AvatarUploader } from '../components/AvatarUploader'
import { ChangePasswordCard } from '../components/ChangePasswordCard'
import { StaffAttendanceStatsCard } from '../components/StaffAttendanceStatsCard'
import { ClubSettingsCard } from '../components/ClubSettingsCard'
import { ChangelogSheet } from '../components/ChangelogSheet'
import { APP_VERSION } from '../lib/version'
import { supabase } from '../lib/supabase'

export function Profile() {
  const { profile, signOut, refreshProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [changelogOpen, setChangelogOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const handleLogout = async () => {
    if (!confirm('Vuoi davvero uscire?')) return
    setLoading(true)
    await signOut()
    setLoading(false)
  }

  // Forza l'aggiornamento della app: la PWA (Service Worker + cache Workbox) può servire
  // asset vecchi anche dopo un deploy, in particolare al primo caricamento dopo l'update.
  // Questa procedura combina i 3 step necessari a garantire un refresh pulito:
  //  1. Unregister di TUTTI i service worker registrati per questo origin
  //  2. Eliminazione di TUTTE le Cache API (Workbox precache, runtime cache, ecc.)
  //  3. Hard reload della pagina — al reload il browser scarica bundle e SW freschi da zero
  // Utile all'utente quando ha visto le vecchie schermate dopo un annuncio di aggiornamento.
  const handleForceUpdate = async () => {
    if (!confirm(
      'Vuoi aggiornare la app ora?\n\n' +
      'Verranno svuotate le cache locali e la pagina verrà ricaricata da zero. ' +
      'Serve quando dopo un aggiornamento vedi ancora i vecchi schermi. ' +
      'I tuoi dati e il login non verranno persi (restano sul server).'
    )) return
    setRefreshing(true)
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map(r => r.unregister()))
      }
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map(n => caches.delete(n)))
      }
    } catch (err) {
      console.warn('[Profile] Errore durante svuota cache', err)
      // Vado avanti col reload comunque — meglio provare a ricaricare che bloccare
    }
    // Hard reload: query string cache-buster + location.reload forza il fetch fresco dell'index
    const sep = window.location.href.includes('?') ? '&' : '?'
    window.location.href = window.location.href + sep + '_fresh=' + Date.now()
  }

  const displayName = profile?.full_name || profile?.email?.split('@')[0] || 'Utente'
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0])
    .join('')
    .toUpperCase() || 'LP'
  const roleLabel = ROLE_LABEL[profile?.role ?? 'public'] ?? 'Utente'

  const settingsItems = [
    { icon: 'person', label: 'Modifica profilo', onClick: () => alert('Funzionalità in arrivo nel prossimo sprint') },
    { icon: 'lock', label: 'Cambia password', onClick: () => alert('Funzionalità in arrivo nel prossimo sprint') },
    { icon: 'help', label: 'Supporto', onClick: () => window.open('mailto:info@lencipoirino.it') },
  ]

  return (
    <div
      className="max-w-md md:max-w-2xl mx-auto flex flex-col"
      style={{ padding: '20px 18px', gap: 18 }}
    >
      <h2 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 22, color: '#181c20', margin: 0 }}>
        Profilo
      </h2>

      {/* Hero profile card */}
      <div
        style={{
          background: '#fff', borderRadius: 18, padding: 20,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', textAlign: 'center',
          boxShadow: '0 10px 24px rgba(0,120,191,0.06)',
        }}
      >
        {profile?.id ? (
          <div style={{ marginBottom: 10 }}>
            <AvatarUploader
              currentUrl={profile.avatar_url}
              displayName={displayName}
              entityKind="staff"
              entityId={profile.id}
              size={90}
              onUploaded={async (url) => {
                await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id)
                await refreshProfile?.()
              }}
              onRemoved={async () => {
                await supabase.from('profiles').update({ avatar_url: null }).eq('id', profile.id)
                await refreshProfile?.()
              }}
            />
          </div>
        ) : (
          <div
            style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'linear-gradient(135deg,#005f98,#0078bf)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Anybody', fontWeight: 800, fontSize: 22, marginBottom: 10,
            }}
          >
            {initials}
          </div>
        )}
        <h3 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 17, color: '#181c20', margin: 0 }}>
          {displayName}
        </h3>
        {profile?.is_director ? (
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'linear-gradient(135deg, #005f98 0%, #003c5e 100%)',
              color: '#ffd100',
              fontSize: 10.5, fontWeight: 800, marginTop: 8,
              padding: '4px 12px', borderRadius: 999,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              boxShadow: '0 4px 10px rgba(0,60,94,0.25)',
            }}
          >
            <Icon name="workspace_premium" size={12} color="#ffd100" />
            Direzione Generale
          </span>
        ) : profile?.is_manager ? (
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'linear-gradient(135deg, #b3005c 0%, #6a0036 100%)',
              color: '#ffd100',
              fontSize: 10.5, fontWeight: 800, marginTop: 8,
              padding: '4px 12px', borderRadius: 999,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              boxShadow: '0 4px 10px rgba(179,0,92,0.25)',
            }}
          >
            <Icon name="assignment_ind" size={12} color="#ffd100" />
            Dirigente Accompagnatore
          </span>
        ) : (
          <span style={{ fontSize: 12, color: '#005f98', fontWeight: 700, marginTop: 4 }}>
            {roleLabel}
          </span>
        )}
        <p style={{ fontSize: 12, color: '#707882', margin: '4px 0 0' }}>
          {profile?.email}
        </p>
      </div>

      {/* Supervisor: impersona dirigente/coach */}
      <SupervisorSwitchCard />

      {/* Cambio vista (solo per utenti dual-role) */}
      <ViewModeSwitchCard />

      {/* Presenze staff (mostra solo se il profilo ha eventi come staff) */}
      <StaffAttendanceStatsCard />

      {/* Notifiche push */}
      <PushNotificationsCard />

      {/* Cambio password (tutti gli utenti loggati) */}
      <ChangePasswordCard />

      {/* Impostazioni club (mostrata sempre; l'editor è editabile solo dagli admin,
          gli altri vedono la matricola FIGC in sola lettura). Serve al momento per la
          matricola FIGC che compare nella distinta ufficiale di gara. */}
      {profile?.club_id && (
        <ClubSettingsCard clubId={profile.club_id} isAdmin={profile.role === 'admin'} />
      )}

      {/* Settings list */}
      <div
        style={{
          background: '#fff', borderRadius: 18, overflow: 'hidden',
          boxShadow: '0 10px 24px rgba(0,120,191,0.06)',
        }}
      >
        {settingsItems.map((si, idx) => (
          <div
            key={si.label}
            onClick={si.onClick}
            className="flex items-center cursor-pointer"
            style={{
              gap: 12, padding: 14,
              borderBottom: idx === settingsItems.length - 1 ? 'none' : '1px solid #e0e2e9',
            }}
          >
            <Icon name={si.icon} size={20} color="#404751" />
            <span className="flex-1" style={{ fontSize: 13.5, color: '#181c20' }}>{si.label}</span>
            <Icon name="chevron_right" size={18} color="#c0c7d2" />
          </div>
        ))}
      </div>

      {/* Aggiorna app / svuota cache — pulsante prominente per bypassare il problema PWA
          (Service Worker che serve chunk vecchi dopo un deploy). Card separata perché è
          un'azione di manutenzione che l'utente potrebbe dover trovare in fretta. */}
      <button
        onClick={handleForceUpdate}
        disabled={refreshing}
        style={{
          background: '#fff', border: '1px solid #005f98', color: '#005f98',
          borderRadius: 14, padding: '13px 14px', fontSize: 13, fontWeight: 700,
          display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left',
          cursor: refreshing ? 'wait' : 'pointer',
          opacity: refreshing ? 0.6 : 1,
          fontFamily: 'inherit',
        }}
      >
        <Icon name="refresh" size={20} color="#005f98" />
        <div style={{ flex: 1 }}>
          <div>{refreshing ? 'Aggiornamento…' : 'Aggiorna app / svuota cache'}</div>
          <div style={{ fontSize: 11, color: '#707882', fontWeight: 500, marginTop: 2, lineHeight: 1.4 }}>
            Usa questo pulsante se dopo un aggiornamento vedi ancora le vecchie schermate.
            Ricarica la app da zero senza toccare i tuoi dati.
          </div>
        </div>
      </button>

      {/* Logout */}
      <button
        onClick={handleLogout}
        disabled={loading}
        style={{
          border: '1px solid #ba1a1a', color: '#ba1a1a', background: '#fff',
          borderRadius: 14, padding: 13, fontSize: 13, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        <Icon name="logout" size={18} />
        {loading ? 'Uscita in corso…' : 'Esci'}
      </button>

      <button
        onClick={() => setChangelogOpen(true)}
        style={{
          background: 'transparent',
          border: 'none',
          padding: '4px 8px',
          margin: '0 auto',
          fontSize: 10.5,
          color: '#707882',
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'block',
        }}
      >
        Lenci LAB • <span style={{ color: '#005f98', fontWeight: 700, textDecoration: 'underline' }}>v{APP_VERSION}</span>
        <span style={{ display: 'block', fontSize: 9, marginTop: 1 }}>tocca per novità</span>
      </button>

      <ChangelogSheet open={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </div>
  )
}
