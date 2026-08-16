// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ISessions, SessionId, SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import { watchBtwLifetime } from '../src/client/btw-lifetime.ts'
import { btwNavigation } from '../src/client/btw-state.ts'

const parentId = 'parent' as SessionId
const childId = 'child' as SessionId
const otherId = 'other' as SessionId

afterEach(() => {
  btwNavigation.clear()
  document.body.replaceChildren()
})

function setup(current: SessionId | undefined) {
  let snapshot: SessionListState = {
    ids: [parentId, childId, otherId],
    byId: {},
    current,
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: {},
    currentAddress: undefined,
  }
  const listeners = new Set<() => void>()
  const command = vi.fn().mockResolvedValue({ ok: true, value: { matched: true } })
  const sessions = {
    list: {
      getSnapshot: () => snapshot,
      subscribe(listener: () => void) {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    },
    binding: vi.fn((id: SessionId) => id === childId
      ? { session: { command } }
      : undefined),
  } as unknown as Pick<ISessions, 'binding' | 'list'>
  const publish = (currentSession: SessionId | undefined, phase: SessionListState['phase'] = 'ready') => {
    snapshot = { ...snapshot, current: currentSession, phase }
    for (const listener of listeners) listener()
  }
  return { command, publish, sessions }
}

describe('temporary session lifetime', () => {
  it('destroys the temporary session when switching back to its parent', async () => {
    btwNavigation.remember(parentId, childId)
    const { command, publish, sessions } = setup(childId)
    const stop = watchBtwLifetime(sessions, document)

    publish(parentId)

    await vi.waitFor(() => expect(command).toHaveBeenCalledWith('/btw-close'))
    expect(btwNavigation.resolve(childId, [parentId, childId])).toBeUndefined()
    stop()
  })

  it('destroys the temporary session when switching to an unrelated session', async () => {
    btwNavigation.remember(parentId, childId)
    const { command, publish, sessions } = setup(childId)
    const stop = watchBtwLifetime(sessions, document)

    publish(otherId)

    await vi.waitFor(() => expect(command).toHaveBeenCalledTimes(1))
    stop()
  })

  it('destroys the temporary session when the current selection is cleared', async () => {
    btwNavigation.remember(parentId, childId)
    const { command, publish, sessions } = setup(childId)
    const stop = watchBtwLifetime(sessions, document)

    publish(undefined)

    await vi.waitFor(() => expect(command).toHaveBeenCalledTimes(1))
    stop()
  })

  it('destroys the temporary session when the client view closes', async () => {
    btwNavigation.remember(parentId, childId)
    const { command, sessions } = setup(childId)

    const stop = watchBtwLifetime(sessions, document)
    stop()

    await vi.waitFor(() => expect(command).toHaveBeenCalledWith('/btw-close'))
  })

  it('keeps the temporary session when entering it from the parent', () => {
    btwNavigation.remember(parentId, childId)
    const { command, publish, sessions } = setup(parentId)
    const stop = watchBtwLifetime(sessions, document)

    publish(childId)

    expect(command).not.toHaveBeenCalled()
    stop()
  })

  it('ignores transient selection gaps while the session list reloads', () => {
    btwNavigation.remember(parentId, childId)
    const { command, publish, sessions } = setup(childId)
    const stop = watchBtwLifetime(sessions, document)

    publish(undefined, 'pending')
    publish(childId)

    expect(command).not.toHaveBeenCalled()
    stop()
  })

  it('conceals a sidebar row mounted after the temporary session opens', async () => {
    btwNavigation.remember(parentId, childId)
    const { sessions } = setup(childId)
    const stop = watchBtwLifetime(sessions, document)

    document.body.innerHTML = `
      <div role="tree">
        <div id="temporary-row" role="treeitem" aria-selected="true"><button>Actions</button></div>
      </div>
    `
    const row = document.querySelector<HTMLElement>('#temporary-row')!

    await vi.waitFor(() => expect(row.hidden).toBe(true))
    stop()
    expect(row.hidden).toBe(false)
  })

  it('keeps the departed temporary row concealed until it is removed', async () => {
    btwNavigation.remember(parentId, childId)
    document.body.innerHTML = `
      <div role="tree">
        <div id="temporary-row" role="treeitem" aria-selected="true"><button>Actions</button></div>
      </div>
    `
    const row = document.querySelector<HTMLElement>('#temporary-row')!
    const { publish, sessions } = setup(childId)
    const stop = watchBtwLifetime(sessions, document)

    publish(parentId)
    row.setAttribute('aria-selected', 'false')

    await vi.waitFor(() => expect(row.hidden).toBe(true))
    stop()
  })
})
