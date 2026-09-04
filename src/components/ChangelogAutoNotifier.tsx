import { ChangelogSheet } from './ChangelogSheet'
import { useVersionCheck } from '../hooks/useVersionCheck'

/**
 * Wrapper leggero da montare all'interno di un'area autenticata.
 * Al primo caricamento post-update mostra automaticamente il changelog.
 */
export function ChangelogAutoNotifier() {
  const { showChangelog, markSeen } = useVersionCheck()
  return <ChangelogSheet open={showChangelog} onClose={markSeen} highlightLatest />
}
