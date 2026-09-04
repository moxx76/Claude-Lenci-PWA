import { Icon } from './Icon'
import { Logo } from './Logo'

interface AppHeaderProps {
  onNotificationsClick?: () => void
  hasNotifications?: boolean
}

export function AppHeader({ onNotificationsClick, hasNotifications = true }: AppHeaderProps) {
  return (
    <header
      className="flex-shrink-0 bg-white flex items-center justify-between relative z-20"
      style={{
        height: 64,
        borderBottom: '1px solid #c0c7d2',
        padding: '0 18px',
      }}
    >
      <Logo size={38} showWordmark variant="plain" />
      <button
        onClick={onNotificationsClick}
        className="relative flex items-center justify-center bg-transparent border-0 cursor-pointer"
        style={{ width: 36, height: 36, borderRadius: '50%' }}
        aria-label="Notifiche"
      >
        <Icon name="notifications" size={22} color="#005f98" />
        {hasNotifications && (
          <span
            className="absolute"
            style={{
              top: 6,
              right: 6,
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#ba1a1a',
            }}
          />
        )}
      </button>
    </header>
  )
}
