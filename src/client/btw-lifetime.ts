import type { ISessions, SessionId, SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import { btwNavigation } from './btw-state.ts'

type LifetimeSessions = Pick<ISessions, 'binding' | 'list'>
const SIDEBAR_ROW_MARKER = 'data-dsh-btw-temporary'

interface SelectedTemporarySession {
  readonly parentId: SessionId
  readonly childId: SessionId
  close(): ReturnType<NonNullable<ReturnType<ISessions['binding']>>['session']['command']>
}

function selectedTemporarySession(
  sessions: LifetimeSessions,
  snapshot: SessionListState,
): SelectedTemporarySession | undefined {
  const childId = snapshot.current
  if (childId === undefined) return undefined
  const pair = btwNavigation.resolve(childId, snapshot.ids)
  if (pair?.childId !== childId) return undefined
  const session = sessions.binding(childId)?.session
  if (session === undefined) return undefined
  return {
    ...pair,
    close: () => session.command('/btw-close'),
  }
}

function revealConcealedSidebarRows(page: Document): void {
  for (const row of page.querySelectorAll<HTMLElement>(`[${SIDEBAR_ROW_MARKER}]`)) {
    row.hidden = false
    row.removeAttribute(SIDEBAR_ROW_MARKER)
  }
}

function concealSelectedSidebarRow(page: Document): void {
  const selected = [...page.querySelectorAll<HTMLElement>('[role="treeitem"][aria-selected="true"]')]
    .find(row => row.querySelector('button') !== null)
  if (selected === undefined || selected.hasAttribute(SIDEBAR_ROW_MARKER)) return
  selected.hidden = true
  selected.setAttribute(SIDEBAR_ROW_MARKER, '')
}

function closeTemporarySession(session: SelectedTemporarySession): void {
  void session.close().then(result => {
    if (result.ok && result.value?.matched === true) {
      btwNavigation.forget(session.parentId, session.childId)
    }
  }, () => undefined)
}

export function watchBtwLifetime(sessions: LifetimeSessions, page: Document): () => void {
  const initial = sessions.list.getSnapshot()
  let selected = initial.phase === 'ready'
    ? selectedTemporarySession(sessions, initial)
    : undefined
  const syncSidebarRow = () => {
    if (selected !== undefined) concealSelectedSidebarRow(page)
  }
  const observer = new page.defaultView!.MutationObserver(syncSidebarRow)
  observer.observe(page.body, { attributes: true, childList: true, subtree: true })
  syncSidebarRow()

  const unsubscribe = sessions.list.subscribe(() => {
    const snapshot = sessions.list.getSnapshot()
    if (snapshot.phase !== 'ready') return

    const departed = selected?.childId !== snapshot.current ? selected : undefined
    selected = selectedTemporarySession(sessions, snapshot)
    syncSidebarRow()
    if (departed !== undefined) closeTemporarySession(departed)
  })

  return () => {
    unsubscribe()
    observer.disconnect()
    revealConcealedSidebarRows(page)
    if (selected !== undefined) closeTemporarySession(selected)
  }
}
