import type React from 'react'
import { useState } from 'react'
import { useAuth } from '../../store/auth'
import { Icon } from '../../components/Icon'


function AthleteDashboard({ firstName }: { firstName: string }) {
  const { profile } = useAuth()
  const [presenceConfirmed, setPresenceConfirmed] = useState(false)
  const displayName = profile?.full_name || firstName || 'Atleta'
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0])
    .join('')
    .toUpperCase() || 'AT'

  const badges = [
    { icon: 'bolt', color: '#00b4d8', name: 'Scheggia', desc: 'Velocità max in partita', opacity: 1 },
    { icon: 'sports_martial_arts', color: '#e21b79', name: 'Insuperabile', desc: '10 contrasti vinti', opacity: 1 },
    { icon: 'military_tech', color: '#707882', name: 'Cecchino', desc: '5 gol da fuori area', opacity: 0.4 },
    { icon: 'handshake', color: '#707882', name: 'Assist Man', desc: '10 assist stagionali', opacity: 0.4 },
  ]

  return (
    <>
      {/* Athlete hero card */}
      <div
        style={{
          background: '#fff', borderRadius: 18, padding: 22,
          boxShadow: '0 10px 24px rgba(0,120,191,0.06)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 88, height: 88, borderRadius: '50%',
            background: 'linear-gradient(135deg,#005f98,#0078bf)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontFamily: 'Anybody', fontWeight: 800, fontSize: 26,
            marginBottom: 10, position: 'relative',
          }}
        >
          {initials}
          <span
            style={{
              position: 'absolute', bottom: -2, right: -2,
              background: '#005f98', color: '#fff',
              border: '2px solid #fff',
              width: 26, height: 26, borderRadius: '50%',
              fontSize: 10, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            L12
          </span>
        </div>
        <h2 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 19, color: '#181c20', margin: '2px 0 0' }}>
          {displayName}
        </h2>
        <p style={{ fontSize: 12.5, color: '#404751', margin: '4px 0 10px' }}>
          Attaccante • Under 13
        </p>
        <span
          style={{
            background: '#e6e8ee', border: '1px solid #c0c7d2',
            borderRadius: 999, padding: '5px 14px',
            fontSize: 11.5, fontWeight: 700, color: '#181c20',
          }}
        >
          XP: 2450 / 3000
        </span>
      </div>

      {/* Grid 2x2 stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <StatBox icon="sports_soccer" color="#00b4d8" value="14" label="Gol Stagionali" />
        <StatBox icon="speed" color="#e91e63" value="850'" label="Minuti Giocati" />
        <StatBox icon="verified" color="#4caf50" value="98%" label="Presenze All." />
        <StatBox icon="emoji_events" color="#FFD100" value="3" label="MVP Partita" />
      </div>

      {/* Card blu - Prossimo Allenamento con CONFERMA PRESENZA */}
      <div
        style={{
          background: '#005f98', borderRadius: 18, padding: 18, color: '#fff',
          position: 'relative', overflow: 'hidden',
          boxShadow: '0 12px 26px rgba(0,95,152,0.28)',
        }}
      >
        <span
          style={{
            background: 'rgba(255,255,255,0.2)', borderRadius: 999,
            padding: '4px 12px', fontSize: 10.5, fontWeight: 700,
          }}
        >
          Prossimo Allenamento
        </span>
        <h3 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 20, margin: '10px 0 4px' }}>
          Oggi, 17:30
        </h3>
        <p style={{ fontSize: 12, opacity: 0.9, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon name="location_on" size={14} />
          Campo Sportivo Poirino (Sintetico)
        </p>
        {presenceConfirmed ? (
          <div
            style={{
              background: 'rgba(255,255,255,0.18)', borderRadius: 12,
              padding: 13, textAlign: 'center',
              fontWeight: 800, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Icon name="check_circle" size={18} />
            PRESENZA CONFERMATA
          </div>
        ) : (
          <button
            onClick={() => setPresenceConfirmed(true)}
            style={{
              width: '100%', background: '#83fc8e', color: '#002106',
              border: 'none', borderRadius: 12, padding: 13,
              fontFamily: 'Anybody', fontWeight: 800, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: 'pointer',
            }}
          >
            <Icon name="check_circle" size={18} />
            CONFERMA PRESENZA
          </button>
        )}
      </div>

      {/* Obiettivi Sbloccati */}
      <div style={{ background: '#fff', borderRadius: 18, padding: 18, boxShadow: '0 10px 24px rgba(0,120,191,0.06)' }}>
        <h3
          style={{
            fontFamily: 'Anybody', fontWeight: 700, fontSize: 16,
            color: '#181c20', margin: '0 0 14px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <Icon name="local_fire_department" size={20} color="#005f98" />
          Obiettivi Sbloccati
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {badges.map(b => (
            <div
              key={b.name}
              style={{
                border: '1px solid #e0e2e9', borderRadius: 14, padding: 12,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                textAlign: 'center', opacity: b.opacity,
              }}
            >
              <div
                style={{
                  width: 48, height: 48, borderRadius: '50%', background: '#ebeef4',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 8,
                }}
              >
                <Icon name={b.icon} size={22} color={b.color} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#181c20' }}>{b.name}</span>
              <span style={{ fontSize: 10, color: '#707882' }}>{b.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function StatBox({ icon, color, value, label, onClick }: { icon: string; color: string; value: string; label: string; onClick?: () => void }) {
  const content = (
    <>
      <Icon name={icon} size={26} color={color} />
      <span style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 20, color: '#181c20' }}>{value}</span>
      <span style={{ fontSize: 11, color: '#707882' }}>{label}</span>
    </>
  )
  const commonStyle: React.CSSProperties = {
    background: '#fff', border: '1px solid #e0e2e9', borderRadius: 14,
    padding: 14, display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 4,
  }
  if (onClick) {
    return (
      <button
        onClick={onClick}
        style={{ ...commonStyle, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        {content}
      </button>
    )
  }
  return <div style={commonStyle}>{content}</div>
}

export default AthleteDashboard
