import { BottomSheet } from './BottomSheet'
import { APP_VERSION, APP_VERSION_DATE, CHANGELOG, type Release } from '../lib/version'

interface Props {
  open: boolean
  onClose: () => void
  /** Se true, evidenzia in cima "Novità di questa versione" (usato dopo un update) */
  highlightLatest?: boolean
}

export function ChangelogSheet({ open, onClose, highlightLatest }: Props) {
  return (
    <BottomSheet open={open} onClose={onClose} title={highlightLatest ? '🎉 Novità della nuova versione' : 'Novità e versioni'}>
      <div style={{ padding: '10px 16px 30px' }}>
        {/* Versione corrente */}
        <div
          style={{
            background: 'linear-gradient(135deg, #005f98 0%, #003c5e 100%)',
            color: '#fff',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.8, fontWeight: 700 }}>
              Versione installata
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, marginTop: 2 }}>
              v{APP_VERSION}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 10.5, opacity: 0.85, fontWeight: 600 }}>
            rilasciata il<br />
            {formatDate(APP_VERSION_DATE)}
          </div>
        </div>

        {highlightLatest && CHANGELOG[0] && (
          <div
            style={{
              padding: '10px 12px',
              background: '#fff4e6',
              border: '1px solid #ffc98a',
              borderRadius: 10,
              fontSize: 12,
              color: '#7c4700',
              lineHeight: 1.5,
              marginBottom: 16,
              fontWeight: 600,
            }}
          >
            ✨ L'app è stata aggiornata a <strong>v{APP_VERSION}</strong>. Ecco cosa c'è di nuovo:
          </div>
        )}

        <div style={{ display: 'grid', gap: 14 }}>
          {CHANGELOG.map((rel, i) => (
            <ReleaseCard key={rel.version} release={rel} isLatest={i === 0} />
          ))}
        </div>

        <div style={{ marginTop: 22, textAlign: 'center' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              borderRadius: 10,
              background: '#005f98',
              color: '#fff',
              border: 'none',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Ho letto
          </button>
        </div>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 10.5, color: '#a0a7b3', lineHeight: 1.5 }}>
          Lenci LAB · ASD Lenci Poirino<br />
          Dati · Analisi · Crescita
        </div>
      </div>
    </BottomSheet>
  )
}

function ReleaseCard({ release, isLatest }: { release: Release; isLatest: boolean }) {
  return (
    <div
      style={{
        border: '1px solid ' + (isLatest ? '#005f98' : '#dfe3ea'),
        borderRadius: 12,
        padding: 12,
        background: isLatest ? '#f0f7ff' : '#fff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 900,
            color: '#fff',
            background: isLatest ? '#005f98' : '#404751',
            padding: '3px 9px',
            borderRadius: 6,
          }}
        >
          v{release.version}
        </span>
        <span style={{ fontSize: 11, color: '#707882', fontWeight: 600 }}>
          {formatDate(release.date)}
        </span>
        {isLatest && (
          <span style={{ fontSize: 9, fontWeight: 900, color: '#005f98', letterSpacing: 0.5 }}>
            ATTUALE
          </span>
        )}
      </div>

      {release.title && (
        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#181c20', marginBottom: 8 }}>
          {release.title}
        </div>
      )}

      {release.features && release.features.length > 0 && (
        <Section title="Novità" color="#005f98" bg="#e0f0ff" icon="✨" items={release.features} />
      )}
      {release.fixes && release.fixes.length > 0 && (
        <Section title="Correzioni" color="#7a3e00" bg="#fff4e6" icon="🔧" items={release.fixes} />
      )}
      {release.notes && release.notes.length > 0 && (
        <Section title="Note" color="#404751" bg="#f0f0f2" icon="📌" items={release.notes} />
      )}
    </div>
  )
}

function Section({ title, color, bg, icon, items }: { title: string; color: string; bg: string; icon: string; items: string[] }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          background: bg,
          color: color,
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        {icon} {title}
      </div>
      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#404751', lineHeight: 1.55 }}>
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  )
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}
