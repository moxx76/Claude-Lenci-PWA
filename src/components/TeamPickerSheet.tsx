import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'

interface TeamOption {
  id: string
  name: string
  color: string | null
  category?: string | null
  age_range?: string | null
  n_players?: number | null
}

interface Props {
  open: boolean
  onClose: () => void
  teams: TeamOption[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreateNew?: () => void
}

export function TeamPickerSheet({ open, onClose, teams, selectedId, onSelect, onCreateNew }: Props) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Seleziona squadra">
      <div style={{ padding: '4px 16px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {teams.map(t => {
            const active = t.id === selectedId
            const color = t.color || '#005f98'
            return (
              <button
                key={t.id}
                onClick={() => { onSelect(t.id); onClose() }}
                style={{
                  padding: 12, borderRadius: 12,
                  background: active ? color : '#fff',
                  border: active ? `2px solid ${color}` : '1px solid #e0e2e9',
                  color: active ? '#fff' : '#181c20',
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 12,
                  textAlign: 'left',
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: active ? 'rgba(255,255,255,0.25)' : color + '20',
                  color: active ? '#fff' : color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon name="shield" size={18} color={active ? '#fff' : color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800 }}>{t.name}</div>
                  <div style={{
                    fontSize: 10.5,
                    color: active ? 'rgba(255,255,255,0.9)' : '#707882',
                    marginTop: 2,
                  }}>
                    {t.n_players != null && `${t.n_players} tesserati`}
                    {t.n_players != null && (t.category || t.age_range) && ' · '}
                    {t.category || t.age_range}
                  </div>
                </div>
                {active && <Icon name="check_circle" size={18} color="#fff" />}
              </button>
            )
          })}
        </div>

        {onCreateNew && (
          <button
            onClick={() => { onClose(); setTimeout(onCreateNew, 200) }}
            style={{
              width: '100%', marginTop: 14, padding: '12px 14px', borderRadius: 12,
              background: 'transparent', border: '1.5px dashed #c0c7d2',
              color: '#005f98', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontSize: 12.5, fontWeight: 700,
            }}
          >
            <Icon name="add" size={15} color="#005f98" />
            Crea nuova squadra
          </button>
        )}
      </div>
    </BottomSheet>
  )
}
