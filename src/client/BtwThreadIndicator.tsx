import type { SessionId, SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import { isBtwLabel } from '../protocol.ts'
import { BTW_LOCALE_NS } from '../locales.ts'
import css from './BtwThreadIndicator.module.css'

export interface BtwThreadIndicatorProps {
  readonly sessionId: SessionId
  readonly useSessions: SnapshotSelectorHook<SessionListState>
  readonly t: PropsLocale<typeof BTW_LOCALE_NS>['t']
}

/** Ambient main/side identity shown at the left edge of the composer stats row. */
export function BtwThreadIndicator({ sessionId, useSessions, t }: BtwThreadIndicatorProps) {
  const summary = useSessions(state => state.byId[sessionId])
  const catalog = useSessions(state => state.subagentsByParent[sessionId])
  const entries = (catalog as {
    entries?: readonly { kind: string; mode?: string; label?: string }[]
  } | undefined)?.entries
  const isChild = summary?.parentId !== undefined && isBtwLabel(summary.displayTitle)
  const hasChild = entries?.some(entry => entry.kind === 'child'
    && entry.mode === 'continuable'
    && isBtwLabel(entry.label)) === true

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
