// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import type { ConversationSnapshot, SessionId, SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { InputState } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { BtwHeaderAction, type BtwHeaderActionProps } from '../src/client/BtwHeaderAction.tsx'
import { BTW_LABEL, BTW_OPENED_PREFIX } from '../src/protocol.ts'

const parentId = 'parent' as SessionId
const childId = 'child' as SessionId

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function input(draft = ''): InputState {
  return {
    draft,
    imageIds: [],
    draftRev: 0,
    phase: 'plain',
    occurrences: [],
    queue: [],
  }
}

function list(side: boolean): SessionListState {
  const current = side ? childId : parentId
  return {
    ids: [parentId],
    byId: {
      [parentId]: {
        id: parentId,
        displayTitle: 'Parent',
        running: false,
        blank: false,
        updatedAt: 1,
      },
      ...(side ? {
        [childId]: {
          id: childId,
          displayTitle: BTW_LABEL,
          parentId,
          origin: 'subagent' as const,
          running: false,
          blank: false,
          updatedAt: 2,
        },
      } : {}),
    },
    current,
    phase: 'ready',
    subagentsByParent: side ? {} : {
      [parentId]: {
        entries: [{
          kind: 'child', id: childId, activity: 'running', hasChildren: false,
          mode: 'continuable', label: BTW_LABEL,
        }],
        parentAvailable: true,
        state: 'ready',
        error: null,
      },
    },
    jobsBySession: {},
    currentAddress: side
      ? { parentSessionId: parentId, childSessionId: childId, mode: 'continuable' }
      : undefined,
  }
}

function props(options: {
  side?: boolean
  nodes?: ConversationSnapshot['nodes']
  open?: (id: SessionId) => void
  openSide?: (parent: SessionId, child: SessionId) => Promise<boolean>
} = {}): BtwHeaderActionProps {
  const side = options.side ?? false
  const sessions = list(side)
  const snapshot = {
    nodes: options.nodes ?? [],
    running: options.running ?? false,
  } as ConversationSnapshot
  const inputState = input()
  return {
    sessionId: side ? childId : parentId,
    useSession: selector => selector(snapshot),
    useSessions: selector => selector(sessions),
    useInput: selector => selector(inputState),
    inputActions: {} as never,
    useProjection: (() => undefined) as never,
    useWorkspaces: (() => { throw new Error('unused') }) as never,
    open: options.open ?? vi.fn(),
    openSide: options.openSide ?? vi.fn().mockResolvedValue(true),
  }
}

describe('BtwHeaderAction', () => {
  it('opens the child when a successful /btw command settles', async () => {
    const openSide = vi.fn().mockResolvedValue(true)
    const view = render(<BtwHeaderAction {...props({ openSide })} />)
    view.rerender(<BtwHeaderAction {...props({
      openSide,
      nodes: [{
        kind: 'command',
        seq: 7,
        time: 1,
        commandId: 'cmd-1' as never,
        name: 'btw',
        args: null,
        outcome: { kind: 'success', text: `${BTW_OPENED_PREFIX}${childId}` },
      }],
    })} />)
    await waitFor(() => {
      expect(openSide).toHaveBeenCalledWith(parentId, childId)
    })
  })

  it('does not reopen a historical command after returning to the parent', () => {
    const openSide = vi.fn().mockResolvedValue(true)
    render(<BtwHeaderAction {...props({
      openSide,
      nodes: [{
        kind: 'command',
        seq: 7,
        time: 1,
        commandId: 'cmd-1' as never,
        name: 'btw',
        args: null,
        outcome: { kind: 'success', text: `${BTW_OPENED_PREFIX}${childId}` },
      }],
    })} />)
    expect(openSide).not.toHaveBeenCalled()
  })

  it('keeps an idle BTW child switchable from the parent page', async () => {
    const openSide = vi.fn().mockResolvedValue(true)
    const state = list(false)
    const parentCatalog = state.subagentsByParent[parentId]
    if (parentCatalog === undefined) throw new Error('missing parent catalog fixture')
    const idleState = {
      ...state,
      subagentsByParent: {
        [parentId]: {
          ...parentCatalog,
          entries: parentCatalog.entries.map(entry => entry.kind === 'child'
            ? { ...entry, activity: 'inactive' as const }
            : entry),
        },
      },
    }
    const base = props({ openSide })
    render(<BtwHeaderAction {...base} useSessions={selector => selector(idleState)} />)
    fireEvent.click(document.querySelector('button')!)
    await waitFor(() => {
      expect(openSide).toHaveBeenCalledWith(parentId, childId)
    })
  })

  it('toggles from a side conversation to its parent with Ctrl+/', () => {
    const open = vi.fn()
    render(<BtwHeaderAction {...props({ side: true, open })} />)
    fireEvent.keyDown(document, { code: 'Slash', key: '/', ctrlKey: true })
    expect(open).toHaveBeenCalledWith(parentId)
  })

  it('accepts the Ctrl+/ key fallback when the browser omits Slash code', () => {
    const open = vi.fn()
    render(<BtwHeaderAction {...props({ side: true, open })} />)
    fireEvent.keyDown(document, { code: 'Unidentified', key: '/', ctrlKey: true })
    expect(open).toHaveBeenCalledWith(parentId)
  })

  it('does not capture Ctrl+/ during IME composition or while a modal is open', () => {
    const openSide = vi.fn().mockResolvedValue(true)
    render(<BtwHeaderAction {...props({ openSide })} />)
    fireEvent.keyDown(document, { code: 'Slash', key: '/', ctrlKey: true, isComposing: true })
    const modal = document.createElement('div')
    modal.setAttribute('aria-modal', 'true')
    document.body.appendChild(modal)
    fireEvent.keyDown(document, { code: 'Slash', key: '/', ctrlKey: true })
    expect(openSide).not.toHaveBeenCalled()
    modal.remove()
  })

  it('does not expose a close button or capture Escape on the side page', () => {
    const open = vi.fn()
    const view = render(<BtwHeaderAction {...props({ side: true, open })} />)
    expect(view.queryByRole('button', { name: '关闭 BTW' })).toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(open).not.toHaveBeenCalled()
  })
})
