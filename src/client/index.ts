/** Browser half of the `/btw` plugin. */

import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { BtwHeaderAction, btwAddress, type BtwHeaderInjected } from './BtwHeaderAction.tsx'
import { BtwThreadIndicator } from './BtwThreadIndicator.tsx'

export const inject = ['sessions', 'slots']

interface BtwNavigation {
  refreshSubagents(parentId: SessionId): Promise<void>
  openSubagent(address: ReturnType<typeof btwAddress>): void
}

/** Refresh the parent catalog, then open the child through its known durable address. */
export async function openBtwSide(
  sessions: BtwNavigation,
  parentId: SessionId,
  childId: SessionId,
): Promise<boolean> {
  await sessions.refreshSubagents(parentId)
  try {
    sessions.openSubagent(btwAddress(parentId, childId))
    return true
  } catch {
    return false
  }
}

/** Register header controls and full-page side navigation. */
export function apply(ctx: ClientContext): void {
  const sessions = ctx.sessions
  const injected = (): BtwHeaderInjected => ({
    open(id) {
      sessions.open(id)
    },
    async openSide(parentId, childId) {
      if (!await openBtwSide(sessions, parentId, childId)) return false
      requestAnimationFrame(() => {
        document.querySelector<HTMLTextAreaElement>('textarea')?.focus()
      })
      return true
    },
  })
  ctx.slots.inject(
    'conversation.session.header.actions',
    () => ctx.slots.register({
      name: 'conversation.session.header.actions',
      id: 'btw',
      order: 5,
      inject: injected,
    }, BtwHeaderAction),
  )
  ctx.slots.inject(
    'conversation.composer.dock',
    () => ctx.slots.register({
      name: 'conversation.composer.dock',
      id: 'btw-thread-indicator',
      order: -10,
    }, BtwThreadIndicator),
  )
}
