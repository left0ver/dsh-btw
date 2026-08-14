/** Browser half of the `/btw` plugin. */

import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { BtwHeaderAction, btwAddress, type BtwHeaderInjected } from './BtwHeaderAction.tsx'
import { BtwThreadIndicator } from './BtwThreadIndicator.tsx'
import { BTW_LOCALE_NS, en, zh, type BtwLocaleKey } from '../locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** dsh-btw navigation and thread identity copy. */
    btw: BtwLocaleKey
  }
}

export const inject = ['sessions', 'slots', 'locale']

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
  ctx.effect(() => ctx.locale.register(BTW_LOCALE_NS, { zh, en }), 'dsh-btw: dictionaries')
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
    refreshSubagents(parentId) {
      return sessions.refreshSubagents(parentId)
    },
  })
  ctx.slots.inject(
    'conversation.session.header.actions',
    () => ctx.slots.register({
      name: 'conversation.session.header.actions',
      id: 'btw',
      order: 5,
      locale: BTW_LOCALE_NS,
      inject: injected,
    }, BtwHeaderAction),
  )
  ctx.slots.inject(
    'conversation.composer.dock',
    () => ctx.slots.register({
      name: 'conversation.composer.dock',
      id: 'btw-thread-indicator',
      order: -10,
      locale: BTW_LOCALE_NS,
    }, BtwThreadIndicator),
  )
}
