import { Icon } from './Icon'
import { usePushNotifications } from '../hooks/usePushNotifications'

export function PushNotificationsCard() {
  const { status, error, subscribe, unsubscribe } = usePushNotifications()

  const iconProps = () => {
    switch (status) {
      case 'subscribed':    return { name: 'notifications_active', color: '#006e25', bg: 'rgba(128,249,139,0.20)' }
      case 'granted':       return { name: 'notifications', color: '#005f98', bg: '#cfe5ff' }
      case 'blocked':       return { name: 'notifications_off', color: '#ba1a1a', bg: '#ffdad6' }
      case 'unsupported':   return { name: 'do_not_disturb_on', color: '#707882', bg: '#e6e8ee' }
      case 'ios_needs_pwa': return { name: 'ios_share', color: '#8e6300', bg: 'rgba(255,209,0,0.30)' }
      case 'subscribing':   return { name: 'hourglass_top', color: '#005f98', bg: '#cfe5ff' }
      default:              return { name: 'notifications_none', color: '#5a6270', bg: '#e6e8ee' }
    }
  }
  const ic = iconProps()

  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: 14,
      boxShadow: '0 4px 14px rgba(0,120,191,0.06)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: ic.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={ic.name} size={20} color={ic.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#181c20' }}>
            Notifiche push
          </div>
          <div style={{ fontSize: 11.5, color: '#707882', marginTop: 1 }}>
            {status === 'subscribed'   && 'Attive su questo dispositivo'}
            {status === 'granted'      && 'Permesso concesso, non ancora attive qui'}
            {status === 'default'      && 'Ricevi avvisi anche a app chiusa'}
            {status === 'blocked'      && 'Bloccate dal browser'}
            {status === 'unsupported'  && 'Non supportate su questo browser'}
            {status === 'ios_needs_pwa' && 'Su iPhone: installa prima l\'app'}
            {status === 'subscribing'  && 'Attivazione in corso…'}
          </div>
        </div>
      </div>

      {status === 'subscribed' && (
        <button onClick={unsubscribe}
          style={{
            padding: '9px 12px', borderRadius: 9, border: '1px solid #ffbdb6',
            background: '#fff', color: '#93000a', fontWeight: 700, fontSize: 12.5,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
          <Icon name="notifications_off" size={14} color="#93000a" />
          Disattiva su questo dispositivo
        </button>
      )}
      {(status === 'default' || status === 'granted') && (
        <button onClick={subscribe}
          style={{
            padding: '10px 12px', borderRadius: 9, border: 'none',
            background: '#005f98', color: '#fff', fontWeight: 800, fontSize: 13,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            boxShadow: '0 4px 12px rgba(0,95,152,0.25)',
          }}>
          <Icon name="notifications_active" size={14} color="#fff" />
          Attiva notifiche push
        </button>
      )}
      {status === 'blocked' && (
        <div style={{
          background: '#fff8f7', border: '1px solid #ffdad6',
          padding: '9px 11px', borderRadius: 8,
          fontSize: 11.5, color: '#93000a', lineHeight: 1.4,
        }}>
          Le notifiche sono bloccate. Per attivarle apri le impostazioni del browser
          per <strong>lenci-poirino-app.netlify.app</strong> e concedi il permesso "Notifiche".
        </div>
      )}
      {status === 'ios_needs_pwa' && (
        <div style={{
          background: 'linear-gradient(135deg, #fff8ea, #fff3d0)',
          border: '1px solid rgba(255,209,0,0.6)',
          padding: '12px 12px', borderRadius: 10,
          fontSize: 12, color: '#5a4300', lineHeight: 1.5,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, marginBottom: 6, fontSize: 12.5 }}>
            <Icon name="ios_share" size={14} color="#8e6300" />
            Su iPhone serve prima installare l'app
          </div>
          <ol style={{ margin: 0, padding: '0 0 0 18px' }}>
            <li>Tocca l'icona <strong>Condividi</strong> <Icon name="ios_share" size={11} color="#5a4300" /> nella barra Safari (in basso)</li>
            <li>Scorri e tocca <strong>"Aggiungi alla schermata Home"</strong></li>
            <li>Apri l'app appena installata dall'icona sulla Home</li>
            <li>Torna qui e attiva le notifiche</li>
          </ol>
        </div>
      )}
      {status === 'unsupported' && (
        <div style={{
          background: '#f7f9ff', border: '1px solid #dce3f0',
          padding: '9px 11px', borderRadius: 8, fontSize: 11.5, color: '#404751',
        }}>
          Questo browser non supporta le notifiche push. Prova con Chrome, Edge, Firefox o Safari 16.4+.
        </div>
      )}
      {error && (
        <div style={{
          background: '#ffdad6', color: '#93000a',
          padding: '7px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
        }}>
          {error}
        </div>
      )}
    </div>
  )
}
