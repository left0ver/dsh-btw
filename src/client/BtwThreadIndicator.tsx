import type { SessionId, SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import { BTW_LOCALE_NS } from '../locales.ts'
import { btwNavigation } from './btw-state.ts'
import css from './BtwThreadIndicator.module.css'

export interface BtwThreadIndicatorProps {
  readonly sessionId: SessionId
  readonly useSessions: SnapshotSelectorHook<SessionListState>
  readonly t: PropsLocale<typeof BTW_LOCALE_NS>['t']
}

export function BtwThreadIndicator({ sessionId, useSessions, t }: BtwThreadIndicatorProps) {
  const sessions = useSessions(state => state)
  const pair = btwNavigation.resolve(sessionId, sessions.ids)
  if (pair === undefined || sessions.byId[pair.childId] === undefined) return null

  const isChild = pair.childId === sessionId
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
