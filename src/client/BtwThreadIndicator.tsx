import type { SessionId, SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import { BTW_LABEL } from '../protocol.ts'
import css from './BtwThreadIndicator.module.css'

export interface BtwThreadIndicatorProps {
  readonly sessionId: SessionId
  readonly useSessions: SnapshotSelectorHook<SessionListState>
}

/** Ambient main/side identity shown at the left edge of the composer stats row. */
export function BtwThreadIndicator({ sessionId, useSessions }: BtwThreadIndicatorProps) {
  const summary = useSessions(state => state.byId[sessionId])
  const catalog = useSessions(state => state.subagentsByParent[sessionId])
  const entries = (catalog as {
    entries?: readonly { kind: string; mode?: string; label?: string }[]
  } | undefined)?.entries
  const isChild = summary?.parentId !== undefined && summary.displayTitle === BTW_LABEL
  const hasChild = entries?.some(entry => entry.kind === 'child'
    && entry.mode === 'continuable'
    && entry.label === BTW_LABEL) === true

  if (!isChild && !hasChild) return null

  const label = isChild ? '子线程' : '主线程'
  return (
    <div
      className={css.root}
      data-thread-kind={isChild ? 'child' : 'main'}
      aria-label={`当前：${label}`}
    >
      <span className={css.dot} aria-hidden />
      <span className={css.label}>{label}</span>
    </div>
  )
}
