import type { SessionId, SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import { BTW_LOCALE_NS } from '../locales.ts'
import { btwChildOf, btwParentOf, discoverBtwPair } from './btw-state.ts'
import css from './BtwThreadIndicator.module.css'

export interface BtwThreadIndicatorProps {
  readonly sessionId: SessionId
  readonly useSessions: SnapshotSelectorHook<SessionListState>
  readonly t: PropsLocale<typeof BTW_LOCALE_NS>['t']
}

/** Ambient main/side identity shown at the left edge of the composer stats row. */
export function BtwThreadIndicator({ sessionId, useSessions, t }: BtwThreadIndicatorProps) {
  const sessions = useSessions(state => state)
  discoverBtwPair(sessionId, sessions.ids)
  const isChild = btwParentOf(sessionId) !== undefined
  const childId = btwChildOf(sessionId)
  const hasChild = childId !== undefined && sessions.byId[childId] !== undefined

  if (!isChild && !hasChild) return null

  const label = t(isChild ? 'thread.child' : 'thread.main')
  return (
    <div
      className={css.root}
      data-thread-kind={isChild ? 'child' : 'main'}
      aria-label={t('thread.current', { label })}
    >
      <span className={css.dot} aria-hidden />
      <span className={css.label}>{label}</span>
    </div>
  )
}
