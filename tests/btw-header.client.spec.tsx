// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import type { ConversationSnapshot, SessionId, SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { InputState } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { BtwHeaderAction, type BtwHeaderActionProps } from '../src/client/BtwHeaderAction.tsx'
import { BtwThreadIndicator } from '../src/client/BtwThreadIndicator.tsx'
import { BTW_OPENED_PREFIX } from '../src/protocol.ts'
import { btwText, type BtwLocaleId } from '../src/locales.ts'
import { clearBtwPairs, rememberBtwPair } from '../src/client/btw-state.ts'

const parentId = 'parent' as SessionId
const childId = 'child' as SessionId

afterEach(() => {
  cleanup()
  clearBtwPairs()
  vi.restoreAllMocks()
})

function list(side: boolean): SessionListState {
  return {
    ids: [parentId, childId],
    byId: {
      [parentId]: { id: parentId, displayTitle: 'Parent', running: false, blank: false, updatedAt: 1 },
      [childId]: { id: childId, displayTitle: 'Temporary', running: false, blank: false, updatedAt: 2 },
    },
    current: side ? childId : parentId,
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: {},
  }
}

function props(options: {
  side?: boolean
  pair?: boolean
  nodes?: ConversationSnapshot['nodes']
  openSide?: (parent: SessionId, child: SessionId) => Promise<boolean>
  openSession?: (sessionId: SessionId) => Promise<boolean>
  inputState?: InputState
  locale?: BtwLocaleId
} = {}): BtwHeaderActionProps {
  const side = options.side ?? false
  if (options.pair === true) rememberBtwPair(parentId, childId)
  const locale = options.locale ?? 'zh'
  const snapshot = { nodes: options.nodes ?? [], running: false } as ConversationSnapshot
  const inputState = options.inputState ?? {
    draft: '', imageIds: [], draftRev: 0, phase: 'plain', occurrences: [], queue: [],
  } as InputState
  return {
    sessionId: side ? childId : parentId,
    useSession: selector => selector(snapshot),
    useSessions: selector => selector(list(side)),
    useInput: selector => selector(inputState),
    inputActions: {} as never,
    useProjection: (() => undefined) as never,
    useWorkspaces: (() => { throw new Error('unused') }) as never,
    openSide: options.openSide ?? vi.fn().mockResolvedValue(true),
    openSession: options.openSession ?? vi.fn().mockResolvedValue(true),
    t: (key, params) => btwText(locale, key, params),
  }
}

function openedNode(seq = 7): ConversationSnapshot['nodes'][number] {
  return {
    kind: 'command', seq, time: 1, commandId: `cmd-${seq}` as never, name: 'btw', args: null,
    outcome: { kind: 'success', text: `${BTW_OPENED_PREFIX}${childId}` },
  }
}

describe('BtwHeaderAction', () => {
  it('opens the child when a successful /btw command settles', async () => {
    const openSide = vi.fn().mockResolvedValue(true)
    const view = render(<BtwHeaderAction {...props({ openSide })} />)
    view.rerender(<BtwHeaderAction {...props({ openSide, nodes: [openedNode()] })} />)
    await waitFor(() => expect(openSide).toHaveBeenCalledWith(parentId, childId))
  })

  it('waits for the submitted /btw draft to clear before opening the child', async () => {
    const openSide = vi.fn().mockResolvedValue(true)
    const submitting = {
      draft: '/btw hi', imageIds: [], draftRev: 1, phase: 'submitting', occurrences: [], queue: [],
    } as InputState
    const settled = {
      ...submitting, draft: '', draftRev: 2, phase: 'plain', claim: undefined,
    } as InputState
    const view = render(<BtwHeaderAction {...props({ openSide, inputState: submitting })} />)

    view.rerender(<BtwHeaderAction {...props({ openSide, inputState: submitting, nodes: [openedNode()] })} />)
    expect(openSide).not.toHaveBeenCalled()

    view.rerender(<BtwHeaderAction {...props({ openSide, inputState: settled, nodes: [openedNode()] })} />)
    await waitFor(() => expect(openSide).toHaveBeenCalledWith(parentId, childId))
  })

  it('does not reopen a historical command after returning to the parent', () => {
    const openSide = vi.fn().mockResolvedValue(true)
    render(<BtwHeaderAction {...props({ openSide, nodes: [openedNode()] })} />)
    expect(openSide).not.toHaveBeenCalled()
  })

  it('reopens a live parentless BTW session from the parent page', async () => {
    const openSide = vi.fn().mockResolvedValue(true)
    render(<BtwHeaderAction {...props({ pair: true, openSide })} />)
    fireEvent.click(document.querySelector('button')!)
    await waitFor(() => expect(openSide).toHaveBeenCalledWith(parentId, childId))
  })

  it('switches to the main session without closing the temporary session with Ctrl+/', async () => {
    const openSession = vi.fn().mockResolvedValue(true)
    render(<BtwHeaderAction {...props({ side: true, pair: true, openSession })} />)
    fireEvent.keyDown(document, { code: 'Slash', key: '/', ctrlKey: true })
    await waitFor(() => expect(openSession).toHaveBeenCalledWith(parentId))
  })

  it('does not capture Ctrl+/ during IME composition or while a modal is open', () => {
    const openSide = vi.fn().mockResolvedValue(true)
    render(<BtwHeaderAction {...props({ pair: true, openSide })} />)
    fireEvent.keyDown(document, { code: 'Slash', key: '/', ctrlKey: true, isComposing: true })
    const modal = document.createElement('div')
    modal.setAttribute('aria-modal', 'true')
    document.body.appendChild(modal)
    fireEvent.keyDown(document, { code: 'Slash', key: '/', ctrlKey: true })
    expect(openSide).not.toHaveBeenCalled()
    modal.remove()
  })

  it('renders English navigation copy', () => {
    const side = render(<BtwHeaderAction {...props({ side: true, pair: true, locale: 'en' })} />)
    expect(side.getByRole('button', { name: 'Back to main thread' })).toBeTruthy()
    side.unmount()
    clearBtwPairs()
    const parent = render(<BtwHeaderAction {...props({ pair: true, locale: 'en' })} />)
    expect(parent.getByRole('button', { name: 'Back to side thread' })).toBeTruthy()
  })

  it('restores Ctrl+/ navigation and the thread indicator after a page reload', async () => {
    sessionStorage.setItem('dsh-btw:pairs:v1', JSON.stringify([[parentId, childId]]))
    const openSession = vi.fn().mockResolvedValue(true)
    const sideProps = props({ side: true, openSession })
    const view = render(<>
      <BtwHeaderAction {...sideProps} />
      <BtwThreadIndicator
        sessionId={childId}
        useSessions={sideProps.useSessions}
        t={sideProps.t}
      />
    </>)

    expect(view.getByLabelText('当前：子线程')).toBeTruthy()
    fireEvent.keyDown(document, { code: 'Slash', key: '/', ctrlKey: true })
    await waitFor(() => expect(openSession).toHaveBeenCalledWith(parentId))
  })
})
